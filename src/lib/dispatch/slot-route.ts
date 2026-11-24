import "server-only";
import { haversine, type Pt } from "@/lib/shop/route-plan";
import { olaEnabled, route } from "@/lib/shop/ola";
import type { LngLat } from "@/lib/shop/track";

/**
 * One delivery round with time slots: from Tumgaon depot, reach every customer by their delivery time and stay there
 * their hold time (unloading) before driving on. A delivery is made at most EARLY_MIN minutes before its time. Ola Maps gives the road distance and driving time between every pair
 * of points; every order is weighed for the shortest by road, and each round says when it must leave the depot.
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
  stop: number; /** when it is delivered */ arrive: number; /** minutes waited for its window */ waited: number; leave: number; slot: number; late: number;
  /** driving straight on with only the hold times, from [RoundPlan.estStart]: when it really gets there */
  estimate: number;
}
export interface RoundPlan {
  order: number[]; legs: Leg[]; visits: Visit[]; metres: number; seconds: number; late: number; onTime: boolean;
  /** when it leaves the depot and when the last drop is done, minutes after midnight */
  start: number; finish: number;
  /** the estimate: leave the depot so the first stop is reached at its given time, then drive on with only the hold times */
  estStart: number; estFinish: number;
}
export interface SlotRoutePlan { stops: SlotStop[]; best: RoundPlan; given: RoundPlan; road: boolean; early: number }

// ---------------------------------------------------------------------------------------------- Ola, kept

