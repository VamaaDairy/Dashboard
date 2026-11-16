import "server-only";
import { one, query } from "@/lib/db";
import { haversine } from "./route-plan";

/**
 * A session for every delivery (db/103_delivery_sessions.sql): one row each time an order is with a rider, from being
 * given to them to the handover, or until it is taken back or cancelled. Kept up to date by assignRider, riderPickup,
 * riderDeliver and setOrderStatus in ./orders, so whatever changes an order (app, Dashboard, API) keeps it right.
 */

export type EndReason = "delivered" | "unassigned" | "reassigned" | "cancelled";

/** The rider now has the order: closes any session another rider had for it and opens theirs. */
export async function sessionAssigned(orderId: number, riderId: number | null): Promise<void> {
  const open = await one<{ rider_id: number }>(`select rider_id from shop_delivery_session where order_id = $1 and ended_at is null`, [orderId]);
  if (open && open.rider_id === riderId) return;
  if (open) await endSession(orderId, riderId == null ? "unassigned" : "reassigned");
  if (riderId != null) {
    await query(`insert into shop_delivery_session (order_id, rider_id) values ($1, $2) on conflict do nothing`, [orderId, riderId]);
  }
}

/** Picked up: when, and where the rider's phone was. A second pickup tap changes nothing. */
export async function sessionPickedUp(orderId: number, riderId: number): Promise<void> {
  await ensureOpen(orderId, riderId);
  await query(
    `update shop_delivery_session s
        set status = 'picked_up', picked_up_at = now(), pickup_lat = r.lat, pickup_lng = r.lng, updated_at = now()
       from shop_rider r
      where s.order_id = $1 and s.ended_at is null and s.picked_up_at is null and r.id = s.rider_id`,
    [orderId],
  );
}

/**
 * Handed over: where, how far from the customer's pin, the distance ridden since pickup, whether the code was checked.
 * [riderId] null when the office marks it delivered from the Dashboard (no phone position then).
 */
export async function sessionDelivered(orderId: number, riderId: number | null, otpChecked: boolean): Promise<void> {
  const o = await one<{ rider_id: number | null; lat: number | null; lng: number | null }>(`select rider_id, lat, lng from shop_order where id = $1`, [orderId]);
  const rid = riderId ?? o?.rider_id ?? null;
  if (rid == null) return;
  await ensureOpen(orderId, rid);
  const s = await one<{ id: number; picked_up_at: Date | null; assigned_at: Date }>(
    `select id, picked_up_at, assigned_at from shop_delivery_session where order_id = $1 and ended_at is null`,
    [orderId],
  );
  if (!s) return;
  const at = riderId != null ? await one<{ lat: number | null; lng: number | null }>(`select lat, lng from shop_rider where id = $1`, [riderId]) : null;
  const drop = at?.lat != null && at.lng != null ? { lat: at.lat, lng: at.lng } : null;
  const gap = drop && o?.lat != null && o.lng != null ? Math.round(haversine(drop, { lat: o.lat, lng: o.lng })) : null;
  const metres = await ridden(rid, s.picked_up_at ?? s.assigned_at);
  await query(
    `update shop_delivery_session
        set status = 'delivered', delivered_at = now(), drop_lat = $2, drop_lng = $3, drop_gap_m = $4, metres = $5,
            otp_checked = $6, ended_at = now(), end_reason = 'delivered', updated_at = now()
      where id = $1`,
    [s.id, drop?.lat ?? null, drop?.lng ?? null, gap, metres, otpChecked],
  );
}

/** The order left the rider without being delivered (taken back, given to someone else, cancelled). */
export async function endSession(orderId: number, reason: Exclude<EndReason, "delivered">): Promise<void> {
  await query(
    `update shop_delivery_session set status = $2, ended_at = now(), end_reason = $2, updated_at = now()
      where order_id = $1 and ended_at is null`,
    [orderId, reason],
  );
}

/** An order given to a rider before sessions existed (or by a path that skipped it) still gets one. */
async function ensureOpen(orderId: number, riderId: number) {
  await query(
    `insert into shop_delivery_session (order_id, rider_id, assigned_at)
     select $1, $2, coalesce(o.assigned_at, now()) from shop_order o
      where o.id = $1 and not exists (select 1 from shop_delivery_session s where s.order_id = $1 and s.ended_at is null)
     on conflict do nothing`,
    [orderId, riderId],
  );
}

