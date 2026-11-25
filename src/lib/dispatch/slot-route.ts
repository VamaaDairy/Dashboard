import "server-only";
import { haversine, type Pt } from "@/lib/shop/route-plan";
import { olaEnabled, route } from "@/lib/shop/ola";
import type { LngLat } from "@/lib/shop/track";
import { ROUTES, type OffStop, type SheetStop } from "./slot-routes-data";

/**
 * The delivery rounds of the route sheet, each from Tumgaon depot and back. A customer cannot take their delivery
 * before their given time: a vehicle that gets there sooner waits, delivers at the given time, stays the hold time
 * (unloading) and drives on. So a stop is either on time or late, and lateness carries on down the round. A stop with
 * a window (9–11) is on time anywhere in it; a stop with no time is delivered when the vehicle gets there. The vehicle
 * leaves the depot so it reaches its first timed stop exactly on time. Ola Maps gives the road distance and driving
 * time. The stops go in the order of their given times; stops with the same time or none are placed to save km.
 */

export const DEPOT: SheetStop = { name: "Tumgaon depot", area: "Tumgaon", phone: null, segment: "", slot: "", open: null, close: null, hold: 0, lat: 21.085, lng: 81.985 };

export interface RouteTab { id: string; name: string; stops: number }
export const routeTabs = (): RouteTab[] => ROUTES.map((r) => ({ id: r.id, name: r.name, stops: r.stops.length }));

export interface Leg { from: number; to: number; metres: number; seconds: number; path: LngLat[] }
export interface Visit {
  stop: number;
  /** when the vehicle gets there */
  arrive: number;
  /** minutes it waits for the given time (it got there early) */
  waited: number;
  /** when it is delivered: the given time, or later when the vehicle is late */
  deliver: number;
  /** minutes after the given time (the end of a window) */
  late: number;
  leave: number;
}
export interface RoundPlan {
  order: number[]; legs: Leg[]; visits: Visit[]; metres: number; seconds: number;
  /** total minutes late over all stops, and how many stops are late */
  late: number; lateStops: number;
  /** minutes from midnight of the delivery day (before it: negative): leaving the depot, the last drop done, back */
  start: number; lastDrop: number; back: number;
}
export interface SlotRoutePlan {
  id: string; name: string;
  /** stops[0] is the depot */
  stops: SheetStop[];
  /** stops of the sheet not on this round, and why */
  off: OffStop[];
  /** false when no stop has a given time: the times are then from leaving the depot */
  timed: boolean;
  best: RoundPlan; road: boolean;
}

// ---------------------------------------------------------------------------------------------- Ola, kept

const KEEP_MS = 6 * 3600_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const legKept = new Map<string, { at: number; leg: Omit<Leg, "from" | "to"> | null }>();

/** The fastest road from a to b (the quickest of Ola's alternatives), kept six hours. Null when Ola could not say. */
async function roadLeg(a: Pt, b: Pt): Promise<Omit<Leg, "from" | "to"> | null> {
  const k = `${a.lat},${a.lng}|${b.lat},${b.lng}`;
  const kept = legKept.get(k);
  if (kept && Date.now() - kept.at < KEEP_MS && kept.leg) return kept.leg;
  if (!olaEnabled()) return null;
  // Ola allows only so many requests a minute: one more try after a pause
  const r = (await route(a, b, { fastest: true })) ?? (await sleep(12000), await route(a, b, { fastest: true }));
  const leg = r ? { metres: r.distanceM, seconds: r.durationS, path: r.points.map(([lat, lng]) => [lng, lat] as LngLat) } : null;
  legKept.set(k, { at: Date.now(), leg });
  return leg;
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

/** The total lateness and road metres (with the drive back) of visiting [order] (no depot) from the depot. */
function score(order: number[], stops: SheetStop[], metres: number[][], seconds: number[][]): [number, number] {
  let t = startFor(order, stops, seconds), prev = 0, late = 0, m = 0;
  for (const s of order) {
    const v = visit(t, seconds[prev][s] / 60, stops[s]);
    late += v.late; m += metres[prev][s]; t = v.leave; prev = s;
  }
  return [late, m + metres[prev][0]];
}

const better = (a: [number, number], b: [number, number]) => a[0] < b[0] - 1e-6 || (Math.abs(a[0] - b[0]) <= 1e-6 && a[1] < b[1] - 1e-6);

/**
 * The order: the given times in order, as the sheet sets them - a later given time never goes before an earlier one.
 * Stops with the same given time, and stops with no time (never before the first timed stop, so the vehicle does not
 * leave earlier for them), are placed for the least lateness, then the fewest road metres (with the drive back):
 * starting from each no-time stop where it adds least, then moving one stop elsewhere or turning a stretch round
 * while that helps and keeps the times in order.
 */
export function leastLateOrder(stops: SheetStop[], metres: number[][], seconds: number[][]): number[] {
  const cost = (o: number[]) => score(o, stops, metres, seconds);
  const ids = stops.map((_, i) => i).slice(1);
  const timed = ids.some((i) => stops[i].open != null);
  const inOrder = (o: number[]) => {
    if (timed && stops[o[0]].open == null) return false;
    let last = -Infinity;
    for (const s of o) {
      const t = stops[s].open;
      if (t == null) continue;
      if (t < last) return false;
      last = t;
    }
    return true;
  };

  // by the given times (a window by its start), then each stop with no time where it adds least
  const o = ids.filter((i) => stops[i].open != null).sort((a, b) => stops[a].open! - stops[b].open! || stops[a].close! - stops[b].close! || a - b);
  for (const s of ids.filter((i) => stops[i].open == null)) {
    let best: number[] | null = null, bc: [number, number] | null = null;
    for (let p = timed ? 1 : 0; p <= o.length; p++) {
      const t = [...o.slice(0, p), s, ...o.slice(p)], c = cost(t);
      if (!bc || better(c, bc)) { best = t; bc = c; }
    }
    o.splice(0, o.length, ...best!);
  }

  let order = o, c = cost(order);
  const consider = (t: number[]) => {
    if (!inOrder(t)) return false;
    const tc = cost(t);
    if (!better(tc, c)) return false;
    order = t; c = tc;
    return true;
  };
  for (let moved = true; moved;) {
    moved = false;
    // move one stop to another place
    for (let i = 0; i < order.length; i++) {
      for (let j = 0; j < order.length; j++) {
        if (i === j) continue;
        const t = [...order]; const [s] = t.splice(i, 1); t.splice(j, 0, s);
        if (consider(t)) moved = true;
      }
    }
    // drive a stretch the other way round
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        if (consider([...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)])) moved = true;
      }
    }
  }
  return [0, ...order];
}

