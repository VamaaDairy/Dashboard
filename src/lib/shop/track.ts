/**
 * Delivery and rider tracking: the route a delivery partner actually rode, drawn from the positions their
 * phone reported while on duty (shop_rider_ping, about one every 6 s).
 *
 * - orderTrack: one order's trip (from pick-up at House of Gaia to its drop) and its own leg (from the
 *   previous drop in the same trip), next to the planned route.
 * - riderDay: everything one partner rode on one day (India time), with every drop.
 */
import { one, query } from "@/lib/db";
import { route } from "./ola";
import { haversine, store } from "./route-plan";

/** [lng, lat], as the map draws it. */
export type LngLat = [number, number];

export interface Stop { orderId: number; orderNo: string; name: string; lng: number; lat: number; at: string | null; status: string }

export interface Track {
  /** Unbroken stretches of riding: a new one starts after a signal gap (no position for 3 min or a 1 km jump). */
  segments: LngLat[][];
  metres: number;
  points: number;
  from: string | null;
  to: string | null;
}

export interface Ping { at: Date; lat: number; lng: number }

export const GAP_SECS = 180;
export const GAP_METRES = 1000;

export function toTrack(pings: Ping[]): Track {
  const segments: LngLat[][] = [];
  let metres = 0;
  let prev: Ping | null = null;
  for (const p of pings) {
    const gap = prev ? (new Date(p.at).getTime() - new Date(prev.at).getTime()) / 1000 : Infinity;
    const d = prev ? haversine(prev, p) : 0;
    if (!prev || gap > GAP_SECS || d > GAP_METRES) segments.push([]);
    else metres += d;
    segments[segments.length - 1].push([p.lng, p.lat]);
    prev = p;
  }
  return {
    segments,
    metres: Math.round(metres),
    points: pings.length,
    from: pings.length ? new Date(pings[0].at).toISOString() : null,
    to: pings.length ? new Date(pings[pings.length - 1].at).toISOString() : null,
  };
}

export const pingsBetween = (riderId: number, from: Date | string, to: Date | string) =>
  query<Ping>(`select at, lat, lng from shop_rider_ping where rider_id = $1 and at >= $2 and at <= $3 order by at`, [riderId, from, to]);

export interface OrderTrack {
  order: {
    id: number; orderNo: string; name: string; phone: string; address: string; lat: number | null; lng: number | null; status: string;
    assignedAt: string | null; pickedUpAt: string | null; deliveredAt: string | null;
  };
  rider: { id: number; name: string; phone: string } | null;
  store: { name: string; lat: number; lng: number };
  /** Pick-up to this drop (or to now while it is on the way). */
  trip: Track | null;
  /** Previous drop in the same trip (or pick-up) to this drop. */
  leg: Track | null;
  legFrom: Stop | null;
  /** The other drops made on the same trip, before this one. */
  drops: Stop[];
  /** The road route Ola suggests for the leg, for comparison. */
  planned: { path: LngLat[]; metres: number; secs: number } | null;
  live: boolean;
}

export async function orderTrack(id: number): Promise<OrderTrack | null> {
  const o = await one<{
    id: number; order_no: string; name: string; phone: string; address: string; lat: number | null; lng: number | null; status: string;
    rider_id: number | null; assigned_at: Date | null; picked_up_at: Date | null; delivered_at: Date | null;
    rider_name: string | null; rider_phone: string | null;
  }>(
    `select o.id, o.order_no, o.name, o.phone, o.address, o.lat, o.lng, o.status, o.rider_id, o.assigned_at, o.picked_up_at, o.delivered_at,
            r.name as rider_name, r.phone as rider_phone
       from shop_order o left join shop_rider r on r.id = o.rider_id where o.id = $1`,
    [id],
  );
  if (!o) return null;
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  const base: OrderTrack = {
    order: {
      id: o.id, orderNo: o.order_no, name: o.name, phone: o.phone, address: o.address, lat: o.lat, lng: o.lng, status: o.status,
      assignedAt: iso(o.assigned_at), pickedUpAt: iso(o.picked_up_at), deliveredAt: iso(o.delivered_at),
    },
    rider: o.rider_id ? { id: o.rider_id, name: o.rider_name ?? "", phone: o.rider_phone ?? "" } : null,
    store: store(),
    trip: null, leg: null, legFrom: null, drops: [], planned: null,
    live: o.status === "out_for_delivery",
  };
  if (!o.rider_id || !o.picked_up_at) return base;

  const end = o.delivered_at ?? new Date();
  const [pings, drops] = await Promise.all([
    pingsBetween(o.rider_id, o.picked_up_at, end),
    query<{ id: number; order_no: string; name: string; lat: number | null; lng: number | null; delivered_at: Date; status: string }>(
      `select id, order_no, name, lat, lng, delivered_at, status from shop_order
        where rider_id = $1 and id <> $2 and delivered_at > $3 and delivered_at < $4 order by delivered_at`,
      [o.rider_id, o.id, o.picked_up_at, end],
    ),
  ]);
  const stops: Stop[] = drops
    .filter((d) => d.lat != null && d.lng != null)
    .map((d) => ({ orderId: d.id, orderNo: d.order_no, name: d.name, lat: d.lat!, lng: d.lng!, at: iso(d.delivered_at), status: d.status }));
  const prevDrop = drops.length ? drops[drops.length - 1] : null;
  const legStart = prevDrop ? new Date(prevDrop.delivered_at) : new Date(o.picked_up_at);

  base.trip = toTrack(pings);
  base.leg = toTrack(pings.filter((p) => new Date(p.at) >= legStart));
  base.drops = stops;
  base.legFrom = prevDrop && prevDrop.lat != null && prevDrop.lng != null
    ? { orderId: prevDrop.id, orderNo: prevDrop.order_no, name: prevDrop.name, lat: prevDrop.lat, lng: prevDrop.lng, at: iso(prevDrop.delivered_at), status: prevDrop.status }
    : null;

  if (o.lat != null && o.lng != null) {
    const first = base.leg.segments[0]?.[0];
    const from = first ? { lng: first[0], lat: first[1] } : base.legFrom ?? base.store;
    const r = await route(from, { lat: o.lat, lng: o.lng }).catch(() => null);
    if (r) base.planned = { path: r.points.map(([la, ln]) => [ln, la] as LngLat), metres: Math.round(r.distanceM), secs: Math.round(r.durationS) };
  }
  return base;
}

