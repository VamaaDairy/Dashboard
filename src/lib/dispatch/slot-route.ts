import "server-only";
import { haversine, type Pt } from "@/lib/shop/route-plan";
import { olaEnabled, route, routeVia } from "@/lib/shop/ola";
import type { LngLat } from "@/lib/shop/track";
import { ROUTES, type OffStop, type SheetStop, type SuggestedStop } from "./slot-routes-data";

/**
 * The delivery rounds of the route sheet, each from Tumgaon depot and back. A customer cannot take their delivery
 * before their given time: a vehicle that gets there sooner waits, delivers at the given time, stays the hold time
 * (unloading) and drives on. So a stop is either on time or late, and lateness carries on down the round. A stop with
 * a window (9–11) is on time anywhere in it; a stop with no time is delivered when the vehicle gets there. The vehicle
 * leaves the depot so it reaches its first timed stop exactly on time. Ola Maps gives the road distance and driving
 * time. The sheet's route goes in the order of the given times; the other options keep the times in another order,
 * or change the times for fewer km or less driving.
 */

export const DEPOT: SheetStop = { name: "Tumgaon depot", area: "Tumgaon", phone: null, segment: "", slot: "", open: null, close: null, hold: 0, lat: 21.085, lng: 81.985 };

export interface RouteTab { id: string; name: string; stops: number }
export const routeTabs = (): RouteTab[] => ROUTES.map((r) => ({ id: r.id, name: r.name, stops: r.stops.length }));

export interface Leg { from: number; to: number; metres: number; seconds: number }
export interface Visit {
  stop: number;
  /** when the vehicle gets there */
  arrive: number;
  /** minutes it waits for the given time (it got there early) */
  waited: number;
  /** when it is delivered: the given time, or later when the vehicle is late; on a route with new times, on arrival */
  deliver: number;
  /** minutes after the given time (the end of a window) */
  late: number;
  leave: number;
  /** on a route with new times: the new time against the given one, in minutes (+ later, - earlier); null with no given time */
  shift: number | null;
  /** on a route with delivery windows: the suggested time the window is centred on */
  target?: number;
}
export interface RoundPlan {
  order: number[]; legs: Leg[]; visits: Visit[]; metres: number; seconds: number;
  /** total minutes late over all stops, and how many stops are late (0 on a route with new times) */
  late: number; lateStops: number;
  /** delivered when the vehicle gets there: the times change to these */
  newTimes: boolean;
  /** minutes from midnight of the delivery day (before it: negative): leaving the depot, the last drop done, back */
  start: number; lastDrop: number; back: number;
}
/** One way to run the route: the sheet's, the same times in another order, or another order with new times. */
export interface RouteOption {
  key: string; title: string; note: string; round: RoundPlan;
  /** a delivery window of this many minutes either side of each stop's time (the suggested route) */
  window?: number;
  /** the windows are shown for reference only: delivered on arrival */
  onHold?: boolean;
}
export interface SlotRoutePlan {
  id: string; name: string;
  /** stops[0] is the depot */
  stops: SheetStop[];
  /** stops of the sheet not on this route, and why */
  off: OffStop[];
  /** false when no stop has a given time: the times are then from leaving the depot */
  timed: boolean;
  /** options[0] is the sheet's own: the given times in order */
  options: RouteOption[];
  road: boolean;
}

// ---------------------------------------------------------------------------------------------- Ola, kept

const KEEP_MS = 6 * 3600_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const legKept = new Map<string, { at: number; road: { path: LngLat[]; metres: number; seconds: number } | null }>();

