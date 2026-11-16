import "server-only";
import type { PoolClient } from "pg";
import { one, query, tx } from "@/lib/db";
import { pushToRole } from "@/lib/push";
import { haversine } from "@/lib/shop/route-plan";
import { pingsBetween, toTrack, type LngLat } from "@/lib/shop/track";

/**
 * Dispatch -> delivery for trade orders (db/104): the office puts a day's confirmed orders on trips (usually one per
 * route) and gives each trip to a transporter; the transporter runs it in the Gaia Delivery app.
 *
 *   trip     planned ──start──▶ on_the_way ──end──▶ completed      (planned / on_the_way ──cancel──▶ cancelled)
 *   stop     pending ──▶ delivered | not_delivered
 *
 * Starting a trip dispatches every order on it; each stop's outcome is written to the order's history
 * (dist_order_event) with the time, so the buyer's app shows placed -> confirmed -> dispatched -> delivered.
 */

export type TripStatus = "planned" | "on_the_way" | "completed" | "cancelled";
export type StopStatus = "pending" | "delivered" | "not_delivered";
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const KEY = (sql: string) => `regexp_replace(lower(${sql}), '[^a-z0-9]', '', 'g')`;

/** The day an order is for: its delivery date, else the day after it was booked (India time). */
const DELIVERY = `coalesce(b.delivery_date, (b.booking_time at time zone 'Asia/Kolkata')::date + 1)`;
/** Trade orders: from the apps (distributors, retailers, sales officers) and primary orders booked in the ERP. */
const TRADE = `(b.app_kind is not null or b.order_type = 'PRIMARY')`;
/** The route of a buyer: its party on the route sheet, else its beat. */
const ROUTE_JOIN = `
  left join lateral (
    select x.route_id from route_order_party x
     where x.active and (x.firm_uid = f.uid or x.name_key = ${KEY("f.name")})
     order by (x.firm_uid is not distinct from f.uid) desc limit 1
  ) pt on true
  left join route_order_route rr on rr.id = pt.route_id
  left join fp_beat bt on bt.uid = f.beat_uid`;
const ROUTE_NAME = `coalesce(rr.name, nullif(trim(bt.beat_name), ''), 'No route')`;

// ------------------------------------------------------------------------------------------------ the board

export interface DispatchOrder {
  uid: string;
  orderId: number;
  buyer: string;
  buyerCode: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  routeId: number | null;
  route: string;
  items: number;
  qty: number;
  total: number;
  /** the trip it is on, if any */
  tripId: number | null;
}

/** The confirmed trade orders for [date], with the trip each is on. */
export async function dispatchOrders(date: string): Promise<DispatchOrder[]> {
  return query<DispatchOrder>(
    `select b.uid, b.order_id as "orderId", f.name as buyer, f.firm_code as "buyerCode", f.phone, f.address, f.city,
            f.latitude::float as lat, f.longitude::float as lng, rr.id as "routeId", ${ROUTE_NAME} as route,
            b.total_item::int as items, b.total_quantity::float as qty, b.total_cost::float as total, s.trip_id as "tripId"
       from fp_booking_order b
       join fp_firm f on f.uid = b.from_firm_uid
       ${ROUTE_JOIN}
       left join dist_trip_stop s on s.order_uid = b.uid
      where ${TRADE} and ${DELIVERY} = $1::date and lower(b.status) = 'confirmed'
      order by ${ROUTE_NAME}, f.name, b.order_id`,
    [date],
  );
}

export interface TripStop {
  id: number;
  seq: number;
  orderUid: string;
  orderId: number;
  buyer: string;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  items: number;
  qty: number;
  total: number;
  status: StopStatus;
  deliveredAt: string | null;
  receivedBy: string | null;
  note: string | null;
  gapM: number | null;
  lines: Array<{ name: string; qty: number }>;
}

export interface Trip {
  id: number;
  date: string;
  routeId: number | null;
  route: string;
  status: TripStatus;
  transporter: { id: number; name: string; phone: string; lat: number | null; lng: number | null; locationAt: string | null } | null;
  vehicleNo: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  stops: TripStop[];
  qty: number;
  total: number;
}