/**
 * A round by road in this order and back to the depot: leave so the first timed stop is on time, never deliver early,
 * count the lateness. The last leg is the drive back to the depot.
 */
async function roundOf(order: number[], stops: SheetStop[], metres: number[][], seconds: number[][], road: boolean): Promise<RoundPlan> {
  const legs: Leg[] = [];
  const path = [...order, 0];
  for (let i = 1; i < path.length; i++) {
    const a = stops[path[i - 1]], b = stops[path[i]];
    const same = a.lat === b.lat && a.lng === b.lng;
    const got = road && !same ? await roadLeg(a, b) : null;
    legs.push(got
      ? { from: path[i - 1], to: path[i], ...got }
      : { from: path[i - 1], to: path[i], metres: metres[path[i - 1]][path[i]], seconds: seconds[path[i - 1]][path[i]], path: [[a.lng, a.lat], [b.lng, b.lat]] });
  }
  // the timings follow the roads drawn (Ola's fastest), from the same rule as the order
  const legSeconds = stops.map(() => Array<number>(stops.length).fill(0));
  legs.forEach((l) => { legSeconds[l.from][l.to] = l.seconds; });
  const start = startFor(order.slice(1), stops, legSeconds);
  let t = start;
  const visits: Visit[] = order.slice(1).map((s, i) => {
    const v = visit(t, legs[i].seconds / 60, stops[s]);
    t = v.leave;
    return { stop: s, ...v };
  });
  return {
    order, legs, visits, start, lastDrop: t, back: t + legs[legs.length - 1].seconds / 60,
    late: visits.reduce((x, v) => x + v.late, 0), lateStops: visits.filter((v) => v.late >= 0.5).length,
    metres: legs.reduce((x, l) => x + l.metres, 0), seconds: legs.reduce((x, l) => x + l.seconds, 0),
  };
}

const planKept = new Map<string, { at: number; plan: SlotRoutePlan }>();

/** One route's round: the least-late order, by road. Kept six hours (working it out takes up to a minute). */
export async function slotRoutePlan(id: string): Promise<SlotRoutePlan | null> {
  const sheet = ROUTES.find((r) => r.id === id);
  if (!sheet) return null;
  const kept = planKept.get(id);
  if (kept && Date.now() - kept.at < KEEP_MS) return kept.plan;
  const stops = [DEPOT, ...sheet.stops];
  const m = await roadMatrix(id, stops);
  const road = !!m;
  // without Ola: straight line x 1.3 at 30 km/h, so the page still says something
  const metres = m?.metres ?? stops.map((a) => stops.map((b) => haversine(a, b) * 1.3));
  const seconds = m?.seconds ?? metres.map((row) => row.map((v) => (v / 1000 / 30) * 3600));
  const order = leastLateOrder(stops, metres, seconds);
  const plan: SlotRoutePlan = {
    id: sheet.id, name: sheet.name, stops, off: sheet.off, road,
    timed: sheet.stops.some((s) => s.open != null),
    best: await roundOf(order, stops, metres, seconds, road),
  };
  if (road) planKept.set(id, { at: Date.now(), plan });
  return plan;
}