/** The road from a to b - the shortest of Ola's alternatives (fewest km) - with its km and time, kept six hours. Null when Ola could not say. */
async function road(a: Pt, b: Pt): Promise<{ path: LngLat[]; metres: number; seconds: number } | null> {
  const k = `${a.lat},${a.lng}|${b.lat},${b.lng}`;
  const kept = legKept.get(k);
  if (kept && Date.now() - kept.at < KEEP_MS && kept.road) return kept.road;
  if (!olaEnabled()) return null;
  // Ola allows only so many requests a minute: one more try after a pause
  const ask = async (x: Pt, y: Pt) => (await route(x, y, { shortest: true })) ?? (await sleep(12000), await route(x, y, { shortest: true }));
  let r: { points: Array<[number, number]>; distanceM: number; durationS: number } | null = await ask(a, b);
  // Ola's alternatives can all miss a short road (a divided highway sends the car up to a U-turn). When the road back
  // from b is clearly shorter, also try a to b through the middle of that road, and keep the fewer km.
  if (r) {
    const backKey = `${b.lat},${b.lng}|${a.lat},${a.lng}`;
    const keptBack = legKept.get(backKey);
    const back = keptBack && Date.now() - keptBack.at < KEEP_MS && keptBack.road
      ? { points: keptBack.road.path.map(([lng, lat]) => [lat, lng] as [number, number]), distanceM: keptBack.road.metres, durationS: keptBack.road.seconds }
      : await ask(b, a);
    // the road back is itself the shortest Ola offers that way: keep it for when the round drives b to a
    if (back && !keptBack) legKept.set(backKey, { at: Date.now(), road: { path: back.points.map(([lat, lng]) => [lng, lat] as LngLat), metres: back.distanceM, seconds: back.durationS } });
    if (back && back.distanceM < r.distanceM * 0.9 && back.points.length > 2) {
      const [lat, lng] = back.points[Math.floor(back.points.length / 2)];
      const via = await routeVia(a, [{ lat, lng }], b).catch(() => null);
      if (via && via.distanceM < r.distanceM) r = via;
    }
  }
  const got = r ? { path: r.points.map(([lat, lng]) => [lng, lat] as LngLat), metres: r.distanceM, seconds: r.durationS } : null;
  legKept.set(k, { at: Date.now(), road: got });
  return got;
}
const roadPath = async (a: Pt, b: Pt) => (await road(a, b))?.path ?? null;

/**
 * The route each tab opens on, on the shortest roads: each stretch's km and time become those of the shortest of
 * Ola's alternatives, and the times down the round follow (delivered on arrival when times are on hold, otherwise
 * waiting for a window as before). The order stays as worked out from Ola's distance matrix.
 */
async function onShortestRoads(option: RouteOption, stops: SheetStop[]): Promise<void> {
  const r = option.round;
  const legs = await Promise.all(r.legs.map(async (l) => {
    const a = stops[l.from], b = stops[l.to];
    if (a.lat === b.lat && a.lng === b.lng) return l;
    const got = await road(a, b);
    return got ? { ...l, metres: got.metres, seconds: got.seconds } : l;
  }));
  let t = r.start;
  const visits = r.visits.map((v, i) => {
    const st = stops[v.stop];
    const arrive = t + legs[i].seconds / 60;
    let deliver = arrive;
    if (!option.onHold && option.window != null && v.target != null) deliver = Math.max(arrive, v.target - option.window);
    else if (!option.onHold && !r.newTimes && st.open != null) deliver = Math.max(arrive, st.open);
    const late = option.window != null && v.target != null && !option.onHold
      ? Math.max(0, deliver - (v.target + option.window))
      : !r.newTimes && st.close != null ? Math.max(0, deliver - st.close) : 0;
    t = deliver + st.hold;
    return { ...v, arrive, waited: deliver - arrive, deliver, late, leave: t, shift: st.open == null ? null : deliver - st.open };
  });
  option.round = {
    ...r, legs, visits, lastDrop: t, back: t + legs[legs.length - 1].seconds / 60,
    metres: legs.reduce((x, l) => x + l.metres, 0), seconds: legs.reduce((x, l) => x + l.seconds, 0),
    late: visits.reduce((x, v) => x + v.late, 0), lateStops: visits.filter((v) => v.late >= 0.5).length,
  };
}

type Matrix = { metres: number[][]; seconds: number[][] };
const matrixKept = new Map<string, { at: number; m: Matrix }>();

