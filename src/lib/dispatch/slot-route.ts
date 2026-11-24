import "server-only";
import { haversine, type Pt } from "@/lib/shop/route-plan";
import { olaEnabled, route } from "@/lib/shop/ola";
import type { LngLat } from "@/lib/shop/track";

/**
 * One delivery round with time slots from Tumgaon depot. A customer cannot take their delivery before their given time:
 * a vehicle that gets there sooner waits, delivers at the given time, stays the hold time (unloading) and drives on.
 * So a stop is either on time or late, and lateness carries on down the round. The vehicle leaves the depot so it
 * reaches its first stop exactly at that stop's time. Ola Maps gives the road distance and driving time; every order
 * is weighed for the least total lateness, then the fewest km. After the last delivery it drives back to the depot.
 */

export interface SlotStop { name: string; area: string; phone: string | null; slot: string; hold: number; lat: number; lng: number }

/** The depot and the customers from the delivery sheet: reach by [slot], stay [hold] minutes. */
export const STOPS: SlotStop[] = [
  { name: "Tumgaon depot", area: "Tumgaon", phone: null, slot: "", hold: 0, lat: 21.085, lng: 81.985 },
  { name: "Deepak Kumar Sharma", area: "Fundhar", phone: "9399855783", slot: "3:00", hold: 5, lat: 21.2174781, lng: 81.6923535 },
  { name: "Anand Milk Agency", area: "Pachpedi Naka", phone: "9827851997", slot: "3:30", hold: 5, lat: 21.2190794, lng: 81.6517618 },
  { name: "Santosh Kumar Sagar", area: "Telibandha", phone: "9009450020", slot: "4:00", hold: 5, lat: 21.2333121, lng: 81.6625637 },
  { name: "Modi Tea Stall", area: "Railway Station", phone: "7000249233", slot: "4:15", hold: 5, lat: 21.2528925, lng: 81.6273945 },
  { name: "Milky Way Dairy Raipur", area: "Purani Basti", phone: "9300772375", slot: "4:30", hold: 5, lat: 21.2334886, lng: 81.628395 },
  { name: "Jai Maa Bhagwati Daily Needs", area: "Raipura", phone: "9131497817", slot: "5:00", hold: 10, lat: 21.2118717, lng: 81.5997954 },
  { name: "NEMRAS & co", area: "Devendra Nagar", phone: "9131713145", slot: "5:30", hold: 5, lat: 21.26148658, lng: 81.63992699 },
  { name: "Ramkrishna Kirana Shop", area: "Shankar Nagar", phone: "7974498364", slot: "5:40", hold: 5, lat: 21.2569047, lng: 81.6625435 },
  { name: "Ganga Prashad Enterprise", area: "Transport Nagar", phone: "9575168353", slot: "6:00", hold: 5, lat: 21.3185624, lng: 81.63470909 },
  { name: "Amit Kirana Stores", area: "Sarora", phone: "9617151502", slot: "6:30", hold: 5, lat: 21.35624102, lng: 81.65809527 },
  { name: "Mukesh Kirana Store", area: "Mandir Hasaud", phone: "9303535166", slot: "7:30", hold: 5, lat: 21.229799, lng: 81.770541 },
  { name: "Manoj Chourasiya", area: "Mandir Hasaud", phone: "9340737987", slot: "7:40", hold: 5, lat: 21.2847658, lng: 81.6116012 },
];

