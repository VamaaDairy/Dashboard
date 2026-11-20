import { toTrack, type LngLat, type Ping } from "@/lib/shop/track";

/**
 * How a trip went against its plan (the road from the plant through the stops in their order):
 * - the km driven to the last stop against the planned km; what was driven after it (usually back to the plant)
 *   is counted apart, since the plan ends at the last stop;
 * - the stretches where the truck drove away from the planned road;
 * - the stops done in another order than planned.
 */

/** Further than this from the planned road counts as off it (a phone's GPS is good to a few tens of metres). */
export const OFF_ROAD_M = 200;
/** Off-road stretches shorter than this, or with fewer positions (one every ~6 s), are GPS jumps, not another road. */
const MIN_STRETCH_M = 250;
const MIN_STRETCH_POINTS = 3;

export interface StopDone { seq: number; status: string; deliveredAt: string | null; note: string | null; lat: number | null }

export interface TripDeviation {
  /** driven from the start to the last stop done (the whole drive while stops are still pending) */
  roundM: number;
  /** driven after the last stop (back to the plant, or wherever the trip ended); null while stops are pending */
  afterM: number | null;
  /** roundM against the planned road's length: only once every stop is done and visited, all have a pin and the plan is by road */
  overPlanM: number | null;
  /** the drive could be checked against the planned road (false for a straight-line plan, or before there is a drive) */
  checked: boolean;
  /** the stretches further than OFF_ROAD_M from the planned road ([lng, lat]), their total length and the farthest point */
  off: LngLat[][];
  offM: number;
  maxOffM: number;
  /** stops done after a stop planned later: stop `seq` was done after stop `after` */
  outOfOrder: Array<{ seq: number; after: number }>;
  /** how many stops the truck went to */
  visited: number;
}

const time = (v: string | Date) => new Date(v).getTime();

export function tripDeviation(stops: StopDone[], plan: { path: LngLat[]; metres: number; road: boolean }, pings: Ping[]): TripDeviation {
  // the stops the truck went to, in the order it did them (End trip closes the rest as "Not visited")
  const visited = stops
    .filter((s) => s.status !== "pending" && s.deliveredAt && s.note !== "Not visited")
    .sort((a, b) => time(a.deliveredAt!) - time(b.deliveredAt!) || a.seq - b.seq);
  const outOfOrder: TripDeviation["outOfOrder"] = [];
  let top = 0;
  for (const s of visited) {
    if (s.seq < top) outOfOrder.push({ seq: s.seq, after: top });
    else top = s.seq;
  }

  // the drive splits where the last stop was done: the round, then the way back
  const allDone = stops.length > 0 && stops.every((s) => s.status !== "pending");
  const roundEnd = allDone && visited.length ? Math.max(...visited.map((s) => time(s.deliveredAt!))) : null;
  const round = roundEnd === null ? pings : pings.filter((p) => time(p.at) <= roundEnd);
  // the way back starts from the last position of the round, so the stretch between them is counted once
  const after = roundEnd === null ? [] : [...round.slice(-1), ...pings.filter((p) => time(p.at) > roundEnd)];
  const roundTrack = toTrack(round);
  const comparable = plan.road && allDone && visited.length === stops.length && stops.every((s) => s.lat !== null) && round.length > 1;

  const res: TripDeviation = {
    roundM: roundTrack.metres,
    afterM: roundEnd === null ? null : toTrack(after).metres,
    overPlanM: comparable ? roundTrack.metres - Math.round(plan.metres) : null,
    checked: plan.road && plan.path.length > 1 && round.length > 1,
    off: [],
    offM: 0,
    maxOffM: 0,
    outOfOrder,
    visited: visited.length,
  };
  if (!res.checked) return res;

  // metres on a flat map around the plan (fine at a city's scale)
  const kx = 111_320 * Math.cos((plan.path[0][1] * Math.PI) / 180), ky = 110_574;
  const xy = ([lng, lat]: LngLat) => [lng * kx, lat * ky] as const;
  // each stretch of the planned road, with its box grown by OFF_ROAD_M for a quick "near enough" test
  const segs = plan.path.slice(1).map((b, i) => {
    const [ax, ay] = xy(plan.path[i]), [bx, by] = xy(b);
    return { ax, ay, bx, by, x0: Math.min(ax, bx) - OFF_ROAD_M, x1: Math.max(ax, bx) + OFF_ROAD_M, y0: Math.min(ay, by) - OFF_ROAD_M, y1: Math.max(ay, by) + OFF_ROAD_M };
  });
  const toSeg = (x: number, y: number, s: (typeof segs)[number]) => {
    const dx = s.bx - s.ax, dy = s.by - s.ay, len = dx * dx + dy * dy;
    const k = len ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / len)) : 0;
    return Math.hypot(x - (s.ax + k * dx), y - (s.ay + k * dy));
  };
  /** 0 when within OFF_ROAD_M of the planned road, else how far from it. */
  const offBy = (p: LngLat) => {
    const [x, y] = xy(p);
    for (const s of segs) if (x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1 && toSeg(x, y, s) <= OFF_ROAD_M) return 0;
    let min = Infinity;
    for (const s of segs) min = Math.min(min, toSeg(x, y, s));
    return min;
  };
  const step = (a: LngLat, b: LngLat) => Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * ky);

  /** pts: the drive off the road with the last point on it before and the first after; n: how many of them are off it */
  type Stretch = { pts: LngLat[]; n: number; m: number; max: number };
  const keep = (s: Stretch) => {
    if (s.m < MIN_STRETCH_M || s.n < MIN_STRETCH_POINTS) return;
    res.off.push(s.pts);
    res.offM += s.m;
    res.maxOffM = Math.max(res.maxOffM, s.max);
  };
  for (const seg of roundTrack.segments) {
    let cur: Stretch | null = null;
    for (let i = 0; i < seg.length; i++) {
      const p = seg[i], d = offBy(p);
      if (d > 0) {
        // a stretch starts at the last point still on the road
        cur ??= { pts: i > 0 ? [seg[i - 1]] : [], n: 0, m: 0, max: 0 };
        const last = cur.pts[cur.pts.length - 1];
        if (last) cur.m += step(last, p);
        cur.pts.push(p);
        cur.n++;
        cur.max = Math.max(cur.max, d);
      } else if (cur) {
        // back on the road: the stretch ends here
        cur.m += step(cur.pts[cur.pts.length - 1], p);
        cur.pts.push(p);
        keep(cur);
        cur = null;
      }
    }
    if (cur) keep(cur);
  }
  res.offM = Math.round(res.offM);
  res.maxOffM = Math.round(res.maxOffM);
  return res;
}