/** Road metres and seconds between every pair of points: Ola's distance matrix, 5 x 10 pairs a request (its limit). */
async function roadMatrix(id: string, pts: Pt[]): Promise<Matrix | null> {
  const kept = matrixKept.get(id);
  if (kept && Date.now() - kept.at < KEEP_MS) return kept.m;
  if (!olaEnabled()) return null;
  const n = pts.length;
  const metres = pts.map(() => Array<number>(n).fill(NaN)), seconds = pts.map(() => Array<number>(n).fill(NaN));
  for (let i = 0; i < n; i += 5) {
    for (let k = 0; k < n; k += 10) {
      const url = new URL("https://api.olamaps.io/routing/v1/distanceMatrix");
      url.searchParams.set("origins", pts.slice(i, i + 5).map((p) => `${p.lat},${p.lng}`).join("|"));
      url.searchParams.set("destinations", pts.slice(k, k + 10).map((p) => `${p.lat},${p.lng}`).join("|"));
      url.searchParams.set("mode", "driving");
      url.searchParams.set("api_key", process.env.OLA_MAPS_API_KEY ?? "");
      let r: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        r = await fetch(url, { headers: { "X-Request-Id": crypto.randomUUID() }, signal: AbortSignal.timeout(15000), cache: "no-store" }).catch(() => null);
        if (r && r.status !== 429) break;
        await sleep(10000 * (attempt + 1));
      }
      if (!r?.ok) { console.error("slot route matrix", r?.status); return null; }
      const j = (await r.json()) as { rows?: Array<{ elements?: Array<{ distance?: number; duration?: number }> }> };
      j.rows?.forEach((row, a) => row.elements?.forEach((e, b) => {
        if (typeof e?.distance === "number") metres[i + a][k + b] = e.distance;
        if (typeof e?.duration === "number") seconds[i + a][k + b] = e.duration;
      }));
    }
  }
  // the same spot twice (two shops at one pin) is 0 apart
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a === b || (pts[a].lat === pts[b].lat && pts[a].lng === pts[b].lng)) { metres[a][b] = 0; seconds[a][b] = 0; }
  if (metres.some((row) => row.some((v) => !(v >= 0)))) return null;
  matrixKept.set(id, { at: Date.now(), m: { metres, seconds } });
  return { metres, seconds };
}

// ---------------------------------------------------------------------------------------------- the order

/** Never early: wait for the given time, deliver, stay the hold time. No given time: deliver on arrival. */
function visit(t: number, travelMin: number, s: SheetStop) {
  const arrive = t + travelMin;
  const deliver = s.open == null ? arrive : Math.max(arrive, s.open);
  const late = s.close == null ? 0 : Math.max(0, deliver - s.close);
  return { arrive, deliver, late, waited: deliver - arrive, leave: deliver + s.hold };
}

/** When to leave the depot so the first stop with a given time is reached exactly then (0 when none has one). */
function startFor(order: number[], stops: SheetStop[], seconds: number[][]): number {
  let drive = 0, prev = 0;
  for (const s of order) {
    drive += seconds[prev][s] / 60;
    if (stops[s].open != null) return stops[s].open! - drive;
    drive += stops[s].hold;
    prev = s;
  }
  return 0;
}

/** The total lateness and road metres (with the drive back) of keeping the given times in [order] (no depot). */
function lateness(order: number[], stops: SheetStop[], metres: number[][], seconds: number[][]): [number, number] {
  let t = startFor(order, stops, seconds), prev = 0, late = 0, m = 0;
  for (const s of order) {
    const v = visit(t, seconds[prev][s] / 60, stops[s]);
    late += v.late; m += metres[prev][s]; t = v.leave; prev = s;
  }
  return [late, m + metres[prev][0]];
}

/** Road totals of [order] (no depot) and back: by [a] first, then [b]. */
const along = (a: number[][], b: number[][]) => (order: number[]): [number, number] => {
  let x = 0, y = 0, prev = 0;
  for (const s of [...order, 0]) { x += a[prev][s]; y += b[prev][s]; prev = s; }
  return [x, y];
};

const better = (a: [number, number], b: [number, number]) => a[0] < b[0] - 1e-6 || (Math.abs(a[0] - b[0]) <= 1e-6 && a[1] < b[1] - 1e-6);

/** Moves one stop elsewhere, or drives a stretch the other way round, while that lowers [cost] (and keeps [ok]). */
function improve(start: number[], cost: (o: number[]) => [number, number], ok: (o: number[]) => boolean = () => true): { o: number[]; c: [number, number] } {
  let o = start, c = cost(o);
  const consider = (t: number[]) => {
    if (!ok(t)) return false;
    const tc = cost(t);
    if (!better(tc, c)) return false;
    o = t; c = tc;
    return true;
  };
  for (let moved = true; moved;) {
    moved = false;
    for (let i = 0; i < o.length; i++) {
      for (let j = 0; j < o.length; j++) {
        if (i === j) continue;
        const t = [...o]; const [s] = t.splice(i, 1); t.splice(j, 0, s);
        if (consider(t)) moved = true;
      }
    }
    for (let i = 0; i < o.length - 1; i++) {
      for (let j = i + 1; j < o.length; j++) {
        if (consider([...o.slice(0, i), ...o.slice(i, j + 1).reverse(), ...o.slice(j + 1)])) moved = true;
      }
    }
  }
  return { o, c };
}