const legKept = new Map<string, { at: number; leg: Omit<Leg, "from" | "to"> | null }>();
const KEEP_MS = 6 * 3600_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The road from a to b (Ola directions), kept six hours. Null when Ola could not say. */
async function roadLeg(a: Pt, b: Pt): Promise<Omit<Leg, "from" | "to"> | null> {
  const k = `${a.lat},${a.lng}|${b.lat},${b.lng}`;
  const kept = legKept.get(k);
  if (kept && Date.now() - kept.at < KEEP_MS && kept.leg) return kept.leg;
  if (!olaEnabled()) return null;
  // Ola allows only so many requests a minute: one more try after a pause
  const r = (await route(a, b)) ?? (await sleep(12000), await route(a, b));
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

/** A delivery is made at most this many minutes before its time, never after it; a vehicle there sooner waits. */
export const EARLY_MIN = 60;

/** Minutes after midnight at each stop for this order when leaving the depot at [start]; null when a stop would be missed. */
function timesFor(order: number[], legMin: number[], start: number, slots: number[], hold: number[]): Array<{ arrive: number; serve: number; leave: number }> | null {
  let t = start;
  const out: Array<{ arrive: number; serve: number; leave: number }> = [];
  for (let i = 1; i < order.length; i++) {
    const s = order[i];
    const arrive = t + legMin[i - 1];
    const serve = Math.max(arrive, slots[s] - EARLY_MIN);
    if (serve > slots[s] + 1e-9) return null;
    t = serve + hold[s];
    out.push({ arrive, serve, leave: t });
  }
  return out;
}

/** The latest whole minute the depot can be left so this order is on time everywhere (null when no time works). */
function latestStart(order: number[], legMin: number[], slots: number[], hold: number[]): number | null {
  const first = slots[order[1]] - legMin[0];
  for (let s = Math.floor(first); s > first - 24 * 60; s--) if (timesFor(order, legMin, s, slots, hold)) return s;
  return null;
}

/**
 * The shortest order by road that delivers to everyone within their window ([slot - EARLY_MIN, slot]), with when to
 * leave the depot. Exact for each leave time: over every subset of stops visited so far and the stop it ends at,
 * keeping each (metres, time) that no other beats on both. Leave times are tried minute by minute; the fewest km wins,
 * then the later leave.
 */
export function shortestOrder(metres: number[][], seconds: number[][], slots: number[], hold: number[]): number[] | null {
  const n = metres.length;
  const free = [...Array(n).keys()].filter((i) => i !== 0);
  const F = free.length;
  type Label = { m: number; t: number; prev: Label | null; at: number };
  const solve = (start: number): Label | null => {
    const add = (list: Label[], x: Label) => {
      if (list.some((y) => y.m <= x.m && y.t <= x.t)) return;
      for (let i = list.length - 1; i >= 0; i--) if (x.m <= list[i].m && x.t <= list[i].t) list.splice(i, 1);
      list.push(x);
    };
    const step = (l: Label, to: number): Label | null => {
      const serve = Math.max(l.t + seconds[l.at][to] / 60, slots[to] - EARLY_MIN);
      return serve > slots[to] + 1e-9 ? null : { m: l.m + metres[l.at][to], t: serve + hold[to], prev: l, at: to };
    };
    const states = new Map<number, Label[]>();
    for (let j = 0; j < F; j++) {
      const x = step({ m: 0, t: start, prev: null, at: 0 }, free[j]);
      if (x) states.set((1 << j) * F + j, [x]);
    }
    for (let mask = 1; mask < 1 << F; mask++) {
      for (let j = 0; j < F; j++) {
        const here = states.get(mask * F + j);
        if (!here) continue;
        for (let k = 0; k < F; k++) {
          if (mask & (1 << k)) continue;
          const key = (mask | (1 << k)) * F + k;
          let list = states.get(key);
          for (const l of here) {
            const x = step(l, free[k]);
            if (!x) continue;
            if (!list) { list = []; states.set(key, list); }
            add(list, x);
          }
        }
      }
    }
    let best: Label | null = null;
    const full = (1 << F) - 1;
    for (let j = 0; j < F; j++) for (const l of states.get(full * F + j) ?? []) if (!best || l.m < best.m) best = l;
    return best;
  };
  // from the latest leave anything could make (the earliest window, straight from the depot) back three hours
  const top = Math.floor(Math.min(...free.map((s) => slots[s] - seconds[0][s] / 60)));
  let pick: { m: number; end: Label } | null = null;
  for (let start = top; start > top - 180; start--) {
    const end = solve(start);
    if (end && (!pick || end.m < pick.m - 1)) pick = { m: end.m, end };
  }
  if (!pick) return null;
  const order: number[] = [];
  for (let l: Label | null = pick.end; l; l = l.prev) order.unshift(l.at);
  return order;
}

/** A round by road in this order, leaving the depot as late as still delivers to everyone within their window. */
async function roundOf(order: number[], metres: number[][], seconds: number[][], slots: number[], road: boolean): Promise<RoundPlan> {
  const legs: Leg[] = [];
  for (let i = 1; i < order.length; i++) {
    const a = STOPS[order[i - 1]], b = STOPS[order[i]];
    const got = road ? await roadLeg(a, b) : null;
    legs.push(got
      ? { from: order[i - 1], to: order[i], ...got }
      : { from: order[i - 1], to: order[i], metres: metres[order[i - 1]][order[i]], seconds: seconds[order[i - 1]][order[i]], path: [[a.lng, a.lat], [b.lng, b.lat]] });
  }
  const legMin = legs.map((l) => l.seconds / 60);
  const hold = STOPS.map((s) => s.hold);
  const start = latestStart(order, legMin, slots, hold);
  // no leave time works (the road is slower than the windows allow): leave so the first stop is on time and show lateness
  const at = start ?? Math.floor(slots[order[1]] - legMin[0]);
  // the estimate: no waiting anywhere, leaving so the first stop is reached exactly at its given time
  const estStart = slots[order[1]] - legMin[0];
  let e = estStart;
  const est = order.slice(1).map((s, i) => { const arrive = e + legMin[i]; e = arrive + hold[s]; return arrive; });
  let t = at;
  const visits: Visit[] = order.slice(1).map((s, i) => {
    const arrive = t + legMin[i];
    const serve = Math.max(arrive, slots[s] - EARLY_MIN);
    t = serve + hold[s];
    return { stop: s, arrive: serve, waited: serve - arrive, leave: t, slot: slots[s], late: Math.max(0, serve - slots[s]), estimate: est[i] };
  });
  const late = visits.reduce((x, v) => x + v.late, 0);
  return {
    order, legs, visits, late, onTime: late < 0.5, start: at, finish: t, estStart, estFinish: e,
    metres: legs.reduce((x, l) => x + l.metres, 0), seconds: legs.reduce((x, l) => x + l.seconds, 0),
  };
}

/** The shortest round within the windows, and the customers in delivery-time order - each by road, with its leave time. */
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
  const byTime = [0, ...STOPS.map((_, i) => i).slice(1).sort((a, b) => slots[a] - slots[b])];
  const shortest = shortestOrder(metres, seconds, slots, STOPS.map((s) => s.hold)) ?? byTime;
  return {
    stops: STOPS, road, early: EARLY_MIN,
    best: await roundOf(shortest, metres, seconds, slots, road),
    given: await roundOf(byTime, metres, seconds, slots, road),
  };
}
