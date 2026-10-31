import "server-only";
import type { PoolClient } from "pg";
import { one, tx } from "@/lib/db";
import { olaEnabled } from "./ola";

export interface Pt { lat: number; lng: number }

/** Straight-line metres between two points. */
export function haversine(a: Pt, b: Pt): number {
  const r = 6371000, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * The shortest way from the start (index 0 of `d`) through every other point, not coming back.
 * Exact (Held-Karp) up to 12 stops; above that nearest-neighbour improved with 2-opt. Returns the
 * visiting order of points 1..n.
 */
export function shortestPath(d: number[][]): number[] {
  const n = d.length - 1;
  if (n <= 1) return n === 1 ? [1] : [];
  if (n <= 12) {
    const full = (1 << n) - 1;
    // best[mask][j]: shortest path from the start over the stops in mask, ending at stop j (1-based j-1 bit)
    const best = Array.from({ length: 1 << n }, () => new Float64Array(n).fill(Infinity));
    const prev = Array.from({ length: 1 << n }, () => new Int8Array(n).fill(-1));
    for (let j = 0; j < n; j++) best[1 << j][j] = d[0][j + 1];
    for (let mask = 1; mask <= full; mask++) {
      for (let j = 0; j < n; j++) {
        if (!(mask & (1 << j)) || best[mask][j] === Infinity) continue;
        for (let k = 0; k < n; k++) {
          if (mask & (1 << k)) continue;
          const next = mask | (1 << k), c = best[mask][j] + d[j + 1][k + 1];
          if (c < best[next][k]) {
            best[next][k] = c;
            prev[next][k] = j;
          }
        }
      }
    }
    let end = 0;
    for (let j = 1; j < n; j++) if (best[full][j] < best[full][end]) end = j;
    const path: number[] = [];
    for (let mask = full, j = end; j >= 0; ) {
      path.unshift(j + 1);
      const p = prev[mask][j];
      mask &= ~(1 << j);
      j = p;
    }
    return path;
  }
  // nearest neighbour, then 2-opt
  const left = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const path: number[] = [];
  let at = 0;
  while (left.size) {
    let pick = -1;
    for (const k of left) if (pick < 0 || d[at][k] < d[at][pick]) pick = k;
    path.push(pick);
    left.delete(pick);
    at = pick;
  }
  const cost = (p: number[]) => p.reduce((s, k, i) => s + d[i === 0 ? 0 : p[i - 1]][k], 0);
  for (let improved = true; improved; ) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const q = [...path.slice(0, i), ...path.slice(i, j + 1).reverse(), ...path.slice(j + 1)];
        if (cost(q) + 1e-6 < cost(path)) {
          path.splice(0, n, ...q);
          improved = true;
        }
      }
    }
  }
  return path;
}