/** Each no-time stop where it adds least to [cost], never before the first timed stop. */
function placeNoTime(o: number[], stops: SheetStop[], cost: (o: number[]) => [number, number]): number[] {
  const timed = o.length > 0;
  for (const s of stops.map((_, i) => i).slice(1).filter((i) => stops[i].open == null)) {
    let best: number[] | null = null, bc: [number, number] | null = null;
    for (let p = timed ? 1 : 0; p <= o.length; p++) {
      const t = [...o.slice(0, p), s, ...o.slice(p)], c = cost(t);
      if (!bc || better(c, bc)) { best = t; bc = c; }
    }
    o = best!;
  }
  return o;
}

/**
 * The sheet's route: the given times in order - a later given time never goes before an earlier one. Stops with the
 * same given time, and stops with no time (never before the first timed stop, so the vehicle does not leave earlier
 * for them), are placed for the least lateness, then the fewest road metres (with the drive back).
 */
export function sheetOrder(stops: SheetStop[], metres: number[][], seconds: number[][]): number[] {
  const cost = (o: number[]) => lateness(o, stops, metres, seconds);
  const timedIds = stops.map((_, i) => i).slice(1).filter((i) => stops[i].open != null);
  const inOrder = (o: number[]) => {
    if (timedIds.length && stops[o[0]].open == null) return false;
    let last = -Infinity;
    for (const s of o) {
      const t = stops[s].open;
      if (t == null) continue;
      if (t < last) return false;
      last = t;
    }
    return true;
  };
  const byTime = timedIds.sort((a, b) => stops[a].open! - stops[b].open! || stops[a].close! - stops[b].close! || a - b);
  return [0, ...improve(placeNoTime(byTime, stops, cost), cost, inOrder).o];
}

/** The given times kept, in any order: the least lateness, then the fewest metres. Null on a route with no times. */
function keepTimesOrder(sheet: number[], stops: SheetStop[], metres: number[][], seconds: number[][]): number[] | null {
  if (!stops.some((s) => s.open != null)) return null;
  const cost = (o: number[]) => lateness(o, stops, metres, seconds);
  const firstTimed = (o: number[]) => stops[o[0]].open != null;
  return [0, ...improve(sheet.slice(1), cost, firstTimed).o];
}

/** With new times: delivered on arrival, or - more than [early] minutes before the given time - it waits till then. */
function newTime(arrive: number, st: SheetStop, early: number) {
  const deliver = st.open == null ? arrive : Math.max(arrive, st.open - early);
  const shift = st.open == null ? null : deliver < st.open ? deliver - st.open : deliver > st.close! ? deliver - st.close! : 0;
  return { deliver, shift };
}

/** How far each new time is from the given one (0 inside a window), leaving at [start]. */
function shifts(order: number[], stops: SheetStop[], seconds: number[][], start: number, early: number): Array<number | null> {
  let t = start, prev = 0;
  return order.map((s) => {
    const v = newTime(t + seconds[prev][s] / 60, stops[s], early);
    t = v.deliver + stops[s].hold; prev = s;
    return v.shift;
  });
}

/**
 * New times that move at most [limit] minutes from the given ones: the fewest km within that. Starts from the sheet's
 * order and changes it while the minutes beyond the limit (over all stops) do not grow, then the km fall.
 */
function boundedOrder(sheet: number[], stops: SheetStop[], metres: number[][], seconds: number[][], start: number, limit: number): number[] {
  const km = along(metres, seconds);
  const cost = (o: number[]): [number, number] => [
    shifts(o, stops, seconds, start, limit).reduce((x: number, v) => x + (v == null ? 0 : Math.max(0, Math.abs(v) - limit)), 0),
    km(o)[0],
  ];
  return [0, ...improve(sheet.slice(1), cost).o];
}

/**
 * How many drives from one place to the next of [a] are not in [b] - shops at one spot (or within ~300 m) are one
 * place, so swapping them is not a different route. Two routes count as different options from 3 on.
 */