const mins = (hm: string) => { if (!hm) return Infinity; const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
export const clock = (m: number) => { const t = Math.round(m); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

export interface Leg { from: number; to: number; metres: number; seconds: number; path: LngLat[] }
export interface Visit {
  stop: number;
  slot: number;
  /** when the vehicle gets there */
  arrive: number;
  /** minutes it waits for the given time (it got there early) */
  waited: number;
  /** when it is delivered: the given time, or later when the vehicle is late */
  deliver: number;
  /** minutes after the given time */
  late: number;
  leave: number;
}
export interface RoundPlan {
  order: number[]; legs: Leg[]; visits: Visit[]; metres: number; seconds: number;
  /** total minutes late over all stops, and how many stops are late */
  late: number; lateStops: number;
  /** minutes after midnight: leaving the depot, the last drop done, back at the depot */
  start: number; lastDrop: number; back: number;
}
export interface SlotRoutePlan { stops: SlotStop[]; best: RoundPlan; road: boolean }

// ---------------------------------------------------------------------------------------------- Ola, kept

const legKept = new Map<string, { at: number; leg: Omit<Leg, "from" | "to"> | null }>();
const KEEP_MS = 6 * 3600_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The fastest road from a to b (the quickest of Ola's alternatives), kept six hours. Null when Ola could not say. */
async function roadLeg(a: Pt, b: Pt): Promise<Omit<Leg, "from" | "to"> | null> {
  const k = `${a.lat},${a.lng}|${b.lat},${b.lng}`;
  const kept = legKept.get(k);
  if (kept && Date.now() - kept.at < KEEP_MS && kept.leg) return kept.leg;
  if (!olaEnabled()) return null;
  // Ola allows only so many requests a minute: one more try after a pause
  // the quickest of the roads Ola offers between the two stops
  const r = (await route(a, b, { fastest: true })) ?? (await sleep(12000), await route(a, b, { fastest: true }));
  const leg = r ? { metres: r.distanceM, seconds: r.durationS, path: r.points.map(([lat, lng]) => [lng, lat] as LngLat) } : null;
  legKept.set(k, { at: Date.now(), leg });
  return leg;
}

let matrixKept: { at: number; m: { metres: number[][]; seconds: number[][] } } | null = null;

/** Road metres and seconds between every pair of points: Ola's distance matrix, 5 x 10 pairs a request (its limit). */
async function roadMatrix(pts: Pt[]): Promise<{ metres: number[][]; seconds: number[][] } | null> {
  if (matrixKept && Date.now() - matrixKept.at < KEEP_MS) return matrixKept.m;
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
  if (metres.some((row, a) => row.some((v, b) => a !== b && !(v >= 0)))) return null;
  matrixKept = { at: Date.now(), m: { metres, seconds } };
  return matrixKept.m;
}

// ---------------------------------------------------------------------------------------------- the order

// ---------------------------------------------------------------------------------------------- the order

/** Never early: wait for the given time, deliver, stay the hold time. */
const visit = (t: number, travelMin: number, slot: number, hold: number) => {
  const arrive = t + travelMin;
  const deliver = Math.max(arrive, slot);
  return { arrive, deliver, late: deliver - slot, waited: deliver - arrive, leave: deliver + hold };
};

/**
 * The order with the least total lateness, then the fewest road metres. The vehicle leaves the depot so it reaches its
 * first stop exactly at that stop's time. Exact: over every subset of stops visited so far and the stop it ends at,
 * keeping each (lateness, metres, time) that no other beats on all three.
 */
export function leastLateOrder(metres: number[][], seconds: number[][], slots: number[], hold: number[]): number[] {
  const n = metres.length;
  const free = [...Array(n).keys()].filter((i) => i !== 0);
  type Label = { late: number; m: number; t: number; prev: Label | null; at: number };
  const add = (list: Label[], x: Label) => {
    if (list.some((y) => y.late <= x.late && y.m <= x.m && y.t <= x.t)) return;
    for (let i = list.length - 1; i >= 0; i--) if (x.late <= list[i].late && x.m <= list[i].m && x.t <= list[i].t) list.splice(i, 1);
    list.push(x);
  };
  const step = (l: Label, to: number): Label => {
    const v = visit(l.t, seconds[l.at][to] / 60, slots[to], hold[to]);
    return { late: l.late + v.late, m: l.m + metres[l.at][to], t: v.leave, prev: l, at: to };
  };
  const F = free.length;
  const states = new Map<number, Label[]>(); // key: mask * F + index of the stop it ends at
  for (let j = 0; j < F; j++) {
    const s = free[j];
    // leave the depot so this first stop is reached exactly at its time
    states.set((1 << j) * F + j, [step({ late: 0, m: 0, t: slots[s] - seconds[0][s] / 60, prev: null, at: 0 }, s)]);
  }
  for (let mask = 1; mask < 1 << F; mask++) {
    for (let j = 0; j < F; j++) {
      const here = states.get(mask * F + j);
      if (!here) continue;
      for (let k = 0; k < F; k++) {
        if (mask & (1 << k)) continue;
        const key = (mask | (1 << k)) * F + k;
        const list = states.get(key) ?? [];
        for (const l of here) add(list, step(l, free[k]));
        states.set(key, list);
      }
    }
  }
  let best: Label | null = null;
  const full = (1 << F) - 1;
  for (let j = 0; j < F; j++) {
    for (const e of states.get(full * F + j) ?? []) {
      // the km include the drive back to the depot
      const m = e.m + metres[e.at][0];
      if (!best || e.late < best.late - 1e-6 || (Math.abs(e.late - best.late) < 1e-6 && m < best.m + metres[best.at][0])) best = e;
    }
  }
  const order: number[] = [];
  for (let l: Label | null = best; l; l = l.prev) order.unshift(l.at);
  return order; // starts at 0, the depot
}

/**
 * A round by road in this order and back to the depot: leave so the first stop is on time, never deliver early, count
 * the lateness. The last leg is the drive back to the depot.
 */
async function roundOf(order: number[], metres: number[][], seconds: number[][], slots: number[], road: boolean): Promise<RoundPlan> {
  const legs: Leg[] = [];
  const path = [...order, 0];
  for (let i = 1; i < path.length; i++) {
    const a = STOPS[path[i - 1]], b = STOPS[path[i]];
    const got = road ? await roadLeg(a, b) : null;
    legs.push(got
      ? { from: path[i - 1], to: path[i], ...got }
      : { from: path[i - 1], to: path[i], metres: metres[path[i - 1]][path[i]], seconds: seconds[path[i - 1]][path[i]], path: [[a.lng, a.lat], [b.lng, b.lat]] });
  }
  const start = slots[order[1]] - legs[0].seconds / 60;
  let t = start;
  const visits: Visit[] = order.slice(1).map((s, i) => {
    const v = visit(t, legs[i].seconds / 60, slots[s], STOPS[s].hold);
    t = v.leave;
    return { stop: s, slot: slots[s], ...v };
  });
  return {
    order, legs, visits, start, lastDrop: t, back: t + legs[legs.length - 1].seconds / 60,
    late: visits.reduce((x, v) => x + v.late, 0), lateStops: visits.filter((v) => v.late >= 0.5).length,
    metres: legs.reduce((x, l) => x + l.metres, 0), seconds: legs.reduce((x, l) => x + l.seconds, 0),
  };
}

/** The round: the least-late order, by road. */
export async function slotRoutePlan(): Promise<SlotRoutePlan> {
  // the stops are fixed: a road plan is kept six hours (working it out takes a few seconds)
  if (planKept && Date.now() - planKept.at < KEEP_MS) return planKept.plan;
  const plan = await workOut();
  if (plan.road) planKept = { at: Date.now(), plan };
  return plan;
}

let planKept: { at: number; plan: SlotRoutePlan } | null = null;

async function workOut(): Promise<SlotRoutePlan> {
  const slots = STOPS.map((s) => mins(s.slot));
  const m = await roadMatrix(STOPS);
  const road = !!m;
  // without Ola: straight line x 1.3 at 30 km/h, so the page still says something
  const metres = m?.metres ?? STOPS.map((a) => STOPS.map((b) => haversine(a, b) * 1.3));
  const seconds = m?.seconds ?? metres.map((row) => row.map((v) => (v / 1000 / 30) * 3600));
  const best = leastLateOrder(metres, seconds, slots, STOPS.map((s) => s.hold));
  return {
    stops: STOPS, road,
    best: await roundOf(best, metres, seconds, slots, road),
  };
}
