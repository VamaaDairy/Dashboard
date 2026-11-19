import "server-only";
import { createHash } from "node:crypto";
import { one, query } from "@/lib/db";
import { haversine, shortestPath, type Pt } from "@/lib/shop/route-plan";
import { olaEnabled, routeVia } from "@/lib/shop/ola";
import type { LngLat } from "@/lib/shop/track";

/**
 * Road plans from the plant (db/107): which order to visit a set of points in, by road distance, and the road path
 * through them, from Ola Maps. Ola's distance matrix takes at most 10 points a side, so a long route is asked for in
 * 10 x 10 blocks; its directions are asked for 10 stops at a time and joined. Plans are kept by their exact points.
 * Without Ola (or when it fails) the order falls back to straight-line distance and the path to straight lines.
 */

export interface RoadPlan {
  /** indices into the points given, in visiting order from the plant */
  order: number[];
  /** the path from the plant through every point in that order, [lng, lat] */
  path: LngLat[];
  metres: number;
  seconds: number;
  /** false when it is straight lines (no road data) */
  road: boolean;
}

const BLOCK = 10;
const key = () => process.env.OLA_MAPS_API_KEY ?? "";

/** Road metres between every pair of points (null where Ola could not say). */
async function roadMetres(pts: Pt[]): Promise<Array<Array<number | null>> | null> {
  if (!olaEnabled()) return null;
  const n = pts.length;
  const m: Array<Array<number | null>> = Array.from({ length: n }, () => Array<number | null>(n).fill(null));
  const blocks: Array<[number, number]> = [];
  for (let i = 0; i < n; i += BLOCK) for (let k = 0; k < n; k += BLOCK) blocks.push([i, k]);
  const ask = async ([i0, k0]: [number, number]) => {
    const from = pts.slice(i0, i0 + BLOCK), to = pts.slice(k0, k0 + BLOCK);
    const url = new URL("https://api.olamaps.io/routing/v1/distanceMatrix");
    url.searchParams.set("origins", from.map((p) => `${p.lat},${p.lng}`).join("|"));
    url.searchParams.set("destinations", to.map((p) => `${p.lat},${p.lng}`).join("|"));
    url.searchParams.set("mode", "driving");
    url.searchParams.set("api_key", key());
    const r = await fetch(url, { headers: { "X-Request-Id": crypto.randomUUID() }, signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!r.ok) throw new Error(`Ola distance matrix ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = (await r.json()) as { rows?: Array<{ elements?: Array<{ distance?: number }> }> };
    j.rows?.forEach((row, a) => row.elements?.forEach((e, b) => {
      if (typeof e?.distance === "number" && e.distance > 0) m[i0 + a][k0 + b] = e.distance;
    }));
  };
  try {
    // a few at a time, so a long route doesn't fire dozens of requests at once
    for (let x = 0; x < blocks.length; x += 4) await Promise.all(blocks.slice(x, x + 4).map(ask));
    return m;
  } catch (e) {
    console.error("dispatch road plan:", e);
    return null;
  }
}

/** The road path from the plant through the points in order, asked 10 stops at a time and joined. */
async function roadPath(start: Pt, stops: Pt[]): Promise<{ path: LngLat[]; metres: number; seconds: number } | null> {
  if (!olaEnabled() || !stops.length) return null;
  const path: LngLat[] = [];
  let metres = 0, seconds = 0, from = start;
  for (let i = 0; i < stops.length; i += BLOCK) {
    const part = stops.slice(i, i + BLOCK);
    const r = await routeVia(from, part.slice(0, -1), part[part.length - 1]);
    if (!r) return null;
    path.push(...r.points.map(([lat, lng]) => [lng, lat] as LngLat));
    metres += r.distanceM;
    seconds += r.durationS;
    from = part[part.length - 1];
  }
  return { path, metres, seconds };
}

const round = (p: Pt) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

/** The plan for visiting `points` from `start` by road, from the store when these exact points were planned before. */
export async function roadPlan(start: Pt, points: Pt[]): Promise<RoadPlan> {
  if (!points.length) return { order: [], path: [], metres: 0, seconds: 0, road: false };
  const k = createHash("sha1").update([start, ...points].map(round).join(";")).digest("hex");
  const kept = await one<{ plan: RoadPlan }>(`select plan from dispatch_road_plan where key = $1`, [k]);
  if (kept) return kept.plan;

  const all = [start, ...points];
  const straight = all.map((a) => all.map((b) => Math.round(haversine(a, b) * 1.3)));
  const road = await roadMetres(all);
  const d = road ? all.map((_, i) => all.map((_, j) => (i === j ? 0 : road[i][j] ?? straight[i][j]))) : straight;
  const order = (points.length === 1 ? [1] : shortestPath(d)).map((x) => x - 1);
  const ordered = order.map((i) => points[i]);
  const drawn = road ? await roadPath(start, ordered) : null;
  const plan: RoadPlan = drawn
    ? { order, path: drawn.path, metres: Math.round(drawn.metres), seconds: Math.round(drawn.seconds), road: true }
    : {
        order,
        path: [start, ...ordered].map((p) => [p.lng, p.lat] as LngLat),
        metres: Math.round([start, ...ordered].reduce((s, p, i, a) => (i ? s + haversine(a[i - 1], p) * 1.3 : 0), 0)),
        seconds: 0,
        road: false,
      };
  // only a road plan is kept: a straight-line one is tried again next time, in case Ola is back
  if (plan.road) await query(`insert into dispatch_road_plan (key, plan) values ($1, $2) on conflict (key) do update set plan = excluded.plan, created_at = now()`, [k, JSON.stringify(plan)]);
  return plan;
}

/** The road path from `start` through `points` in the order given (a trip's stops as the office set them), kept like a plan. */
export async function roadThrough(start: Pt, points: Pt[]): Promise<{ path: LngLat[]; metres: number; seconds: number; road: boolean }> {
  const line = { path: [start, ...points].map((p) => [p.lng, p.lat] as LngLat), metres: 0, seconds: 0, road: false };
  if (!points.length) return line;
  const k = "through:" + createHash("sha1").update([start, ...points].map(round).join(";")).digest("hex");
  const kept = await one<{ plan: { path: LngLat[]; metres: number; seconds: number } }>(`select plan from dispatch_road_plan where key = $1`, [k]);
  if (kept) return { ...kept.plan, road: true };
  const drawn = await roadPath(start, points);
  if (!drawn) return line;
  await query(`insert into dispatch_road_plan (key, plan) values ($1, $2) on conflict (key) do update set plan = excluded.plan, created_at = now()`, [k, JSON.stringify(drawn)]);
  return { ...drawn, road: true };
}