const differs = (stops: SheetStop[], a: number[], b: number[]) => {
  const place = (s: number) => `${stops[s].lat.toFixed(3)},${stops[s].lng.toFixed(3)}`;
  const drives = (o: number[]) => [...o, 0].map(place).filter((p, i, all) => i === 0 || p !== all[i - 1]).map((p, i, all) => `${p}>${all[i + 1] ?? ""}`);
  const next = new Set(drives(b));
  return drives(a).filter((d) => !next.has(d)).length;
};

/**
 * Orders by [cost] alone, the times free: from every stop as the first, the nearest stop each time, then improved.
 * The distinct ones, best first.
 */
function freeOrders(stops: SheetStop[], metres: number[][], cost: (o: number[]) => [number, number]): Array<{ order: number[]; c: [number, number] }> {
  const ids = stops.map((_, i) => i).slice(1);
  const found: Array<{ order: number[]; c: [number, number] }> = [];
  for (const first of ids) {
    const o = [first];
    for (let prev = first, left = new Set(ids.filter((i) => i !== first)); left.size;) {
      const s = [...left].reduce((a, b) => (metres[prev][b] < metres[prev][a] ? b : a));
      o.push(s); left.delete(s); prev = s;
    }
    const r = improve(o, cost);
    const order = [0, ...r.o];
    if (!found.some((f) => f.order.join() === order.join())) found.push({ order, c: r.c });
  }
  return found.sort((a, b) => (better(a.c, b.c) ? -1 : better(b.c, a.c) ? 1 : 0));
}

/**
 * A route in this order and back to the depot. Keeping the given times: leave so the first timed stop is on time,
 * never deliver early, count the lateness. With new times: leave at [start] and deliver each stop on arrival.
 */
function roundOf(order: number[], stops: SheetStop[], metres: number[][], seconds: number[][], newTimes: { start: number; early: number } | null): RoundPlan {
  const path = [...order, 0];
  const legs: Leg[] = path.slice(1).map((to, i) => ({ from: path[i], to, metres: metres[path[i]][to], seconds: seconds[path[i]][to] }));
  const start = newTimes?.start ?? startFor(order.slice(1), stops, seconds);
  let t = start;
  const visits: Visit[] = order.slice(1).map((s, i) => {
    const st = stops[s];
    if (newTimes == null) {
      const v = visit(t, legs[i].seconds / 60, st);
      t = v.leave;
      return { stop: s, ...v, shift: null };
    }
    const arrive = t + legs[i].seconds / 60;
    const { deliver, shift } = newTime(arrive, st, newTimes.early);
    t = deliver + st.hold;
    return { stop: s, arrive, waited: deliver - arrive, deliver, late: 0, leave: t, shift };
  });
  return {
    order, legs, visits, start, lastDrop: t, back: t + legs[legs.length - 1].seconds / 60, newTimes: newTimes != null,
    late: visits.reduce((x, v) => x + v.late, 0), lateStops: visits.filter((v) => v.late >= 0.5).length,
    metres: legs.reduce((x, l) => x + l.metres, 0), seconds: legs.reduce((x, l) => x + l.seconds, 0),
  };
}


/**
 * The suggested route as planned in its sheet: the stops in that order, each at its suggested time, leaving the depot
 * when the sheet's route does. Km and driving are Ola's for this order. Null when a stop of the sheet is not on the route.
 */
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/** The suggested stops' indexes in [stops], in the suggested order; null when they are not exactly the route's stops. */
function suggestedIds(list: SuggestedStop[], stops: SheetStop[]): number[] | null {
  const ids = list.map((x) => stops.findIndex((s, i) => i > 0 && s.name === x.name));
  return ids.some((i) => i < 1) || new Set(ids).size !== stops.length - 1 ? null : ids;
}

function suggestedRound(list: SuggestedStop[], stops: SheetStop[], metres: number[][], seconds: number[][], start: number): RoundPlan | null {
  const ids = suggestedIds(list, stops);
  if (!ids) return null;
  const round = roundOf([0, ...ids], stops, metres, seconds, { start, early: Infinity });
  let t = start;
  round.visits = round.visits.map((v, i) => {
    const st = stops[v.stop];
    const arrive = t + round.legs[i].seconds / 60;
    const deliver = toMin(list[i].time);
    t = Math.max(arrive, deliver) + st.hold;
    return { ...v, arrive, waited: Math.max(0, deliver - arrive), deliver, leave: t, late: 0, shift: st.open == null ? null : deliver - st.open, target: deliver };
  });
  round.lastDrop = t;
  round.back = t + round.legs[round.legs.length - 1].seconds / 60;
  return round;
}