/** Road metres between every pair of points from Ola's distance matrix; straight-line when Ola can't say. */
async function distances(pts: Pt[]): Promise<number[][]> {
  const line = pts.map((a) => pts.map((b) => Math.round(haversine(a, b) * 1.3))); // roads wind ~30% more than a straight line
  if (!olaEnabled() || pts.length < 2 || pts.length > 10) return line;
  try {
    const list = pts.map((p) => `${p.lat},${p.lng}`).join("|");
    const url = new URL("https://api.olamaps.io/routing/v1/distanceMatrix");
    url.searchParams.set("origins", list);
    url.searchParams.set("destinations", list);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("api_key", process.env.OLA_MAPS_API_KEY ?? "");
    const r = await fetch(url, { headers: { "X-Request-Id": crypto.randomUUID() }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!r.ok) return line;
    const j = (await r.json()) as { rows?: Array<{ elements?: Array<{ distance?: number; status?: string }> }> };
    if (j.rows?.length !== pts.length) return line;
    return pts.map((_, i) => pts.map((_, k) => {
      const e = j.rows![i].elements?.[k];
      return i === k ? 0 : typeof e?.distance === "number" && e.distance > 0 ? e.distance : line[i][k];
    }));
  } catch {
    return line;
  }
}

/**
 * House of Gaia (2, Shoppers Paradise, Pandri, Raipur), where riders collect orders and start in the
 * morning. Fixed; SHOP_STORE_LAT / SHOP_STORE_LNG on the server move the pin if it needs to be exact.
 */
export function store(): Pt & { name: string } {
  const lat = Number(process.env.SHOP_STORE_LAT), lng = Number(process.env.SHOP_STORE_LNG);
  const set = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  return { name: "House of Gaia", lat: set ? lat : 21.2554, lng: set ? lng : 81.647 };
}

interface Open { id: number; status: string; lat: number | null; lng: number | null; delivery_seq: number | null; assigned_at: Date | null }

/** Orders one group of stops from a start point; stops without a map pin go last, oldest first. */
async function orderGroup(start: Pt, group: Open[]): Promise<{ id: number; legM: number | null; end: Pt | null }[]> {
  const pinned = group.filter((o) => o.lat != null && o.lng != null);
  const unpinned = group.filter((o) => o.lat == null || o.lng == null);
  const out: { id: number; legM: number | null; end: Pt | null }[] = [];
  if (pinned.length) {
    const pts = [start, ...pinned.map((o) => ({ lat: o.lat!, lng: o.lng! }))];
    const d = await distances(pts);
    let at = 0;
    for (const k of shortestPath(d)) {
      out.push({ id: pinned[k - 1].id, legM: d[at][k], end: pts[k] });
      at = k;
    }
  }
  for (const o of unpinned) out.push({ id: o.id, legM: null, end: null });
  return out;
}

/**
 * Makes sure the rider's open orders have a delivery order: the shortest way round all of them, in any
 * order, starting from where the rider is now (or House of Gaia when the phone hasn't said lately).
 * Worked out again only when an order joins their list, so it doesn't reshuffle while they ride.
 */
export async function planRider(riderId: number): Promise<void> {
  await tx(async (c: PoolClient) => {
    // one plan at a time per rider
    await c.query(`select pg_advisory_xact_lock(7201, $1)`, [riderId]);
    const { rows } = await c.query<Open>(
      `select id, status, lat, lng, delivery_seq, assigned_at from shop_order
        where rider_id = $1 and status in ('confirmed', 'out_for_delivery') order by assigned_at, id`,
      [riderId],
    );
    if (!rows.length) return;
    if (!rows.some((o) => o.delivery_seq == null)) return;

    const r = await c.query<{ lat: number | null; lng: number | null; fresh: boolean }>(
      `select lat, lng, coalesce(location_at > now() - interval '30 minutes', false) as fresh from shop_rider where id = $1`, [riderId]);
    const here = r.rows[0]?.fresh && r.rows[0].lat != null && r.rows[0].lng != null ? { lat: r.rows[0].lat, lng: r.rows[0].lng } : null;

    const plan = await orderGroup(here ?? store(), rows);
    for (const [i, p] of plan.entries()) {
      await c.query(`update shop_order set delivery_seq = $2, delivery_leg_m = $3 where id = $1`, [p.id, i + 1, p.legM == null ? null : Math.round(p.legM)]);
    }
  });
}

/** The picked-up order this rider has to deliver before `orderId`, if any (the plan is followed in order). */
export async function earlierStop(riderId: number, orderId: number): Promise<{ seq: number; name: string } | null> {
  await planRider(riderId);
  return one<{ seq: number; name: string }>(
    `select e.delivery_seq as seq, e.name from shop_order o
       join shop_order e on e.rider_id = o.rider_id and e.status = 'out_for_delivery' and e.id <> o.id and e.delivery_seq < o.delivery_seq
      where o.id = $1 and o.rider_id = $2
      order by e.delivery_seq limit 1`,
    [orderId, riderId],
  );
}