/** Metres along the phone's track since [from], with the same rules as the day's distance: no jitter, no jumps. */
async function ridden(riderId: number, from: Date): Promise<number> {
  const pts = await query<{ lat: number; lng: number; at: Date }>(
    `select lat, lng, at from shop_rider_ping where rider_id = $1 and at >= $2 order by at limit 20000`,
    [riderId, from],
  );
  let m = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1], pts[i]);
    const secs = Math.max((pts[i].at.getTime() - pts[i - 1].at.getTime()) / 1000, 1);
    if (d >= 15 && d <= 2000 && d / secs <= 28) m += d;
  }
  return Math.round(m);
}

// ---------------------------------------------------------------- reading, for the API and Dashboard

export interface DeliverySession {
  id: number;
  orderId: number;
  orderNo: string;
  rider: { id: number; name: string; phone: string };
  customer: { name: string; phone: string; address: string; lat: number | null; lng: number | null };
  status: string;
  assignedAt: string;
  pickedUpAt: string | null;
  pickup: { lat: number; lng: number } | null;
  deliveredAt: string | null;
  drop: { lat: number; lng: number } | null;
  dropGapM: number | null;
  metres: number | null;
  minutes: number | null;
  otpChecked: boolean | null;
  endedAt: string | null;
  endReason: string | null;
}

const SELECT = `
  select s.id, s.order_id as "orderId", o.order_no as "orderNo",
         json_build_object('id', r.id, 'name', r.name, 'phone', r.phone) as rider,
         json_build_object('name', o.name, 'phone', o.phone, 'address', o.address, 'lat', o.lat, 'lng', o.lng) as customer,
         s.status, s.assigned_at as "assignedAt", s.picked_up_at as "pickedUpAt",
         case when s.pickup_lat is null then null else json_build_object('lat', s.pickup_lat, 'lng', s.pickup_lng) end as pickup,
         s.delivered_at as "deliveredAt",
         case when s.drop_lat is null then null else json_build_object('lat', s.drop_lat, 'lng', s.drop_lng) end as drop,
         s.drop_gap_m as "dropGapM", s.metres,
         case when s.delivered_at is null then null
              else round(extract(epoch from s.delivered_at - coalesce(s.picked_up_at, s.assigned_at)) / 60)::int end as minutes,
         s.otp_checked as "otpChecked", s.ended_at as "endedAt", s.end_reason as "endReason"
    from shop_delivery_session s
    join shop_order o on o.id = s.order_id
    join shop_rider r on r.id = s.rider_id`;

const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
const shape = (r: DeliverySession): DeliverySession => ({
  ...r, assignedAt: iso(r.assignedAt)!, pickedUpAt: iso(r.pickedUpAt), deliveredAt: iso(r.deliveredAt), endedAt: iso(r.endedAt),
});

/** Sessions of one day (India date), optionally one rider's or one status, newest first, 100 a page. */
export async function listSessions(opts: { day?: string; riderId?: number; status?: string; page?: number }) {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.day) {
    args.push(opts.day);
    where.push(`(s.assigned_at at time zone 'Asia/Kolkata')::date = $${args.length}::date`);
  }
  if (opts.riderId) {
    args.push(opts.riderId);
    where.push(`s.rider_id = $${args.length}`);
  }
  if (opts.status) {
    args.push(opts.status);
    where.push(`s.status = $${args.length}`);
  }
  const page = Math.max(1, opts.page ?? 1);
  const w = where.length ? `where ${where.join(" and ")}` : "";
  const [rows, total] = await Promise.all([
    query<DeliverySession>(`${SELECT} ${w} order by s.assigned_at desc, s.id desc limit 100 offset ${(page - 1) * 100}`, args),
    one<{ n: number }>(`select count(*)::int as n from shop_delivery_session s ${w}`, args),
  ]);
  return { page, pageSize: 100, total: total?.n ?? 0, sessions: rows.map(shape) };
}

/** One session, with the phone's track between pickup and handover (kept 90 days). */
export async function getSession(id: number) {
  const s = await one<DeliverySession & { riderId: number }>(`${SELECT} where s.id = $1`, [id]);
  if (!s) return null;
  const from = s.pickedUpAt ?? s.assignedAt;
  const to = s.deliveredAt ?? s.endedAt;
  const track = await query<{ lat: number; lng: number; at: string }>(
    `select lat, lng, at from shop_rider_ping where rider_id = $1 and at >= $2 and ($3::timestamptz is null or at <= $3) order by at limit 5000`,
    [s.rider.id, from, to],
  );
  return { session: shape(s), track: track.map((p) => ({ lat: p.lat, lng: p.lng, at: new Date(p.at).toISOString() })) };
}

/** Every session an order has had (normally one; more when it went to another rider). */
export const sessionsOfOrder = async (orderId: number) =>
  (await query<DeliverySession>(`${SELECT} where s.order_id = $1 order by s.assigned_at, s.id`, [orderId])).map(shape);