const TRIP_SELECT = `
  select t.id, t.trip_date::text as date, t.route_id as "routeId", t.route_name as route, t.status, t.vehicle_no as "vehicleNo",
         t.notes, t.created_by as "createdBy", t.created_at as "createdAt", t.started_at as "startedAt", t.ended_at as "endedAt",
         case when r.id is null then null else json_build_object('id', r.id, 'name', r.name, 'phone', r.phone, 'lat', r.lat, 'lng', r.lng, 'locationAt', r.location_at) end as transporter,
         coalesce((
           select json_agg(json_build_object(
             'id', s.id, 'seq', s.seq, 'orderUid', s.order_uid, 'orderId', b.order_id, 'buyer', f.name, 'phone', f.phone, 'address', f.address,
             'lat', f.latitude::float, 'lng', f.longitude::float, 'items', b.total_item::int, 'qty', b.total_quantity::float, 'total', b.total_cost::float,
             'status', s.status, 'deliveredAt', s.delivered_at, 'receivedBy', s.received_by, 'note', s.note, 'gapM', s.gap_m,
             'lines', coalesce((select json_agg(json_build_object('name', p.sku_name, 'qty', i.quantity::float) order by i.order_item_number)
                                  from fp_booking_order_item i join fp_product p on p.uid = i.product_uid where i.booking_order_uid = b.uid), '[]'::json)
           ) order by s.seq)
           from dist_trip_stop s join fp_booking_order b on b.uid = s.order_uid join fp_firm f on f.uid = b.from_firm_uid
          where s.trip_id = t.id), '[]'::json) as stops
    from dist_trip t
    left join shop_rider r on r.id = t.transporter_id`;

const finish = (t: Omit<Trip, "qty" | "total">): Trip => ({
  ...t,
  createdAt: new Date(t.createdAt).toISOString(),
  startedAt: t.startedAt ? new Date(t.startedAt).toISOString() : null,
  endedAt: t.endedAt ? new Date(t.endedAt).toISOString() : null,
  qty: t.stops.reduce((s, x) => s + x.qty, 0),
  total: r2(t.stops.reduce((s, x) => s + x.total, 0)),
});

export async function tripsOn(date: string): Promise<Trip[]> {
  return (await query<Omit<Trip, "qty" | "total">>(`${TRIP_SELECT} where t.trip_date = $1 and t.status <> 'cancelled' order by t.route_name, t.id`, [date])).map(finish);
}

export async function getTrip(id: number): Promise<Trip | null> {
  const t = await one<Omit<Trip, "qty" | "total">>(`${TRIP_SELECT} where t.id = $1`, [id]);
  return t ? finish(t) : null;
}

/** The truck's track while the trip ran (or so far). */
export async function tripTrack(t: Trip): Promise<{ segments: LngLat[][]; metres: number }> {
  if (!t.transporter || !t.startedAt) return { segments: [], metres: 0 };
  const tr = toTrack(await pingsBetween(t.transporter.id, t.startedAt, t.endedAt ?? new Date()));
  return { segments: tr.segments, metres: tr.metres };
}

export const transporters = () =>
  query<{ id: number; name: string; phone: string; vehicleNo: string | null; active: boolean }>(
    `select id, name, phone, vehicle_no as "vehicleNo", active from shop_rider where kind = 'transporter' order by active desc, name`,
  );

// ------------------------------------------------------------------------------------------------ office actions

async function event(c: PoolClient, uid: string, action: string, actor: string, kind: "office" | "transporter", note: string | null = null) {
  await c.query(`insert into dist_order_event (order_uid, action, actor, actor_kind, note) values ($1, $2, $3, $4, $5)`, [uid, action, actor, kind, note]);
}

/** Tells the buyer's phone. Never throws. */
async function tellBuyers(uids: string[], title: (orderId: number) => string, body: (orderId: number) => string) {
  if (!uids.length) return;
  const rows = await query<{ login: number | null; kind: string | null; orderId: number }>(
    `select app_login_id as login, app_kind as kind, order_id as "orderId" from fp_booking_order where uid = any($1::uuid[])`,
    [uids],
  );
  for (const o of rows) {
    if (!o.login || (o.kind !== "distributor" && o.kind !== "retailer")) continue;
    try {
      await pushToRole("distributor", o.login, { title: title(o.orderId), body: body(o.orderId), data: { type: "order", orderId: String(o.orderId) } }, o.kind);
    } catch {}
  }
}