/**
 * The shortest round that keeps every stop inside its window (its suggested time ± [win] minutes): a vehicle there
 * before the window waits for it, and is delivered on arrival inside it. Any order: the fewest minutes outside the
 * windows first, then the fewest km, then the least driving - tried from the suggested order and from every
 * nearest-next order, the best kept. Leaves the depot at [start].
 */
function bestWindowRound(list: SuggestedStop[], stops: SheetStop[], metres: number[][], seconds: number[][], start: number, win: number, fixed?: string[], timesOnHold = false, last?: string[]): RoundPlan | null {
  const ids = suggestedIds(list, stops);
  if (!ids) return null;
  // stops set by hand go first, in that order; the rest are ordered after them
  const head = fixed?.map((n) => stops.findIndex((s, i) => i > 0 && s.name === n)) ?? [];
  // stops set by hand to end the round, in that order
  const tail = last?.map((n) => stops.findIndex((s, i) => i > 0 && s.name === n)) ?? [];
  if ([...head, ...tail].some((i) => i < 1) || new Set([...head, ...tail]).size !== head.length + tail.length) return null;
  const target = new Map(ids.map((s, i) => [s, toMin(list[i].time)]));
  const walk = (o: number[]) => {
    let t = start, prev = 0, out = 0;
    const vs = o.map((s) => {
      const arrive = t + seconds[prev][s] / 60, c = target.get(s)!;
      // times on hold: delivered on arrival, never waiting for a window
      const deliver = timesOnHold ? arrive : Math.max(arrive, c - win);
      out += Math.max(0, deliver - (c + win));
      t = deliver + stops[s].hold; prev = s;
      return { s, arrive, deliver, leave: t };
    });
    return { vs, out };
  };
  const km = along(metres, seconds);
  // minutes outside the windows, then km with driving time as the tie-break (1 s counts as 1 cm)
  const cost = (o: number[]): [number, number] => { const [m, sec] = km(o); return [timesOnHold ? 0 : walk(o).out, m + sec / 100]; };
  let best: { o: number[]; c: [number, number] } | null = null;
  if (head.length) {
    // only the stops after the hand-set ones move: from the suggested order, and from the nearest stop each time
    const rest = ids.filter((s) => !head.includes(s) && !tail.includes(s));
    const nearest: number[] = [];
    for (let prev = head[head.length - 1], left = new Set(rest); left.size;) {
      const s = [...left].reduce((a, b) => (metres[prev][b] < metres[prev][a] ? b : a));
      nearest.push(s); left.delete(s); prev = s;
    }
    for (const o of [rest, nearest]) {
      const r = improve(o, (t) => cost([...head, ...t, ...tail]));
      const full = { o: [...head, ...r.o, ...tail], c: r.c };
      if (!best || better(full.c, best.c)) best = full;
    }
  } else {
    const starts = [ids, ...freeOrders(stops, metres, along(metres, seconds)).map((f) => f.order.slice(1))];
    for (const o of starts) {
      const r = improve(o, cost);
      if (!best || better(r.c, best.c)) best = r;
    }
  }
  const order = [0, ...best!.o];
  const round = roundOf(order, stops, metres, seconds, { start, early: Infinity });
  const { vs } = walk(best!.o);
  round.visits = round.visits.map((v, i) => {
    const w = vs[i], st = stops[v.stop], c = target.get(v.stop)!;
    return { ...v, arrive: w.arrive, waited: w.deliver - w.arrive, deliver: w.deliver, leave: w.leave, late: Math.max(0, w.deliver - (c + win)), shift: st.open == null ? null : w.deliver - st.open, target: c };
  });
  round.late = round.visits.reduce((x, v) => x + v.late, 0);
  round.lateStops = round.visits.filter((v) => v.late >= 0.5).length;
  round.lastDrop = vs[vs.length - 1].leave;
  round.back = round.lastDrop + round.legs[round.legs.length - 1].seconds / 60;
  return round;
}