export interface RiderDay {
  rider: { id: number; name: string; phone: string; kind: string; vehicleNo: string | null };
  day: string;
  track: Track;
  /** The day's distance as counted live (Riders page / app), for comparison with the drawn track. */
  kmCounted: number;
  drops: Stop[];
  pickups: Array<{ orderNo: string; at: string }>;
  open: Stop[];
  store: { name: string; lat: number; lng: number };
  today: boolean;
}

/** Today in India, as YYYY-MM-DD. */
export const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

export async function riderDay(riderId: number, day: string): Promise<RiderDay | null> {
  const r = await one<{ id: number; name: string; phone: string; kind: string; vehicle_no: string | null }>(
    `select id, name, phone, kind, vehicle_no from shop_rider where id = $1`, [riderId],
  );
  if (!r) return null;
  const DAY = `$2::date::timestamp at time zone 'Asia/Kolkata'`;
  const NEXT = `($2::date + 1)::timestamp at time zone 'Asia/Kolkata'`;
  const [pings, km, drops, pickups] = await Promise.all([
    query<Ping>(`select at, lat, lng from shop_rider_ping where rider_id = $1 and at >= ${DAY} and at < ${NEXT} order by at`, [riderId, day]),
    one<{ metres: number }>(`select coalesce(sum(metres), 0)::int as metres from shop_rider_km where rider_id = $1 and day = $2::date`, [riderId, day]),
    query<{ id: number; order_no: string; name: string; lat: number | null; lng: number | null; delivered_at: Date; status: string }>(
      `select id, order_no, name, lat, lng, delivered_at, status from shop_order
        where rider_id = $1 and delivered_at >= ${DAY} and delivered_at < ${NEXT} order by delivered_at`, [riderId, day]),
    query<{ order_no: string; picked_up_at: Date }>(
      `select order_no, picked_up_at from shop_order where rider_id = $1 and picked_up_at >= ${DAY} and picked_up_at < ${NEXT} order by picked_up_at`, [riderId, day]),
  ]);
  const today = day === todayIST();
  const open = today
    ? await query<{ id: number; order_no: string; name: string; lat: number; lng: number; status: string }>(
        `select id, order_no, name, lat, lng, status from shop_order
          where rider_id = $1 and status in ('confirmed', 'out_for_delivery') and lat is not null order by delivery_seq nulls last, assigned_at`, [riderId])
    : [];
  return {
    rider: { id: r.id, name: r.name, phone: r.phone, kind: r.kind, vehicleNo: r.vehicle_no },
    day,
    track: toTrack(pings),
    kmCounted: (km?.metres ?? 0) / 1000,
    drops: drops.filter((d) => d.lat != null && d.lng != null).map((d) => ({
      orderId: d.id, orderNo: d.order_no, name: d.name, lat: d.lat!, lng: d.lng!, at: new Date(d.delivered_at).toISOString(), status: d.status,
    })),
    pickups: pickups.map((p) => ({ orderNo: p.order_no, at: new Date(p.picked_up_at).toISOString() })),
    open: open.map((d) => ({ orderId: d.id, orderNo: d.order_no, name: d.name, lat: d.lat, lng: d.lng, at: null, status: d.status })),
    store: store(),
    today,
  };
}