/** Checks the orders can go on a trip: confirmed trade orders, not on another trip. */
async function checkOrders(c: PoolClient, uids: string[], tripId: number | null): Promise<string | null> {
  if (!uids.length) return "Pick at least one order.";
  if (uids.length > 200) return "At most 200 orders on one trip.";
  const rows = (await c.query<{ uid: string; status: string; trip: number | null; orderId: number }>(
    `select b.uid, b.status, s.trip_id as trip, b.order_id as "orderId"
       from fp_booking_order b left join dist_trip_stop s on s.order_uid = b.uid
      where b.uid = any($1::uuid[]) and ${TRADE}`,
    [uids],
  )).rows;
  if (rows.length !== new Set(uids).size) return "Some of these orders no longer exist.";
  const bad = rows.find((r) => r.status.toLowerCase() !== "confirmed");
  if (bad) return `Order ${bad.orderId} is ${bad.status.toLowerCase()}, not confirmed.`;
  const taken = rows.find((r) => r.trip !== null && r.trip !== tripId);
  if (taken) return `Order ${taken.orderId} is already on trip ${taken.trip}.`;
  return null;
}

async function transporterOk(c: PoolClient, id: number | null): Promise<{ vehicle: string | null } | string> {
  if (id === null) return { vehicle: null };
  const r = (await c.query<{ vehicle_no: string | null }>(`select vehicle_no from shop_rider where id = $1 and kind = 'transporter' and active`, [id])).rows[0];
  return r ? { vehicle: r.vehicle_no } : "Pick an active transporter.";
}

export interface TripInput {
  date: string;
  routeId: number | null;
  routeName: string;
  orderUids: string[];
  transporterId: number | null;
  vehicleNo: string | null;
  notes: string | null;
}