/** How many routes with new times to offer, besides the fastest. */
const SHORT_OPTIONS = 4;

/**
 * Every way to run the route worth showing: the sheet's (the given times in order), the given times in the order
 * with the least lateness, and routes with new delivery times - the fewest km, other short ones different enough
 * to be a real choice, and the least driving. New times leave the depot when the sheet's route does.
 */
function optionsFor(stops: SheetStop[], metres: number[][], seconds: number[][], timed: boolean, suggested?: SuggestedStop[], win = 30, planned?: string[], timesOnHold = false, plannedLast?: string[]): RouteOption[] {
  const sheet = sheetOrder(stops, metres, seconds);
  const sheetRound = roundOf(sheet, stops, metres, seconds, null);
  const out: RouteOption[] = [{
    key: "sheet", title: timed ? "As per sheet" : "Fewest km",
    note: timed ? "Your given times, in their order." : "No given times on this route: the fewest km.",
    round: sheetRound,
  }];
  const taken = [sheet];
  const sug = suggested && timed ? suggestedRound(suggested, stops, metres, seconds, sheetRound.start) : null;
  if (sug) {
    out.push({
      key: "suggested", title: `Suggested ±${win} min`, window: win, round: sug,
      note: `The suggested route: each stop at its new time, delivered any time from ${win} min before to ${win} min after it.`,
    });
    taken.push(sug.order);
    const own = planned ? bestWindowRound(suggested!, stops, metres, seconds, sheetRound.start, win, planned, timesOnHold, plannedLast) : null;
    if (own) {
      out.push({
        key: "planned", title: timesOnHold ? "Your route" : `Your route ±${win} min`, window: win, onHold: timesOnHold, round: own,
        note: timesOnHold
          ? `The first ${planned!.length}${plannedLast?.length ? ` and last ${plannedLast.length}` : ""} stops in the order set for this route, the rest for the fewest km. Times on hold: every stop delivered when the vehicle gets there; the ±${win} min windows are shown for reference.`
          : `The first ${planned!.length} stops in the order set for this route, the rest for the fewest km; each stop within ${win} min of its suggested time (a vehicle there before the window waits for it).`,
      });
      taken.push(own.order);
    }
    const best = bestWindowRound(suggested!, stops, metres, seconds, sheetRound.start, win);
    if (best && best.order.join() !== sug.order.join() && best.order.join() !== own?.order.join()) {
      out.push({
        key: "best", title: `Best in ±${win} min`, window: win, round: best,
        note: `The shortest and quickest round that keeps every stop within ${win} min of its suggested time: a vehicle there before the window waits for it.`,
      });
      taken.push(best.order);
    }
  }
  const fresh = (o: number[]) => taken.every((t) => differs(stops, o, t) >= 3);

  const keep = keepTimesOrder(sheet, stops, metres, seconds);
  if (keep && fresh(keep)) {
    out.push({ key: "keep", title: "Same times, new order", note: "Your given times stay; the order changes for the least lateness, then the fewest km.", round: roundOf(keep, stops, metres, seconds, null) });
    taken.push(keep);
  }

  const leave = timed ? sheetRound.start : 0;
  // times that may move a little: the fewest km keeping each within a limit (a vehicle much too early waits). Shown
  // when it saves km and no other such option moves the times less with fewer km; named by how far they really move.
  if (timed) {
    const found = [30, 60, 120].map((limit) => {
      const order = boundedOrder(sheet, stops, metres, seconds, leave, limit);
      const round = roundOf(order, stops, metres, seconds, { start: leave, early: limit });
      return { limit, order, round, most: Math.ceil(Math.max(0, ...round.visits.map((v) => Math.abs(v.shift ?? 0))) / 5) * 5 };
    });
    const kept = found
      .filter((f) => sheetRound.metres - f.round.metres >= 1000)
      .filter((f) => !found.some((g) => g !== f && g.most <= f.most && g.round.metres <= f.round.metres && (g.most < f.most || g.round.metres < f.round.metres)))
      .sort((a, b) => a.most - b.most);
    for (const f of kept) {
      if (!fresh(f.order)) continue;
      const label = f.most < 60 ? `${f.most} min` : `${Math.floor(f.most / 60)} hr${f.most % 60 ? ` ${f.most % 60} min` : ""}`;
      out.push({
        key: `move${f.limit}`, title: `Times move ≤ ${label}`,
        note: `New delivery times, none more than ${label} from the given time; the fewest km within that. A vehicle much too early waits. Leaving the depot at the sheet's time.`,
        round: f.round,
      });
      taken.push(f.order);
    }
  }
  const timesNote = timed ? ` Delivery times change to when the vehicle gets there, leaving the depot at the sheet's time.` : "";
  const short = freeOrders(stops, metres, along(metres, seconds));
  let n = 0;
  for (const { order } of short) {
    if (n >= SHORT_OPTIONS) break;
    if (!fresh(order)) continue;
    out.push({
      key: `km${n}`, title: n === 0 ? "Shortest" : `Short route ${n + 1}`,
      note: (n === 0 ? "The fewest km." : "Another short way round, a different order.") + timesNote,
      round: roundOf(order, stops, metres, seconds, { start: leave, early: Infinity }),
    });
    taken.push(order);
    n++;
  }
  // the shortest loop the other way round: about the same km, other customers early
  const back = short[0] ? [0, ...short[0].order.slice(1).reverse()] : null;
  if (back && fresh(back)) {
    out.push({ key: "back", title: "Shortest, other way round", note: "The shortest loop driven the other way." + timesNote, round: roundOf(back, stops, metres, seconds, { start: leave, early: Infinity }) });
    taken.push(back);
  }
  const fastest = freeOrders(stops, metres, along(seconds, metres))[0]?.order;
  if (fastest && fresh(fastest)) {
    out.push({ key: "fast", title: "Fastest", note: "The least driving time." + timesNote, round: roundOf(fastest, stops, metres, seconds, { start: leave, early: Infinity }) });
  }
  return out;
}