/** Plans a trip: the orders as stops, in the order given. */
export async function createTrip(input: TripInput, who: string): Promise<Result<{ id: number }>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Pick the day." };
  const uids = [...new Set(input.orderUids)];
  return tx(async (c) => {
    const bad = await checkOrders(c, uids, null);
    if (bad) return { ok: false as const, error: bad };
    const tr = await transporterOk(c, input.transporterId);
    if (typeof tr === "string") return { ok: false as const, error: tr };
    const { rows } = await c.query<{ id: number }>(
      `insert into dist_trip (trip_date, route_id, route_name, transporter_id, vehicle_no, notes, created_by)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [input.date, input.routeId, input.routeName.trim().slice(0, 80) || "Trip", input.transporterId,
        (input.vehicleNo?.trim().toUpperCase() || tr.vehicle || null), input.notes?.trim().slice(0, 300) || null, who],
    );
    const id = rows[0].id;
    let seq = 0;
    for (const uid of uids) await c.query(`insert into dist_trip_stop (trip_id, order_uid, seq) values ($1, $2, $3)`, [id, uid, ++seq]);
    return { ok: true as const, id };
  }).then(async (r) => {
    if (r.ok && input.transporterId) await tellTransporter(input.transporterId, r.id);
    return r;
  });
}

async function tellTransporter(riderId: number, tripId: number) {
  const t = await getTrip(tripId);
  if (!t) return;
  try {
    await pushToRole("rider", riderId, {
      title: "New trip",
      body: `${t.route}, ${t.date}: ${t.stops.length} ${t.stops.length === 1 ? "stop" : "stops"}.`,
      data: { type: "trip", tripId: String(tripId) },
    });
  } catch {}
}

/** Changes a planned trip: transporter, vehicle, notes, and its stops (their order; orders added or taken off). */
export async function updateTrip(id: number, input: Omit<TripInput, "date" | "routeId" | "routeName"> & { routeName?: string }, who: string): Promise<Result> {
  const uids = [...new Set(input.orderUids)];
  let newTransporter: number | null = null;
  const r = await tx(async (c) => {
    const t = (await c.query<{ status: string; transporter_id: number | null }>(`select status, transporter_id from dist_trip where id = $1 for update`, [id])).rows[0];
    if (!t) return { ok: false as const, error: "That trip no longer exists." };
    if (t.status !== "planned") return { ok: false as const, error: "Only a trip that has not started can be changed." };
    const bad = await checkOrders(c, uids, id);
    if (bad) return { ok: false as const, error: bad };
    const tr = await transporterOk(c, input.transporterId);
    if (typeof tr === "string") return { ok: false as const, error: tr };
    await c.query(
      `update dist_trip set transporter_id = $2, vehicle_no = $3, notes = $4, route_name = coalesce($5, route_name), updated_at = now() where id = $1`,
      [id, input.transporterId, input.vehicleNo?.trim().toUpperCase() || tr.vehicle || null, input.notes?.trim().slice(0, 300) || null, input.routeName?.trim().slice(0, 80) || null],
    );
    await c.query(`delete from dist_trip_stop where trip_id = $1 and not (order_uid = any($2::uuid[]))`, [id, uids]);
    let seq = 0;
    for (const uid of uids) {
      await c.query(
        `insert into dist_trip_stop (trip_id, order_uid, seq) values ($1, $2, $3)
         on conflict (order_uid) do update set seq = excluded.seq, updated_at = now()`,
        [id, uid, ++seq],
      );
    }
    if (input.transporterId && input.transporterId !== t.transporter_id) newTransporter = input.transporterId;
    void who;
    return { ok: true as const };
  });
  if (r.ok && newTransporter) await tellTransporter(newTransporter, id);
  return r;
}

/** Calls a trip off: its orders come off it (and can go on another). A trip on the road keeps what was delivered. */
export async function cancelTrip(id: number, who: string): Promise<Result> {
  return tx(async (c) => {
    const t = (await c.query<{ status: string }>(`select status from dist_trip where id = $1 for update`, [id])).rows[0];
    if (!t) return { ok: false as const, error: "That trip no longer exists." };
    if (t.status === "completed" || t.status === "cancelled") return { ok: false as const, error: `The trip is already ${t.status}.` };
    if (t.status === "on_the_way" && (await c.query(`select 1 from dist_trip_stop where trip_id = $1 and status <> 'pending'`, [id])).rows.length) {
      return { ok: false as const, error: "Some stops are already done. End the trip from the app, or mark the rest as not delivered." };
    }
    await c.query(`delete from dist_trip_stop where trip_id = $1`, [id]);
    await c.query(`update dist_trip set status = 'cancelled', notes = concat_ws(' · ', notes, $2::text), updated_at = now() where id = $1`, [id, `Cancelled by ${who}`]);
    return { ok: true as const };
  });
}

// ------------------------------------------------------------------------------------------------ transporter actions

/** { lat, lng } from a request body, or nulls when missing / out of range. */
export function position(b: unknown): { lat: number | null; lng: number | null } {
  const x = (b ?? {}) as { lat?: unknown; lng?: unknown };
  const lat = Number(x.lat), lng = Number(x.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && x.lat !== null && x.lng !== null
    ? { lat, lng } : { lat: null, lng: null };
}

type Pos = { lat: number | null; lng: number | null };
const okPos = (p: Pos) => p.lat !== null && p.lng !== null && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/** The transporter's trips: today's and later ones still to run, plus the last week's finished ones. */
export async function transporterTrips(riderId: number): Promise<Trip[]> {
  return (await query<Omit<Trip, "qty" | "total">>(
    `${TRIP_SELECT}
      where t.transporter_id = $1 and t.status <> 'cancelled'
        and (t.status in ('planned', 'on_the_way') or t.trip_date >= (now() at time zone 'Asia/Kolkata')::date - 7)
      order by (t.status = 'on_the_way') desc, (t.status = 'planned') desc, t.trip_date, t.id`,
    [riderId],
  )).map(finish);
}

export async function startTrip(riderId: number, tripId: number, pos: Pos): Promise<Result> {
  const r = await tx(async (c) => {
    const t = (await c.query<{ status: string; transporter_id: number | null }>(`select status, transporter_id from dist_trip where id = $1 for update`, [tripId])).rows[0];
    if (!t || t.transporter_id !== riderId) return { ok: false as const, error: "This trip is not yours." };
    if (t.status !== "planned") return { ok: false as const, error: t.status === "on_the_way" ? "The trip has already started." : `The trip is ${t.status}.` };
    // another trip still on the road must end first
    if ((await c.query(`select 1 from dist_trip where transporter_id = $1 and status = 'on_the_way'`, [riderId])).rows.length) {
      return { ok: false as const, error: "Finish your trip on the road first." };
    }
    const stops = (await c.query<{ order_uid: string }>(`select order_uid from dist_trip_stop where trip_id = $1`, [tripId])).rows;
    if (!stops.length) return { ok: false as const, error: "This trip has no stops." };
    await c.query(
      `update dist_trip set status = 'on_the_way', started_at = now(), start_lat = $2, start_lng = $3, updated_at = now() where id = $1`,
      [tripId, okPos(pos) ? pos.lat : null, okPos(pos) ? pos.lng : null],
    );
    const name = (await c.query<{ name: string; vehicle_no: string | null }>(`select r.name, t.vehicle_no from shop_rider r, dist_trip t where r.id = $1 and t.id = $2`, [riderId, tripId])).rows[0];
    for (const s of stops) await event(c, s.order_uid, "dispatched", name?.name ?? "Transporter", "transporter", name?.vehicle_no ? `Vehicle ${name.vehicle_no}` : null);
    return { ok: true as const, uids: stops.map((s) => s.order_uid) };
  });
  if (!r.ok) return r;
  await tellBuyers(r.uids, (n) => `Order ${n} dispatched`, (n) => `Your order ${n} is on the way. Track it in the app.`);
  return { ok: true };
}

/** One stop done: delivered (who received it) or not delivered (why). */
export async function finishStop(
  riderId: number,
  stopId: number,
  input: { delivered: boolean; receivedBy?: string | null; note?: string | null } & Pos,
): Promise<Result> {
  const r = await tx(async (c) => {
    const s = (await c.query<{ order_uid: string; status: string; trip_status: string; transporter_id: number | null; flat: number | null; flng: number | null; name: string }>(
      `select s.order_uid, s.status, t.status as trip_status, t.transporter_id, f.latitude::float as flat, f.longitude::float as flng, r.name
         from dist_trip_stop s join dist_trip t on t.id = s.trip_id join fp_booking_order b on b.uid = s.order_uid
         join fp_firm f on f.uid = b.from_firm_uid left join shop_rider r on r.id = t.transporter_id
        where s.id = $1 for update of s`,
      [stopId],
    )).rows[0];
    if (!s || s.transporter_id !== riderId) return { ok: false as const, error: "This stop is not on your trip." };
    if (s.trip_status !== "on_the_way") return { ok: false as const, error: "Start the trip first." };
    if (s.status !== "pending") return { ok: false as const, error: "This stop is already done." };
    const note = input.note?.trim().slice(0, 300) || null;
    if (!input.delivered && !note) return { ok: false as const, error: "Say why it was not delivered." };
    const gap = okPos(input) && s.flat !== null && s.flng !== null ? Math.round(haversine({ lat: input.lat!, lng: input.lng! }, { lat: s.flat, lng: s.flng })) : null;
    await c.query(
      `update dist_trip_stop set status = $2, delivered_at = now(), lat = $3, lng = $4, gap_m = $5, received_by = $6, note = $7, updated_at = now() where id = $1`,
      [stopId, input.delivered ? "delivered" : "not_delivered", okPos(input) ? input.lat : null, okPos(input) ? input.lng : null, gap,
        input.receivedBy?.trim().slice(0, 80) || null, note],
    );
    const received = input.receivedBy?.trim() ? `Received by ${input.receivedBy.trim().slice(0, 80)}` : null;
    await event(c, s.order_uid, input.delivered ? "delivered" : "not_delivered", s.name ?? "Transporter", "transporter", input.delivered ? received : note);
    return { ok: true as const, uid: s.order_uid };
  });
  if (!r.ok) return r;
  if (input.delivered) await tellBuyers([r.uid], (n) => `Order ${n} delivered`, (n) => `Your order ${n} was delivered. Thank you!`);
  return { ok: true };
}

/** The trip is over. Stops not done by then are recorded as not delivered ("Not visited"). */
export async function endTrip(riderId: number, tripId: number, pos: Pos): Promise<Result> {
  return tx(async (c) => {
    const t = (await c.query<{ status: string; transporter_id: number | null; name: string | null }>(
      `select t.status, t.transporter_id, r.name from dist_trip t left join shop_rider r on r.id = t.transporter_id where t.id = $1 for update of t`,
      [tripId],
    )).rows[0];
    if (!t || t.transporter_id !== riderId) return { ok: false as const, error: "This trip is not yours." };
    if (t.status !== "on_the_way") return { ok: false as const, error: "This trip is not on the road." };
    const left = (await c.query<{ id: number; order_uid: string }>(`select id, order_uid from dist_trip_stop where trip_id = $1 and status = 'pending'`, [tripId])).rows;
    for (const s of left) {
      await c.query(`update dist_trip_stop set status = 'not_delivered', note = 'Not visited', delivered_at = now(), updated_at = now() where id = $1`, [s.id]);
      await event(c, s.order_uid, "not_delivered", t.name ?? "Transporter", "transporter", "Not visited");
    }
    await c.query(
      `update dist_trip set status = 'completed', ended_at = now(), end_lat = $2, end_lng = $3, updated_at = now() where id = $1`,
      [tripId, okPos(pos) ? pos.lat : null, okPos(pos) ? pos.lng : null],
    );
    return { ok: true as const };
  });
}

// ------------------------------------------------------------------------------------------------ the buyer's view

export interface OrderTracking {
  stage: "placed" | "confirmed" | "dispatched" | "delivered" | "not_delivered" | "cancelled";
  trip: {
    id: number;
    route: string;
    status: TripStatus;
    vehicleNo: string | null;
    transporter: { name: string; phone: string } | null;
    /** the truck, while the trip is on the road */
    truck: { lat: number; lng: number; at: string } | null;
    startedAt: string | null;
    stopsBefore: number;
    stop: { status: StopStatus; deliveredAt: string | null; receivedBy: string | null; note: string | null };
  } | null;
}

/** Where each order is on the road, for the buyer's app (one query for the whole list). */
export async function trackingOf(orderUids: string[]): Promise<Map<string, OrderTracking>> {
  const out = new Map<string, OrderTracking>();
  if (!orderUids.length) return out;
  const rows = await query<{
    uid: string; ostatus: string; trip_id: number | null; route: string | null; tstatus: TripStatus | null; vehicle: string | null; name: string | null; phone: string | null;
    lat: number | null; lng: number | null; loc_at: Date | null; started_at: Date | null; status: StopStatus | null; delivered_at: Date | null;
    received_by: string | null; note: string | null; before: number | null;
  }>(
    `select b.uid, b.status as ostatus, t.id as trip_id, t.route_name as route, t.status as tstatus, t.vehicle_no as vehicle, r.name, r.phone, r.lat, r.lng,
            r.location_at as loc_at, t.started_at, s.status, s.delivered_at, s.received_by, s.note,
            (select count(*)::int from dist_trip_stop x where x.trip_id = t.id and x.seq < s.seq and x.status = 'pending') as before
       from fp_booking_order b
       left join dist_trip_stop s on s.order_uid = b.uid
       left join dist_trip t on t.id = s.trip_id
       left join shop_rider r on r.id = t.transporter_id
      where b.uid = any($1::uuid[])`,
    [orderUids],
  );
  for (const s of rows) {
    const st = s.ostatus.toLowerCase();
    const stage: OrderTracking["stage"] = /cancel|reject/.test(st) ? "cancelled"
      : s.status === "delivered" ? "delivered"
        : s.status === "not_delivered" ? "not_delivered"
          : s.tstatus === "on_the_way" ? "dispatched"
            : st === "confirmed" ? "confirmed" : "placed";
    // the truck is shown only while it is on the way to this stop and its position is fresh
    const live = s.tstatus === "on_the_way" && s.status === "pending" && s.lat !== null && s.lng !== null && !!s.loc_at && Date.now() - new Date(s.loc_at).getTime() < 30 * 60_000;
    out.set(s.uid, {
      stage,
      trip: s.trip_id === null ? null : {
        id: s.trip_id,
        route: s.route ?? "",
        status: s.tstatus!,
        vehicleNo: s.vehicle,
        transporter: s.name ? { name: s.name, phone: s.phone ?? "" } : null,
        truck: live ? { lat: s.lat!, lng: s.lng!, at: new Date(s.loc_at!).toISOString() } : null,
        startedAt: s.started_at ? new Date(s.started_at).toISOString() : null,
        stopsBefore: s.before ?? 0,
        stop: { status: s.status!, deliveredAt: s.delivered_at ? new Date(s.delivered_at).toISOString() : null, receivedBy: s.received_by, note: s.note },
      },
    });
  }
  return out;
}