const planKept = new Map<string, { at: number; plan: SlotRoutePlan }>();

/** One route's options, by road. Kept six hours (working it out takes up to a minute). */
export async function slotRoutePlan(id: string): Promise<SlotRoutePlan | null> {
  const sheet = ROUTES.find((r) => r.id === id);
  if (!sheet) return null;
  const kept = planKept.get(id);
  if (kept && Date.now() - kept.at < KEEP_MS) return kept.plan;
  const stops = [sheet.depot ?? DEPOT, ...sheet.stops];
  const m = await roadMatrix(id, stops);
  const roadOk = !!m;
  // without Ola: straight line x 1.3 at 30 km/h, so the page still says something
  const metres = m?.metres ?? stops.map((a) => stops.map((b) => haversine(a, b) * 1.3));
  const seconds = m?.seconds ?? metres.map((row) => row.map((v) => (v / 1000 / 30) * 3600));
  const timed = sheet.stops.some((s) => s.open != null);
  const plan: SlotRoutePlan = { id: sheet.id, name: sheet.name, stops, off: sheet.off, road: roadOk, timed, options: optionsFor(stops, metres, seconds, timed, sheet.suggested, sheet.window, sheet.planned, sheet.timesOnHold, sheet.plannedLast) };
  // the route the tab opens on: km, time and arrivals on the shortest roads (the ones drawn on the map)
  const first = plan.options.find((o) => o.key === "planned") ?? plan.options.find((o) => o.key === "best");
  if (roadOk && first) await onShortestRoads(first, stops);
  if (roadOk) planKept.set(id, { at: Date.now(), plan });
  return plan;
}

/** The roads to draw for a route in this order and back (straight lines where Ola cannot say). */
export async function slotRoutePaths(id: string, order: number[]): Promise<LngLat[][] | null> {
  const sheet = ROUTES.find((r) => r.id === id);
  if (!sheet) return null;
  const stops = [sheet.depot ?? DEPOT, ...sheet.stops];
  // only a full round of this route's stops
  if (order[0] !== 0 || order.length !== stops.length || new Set(order).size !== stops.length || order.some((s) => !Number.isInteger(s) || s < 0 || s >= stops.length)) return null;
  const path = [...order, 0];
  const out: LngLat[][] = [];
  for (let i = 1; i < path.length; i++) {
    const a = stops[path[i - 1]], b = stops[path[i]];
    const same = a.lat === b.lat && a.lng === b.lng;
    out.push((!same && (await roadPath(a, b))) || [[a.lng, a.lat], [b.lng, b.lat]]);
  }
  return out;
}
