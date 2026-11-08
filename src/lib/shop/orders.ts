import "server-only";
import { chargeDelivered } from "./autopay";
import { one, query, tx } from "@/lib/db";
import { shop } from "@/lib/whatsapp/config";
import { notifyOrderStatus, notifyRiderAssigned } from "@/lib/push";
import { expireUnpaid } from "@/lib/payments/easebuzz";
import { haversine } from "./route-plan";
import { photoUrlOf, pricesFor } from "./catalog";
import { deliveryFor, MAX_LINE_QTY, MAX_LINES, type DeliveryRule } from "./pricing";

export const deliveryRule: DeliveryRule = { fee: shop.deliveryFee, freeAbove: shop.freeDeliveryAbove };

export interface OrderInput {
  name: string;
  phone: string;
  address: string;
  pincode: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  lines: Array<{ sku: string; qty: number }>;
  /** The signed-in account placing it (the app requires one). */
  customerId?: number | null;
  /** "online": the order waits for its Easebuzz payment before it is placed; else cash on delivery. */
  paymentMethod?: "cod" | "online";
}

export type PlaceResult = { ok: true; accessKey: string } | { ok: false; error: string };

/** Per-phone limit so the public form can't be used to flood the order list. */
const RECENT_LIMIT = 5;

export async function placeOrder(input: OrderInput): Promise<PlaceResult> {
  const merged = new Map<string, number>();
  for (const l of input.lines) merged.set(l.sku, (merged.get(l.sku) ?? 0) + l.qty);
  if (!merged.size) return { ok: false, error: "Your cart is empty." };
  if (merged.size > MAX_LINES) return { ok: false, error: "Too many different items in one order." };
  for (const q of merged.values()) if (!Number.isInteger(q) || q < 1 || q > MAX_LINE_QTY) return { ok: false, error: `You can order at most ${MAX_LINE_QTY} of one item.` };

  const prices = await pricesFor([...merged.keys()]);
  const gone = [...merged.keys()].filter((s) => !prices.has(s));
  if (gone.length) return { ok: false, error: "Some items in your cart are no longer available. Please review your cart." };

  const recent = await one<{ n: number }>(
    `select count(*)::int as n from shop_order where phone = $1 and created_at > now() - interval '30 minutes'`,
    [input.phone],
  );
  if ((recent?.n ?? 0) >= RECENT_LIMIT) return { ok: false, error: "Too many orders from this number just now. Please try again later." };

  const items = [...merged].map(([sku, qty]) => {
    const p = prices.get(sku)!;
    return { sku, qty, name: p.size ? `${p.name} ${p.size}` : p.name, image: p.image, unit: p.price, total: Math.round(p.price * qty * 100) / 100 };
  });
  const subtotal = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
  const fee = deliveryFor(subtotal, deliveryRule);

  const online = input.paymentMethod === "online";
  if (online) await expireUnpaid();
  const placed = await tx(async (c) => {
    const o = await c.query(
      `insert into shop_order (name, phone, address, pincode, notes, lat, lng, subtotal, delivery_fee, total, customer_id, payment_method, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id, access_key`,
      [
        input.name, input.phone, input.address, input.pincode, input.notes, input.lat, input.lng, subtotal, fee, subtotal + fee, input.customerId ?? null,
        online ? "online" : "cod", online ? "awaiting_payment" : "placed",
      ],
    );
    // the account remembers where it last ordered to, so the next checkout is pre-filled
    if (input.customerId) {
      await c.query(`update shop_customer set address = $2, pincode = $3, lat = $4, lng = $5 where id = $1`, [input.customerId, input.address, input.pincode, input.lat, input.lng]);
    }
    for (const i of items) {
      await c.query(
        `insert into shop_order_item (order_id, sku_code, name, image_url, qty, unit_price, line_total) values ($1, $2, $3, $4, $5, $6, $7)`,
        [o.rows[0].id, i.sku, i.name, i.image, i.qty, i.unit, i.total],
      );
    }
    return { id: o.rows[0].id as number, key: o.rows[0].access_key as string };
  });
  // an online order reaches the team once Easebuzz confirms the payment (lib/payments/easebuzz.ts)
  if (!online) await notifyOrderStatus(placed.id, "placed");
  return { ok: true, accessKey: placed.key };
}

export interface ShopOrder {
  id: number;
  order_no: string;
  access_key: string;
  name: string;
  phone: string;
  address: string;
  pincode: string | null;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: Date;
  updated_at?: Date;
  /** Set when the order was made from a subscription (the delivery day, YYYY-MM-DD). */
  subscription_day: string | null;
  lat: number | null;
  lng: number | null;
  rider_id: number | null;
  assigned_at: Date | null;
  picked_up_at: Date | null;
  delivered_at: Date | null;
  delivery_otp: string;
  /** The customer's 1-5 star rating of the delivery partner, once given. */
  rider_rating: number | null;
  rider_rating_note: string | null;
  /** Its place in the rider's delivery order, and the metres from the stop before (see route-plan). */
  delivery_seq: number | null;
  delivery_leg_m: number | null;
  rider: { name: string; phone: string; lat: number | null; lng: number | null; location_at: Date | null } | null;
  items: Array<{ sku_code: string; name: string; image_url: string | null; qty: number; unit_price: number; line_total: number }>;
}

export const WITH_ITEMS = `
  select o.*, coalesce((
    -- the product's photo as it is now (the link saved with an old order may no longer open)
    select json_agg(json_build_object('sku_code', i.sku_code, 'name', i.name, 'qty', i.qty,
                                      'image_url', coalesce((select ${photoUrlOf("ph")} from fp_product p join fp_product_image ph on ph.product_uid = p.uid
                                                             where p.sku_code = i.sku_code and ph.archived_at is null order by ph.imagesno nulls last limit 1), i.image_url),
                                      'unit_price', i.unit_price, 'line_total', i.line_total) order by i.id)
    from shop_order_item i where i.order_id = o.id), '[]'::json) as items,
    (select json_build_object('name', r.name, 'phone', r.phone, 'lat', r.lat, 'lng', r.lng, 'location_at', r.location_at)
     from shop_rider r where r.id = o.rider_id) as rider
  from shop_order o`;

export const getOrderByKey = (key: string) =>
  /^[0-9a-f]{32}$/.test(key) ? one<ShopOrder>(`${WITH_ITEMS} where o.access_key = $1`, [key]) : Promise.resolve(null);

export const getOrderById = (id: number) =>
  Number.isInteger(id) && id > 0 ? one<ShopOrder>(`${WITH_ITEMS} where o.id = $1`, [id]) : Promise.resolve(null);

/**
 * A customer's orders for an invoice: every order whose day falls from [from] to [to] (YYYY-MM-DD, both
 * included), oldest first. The day is the delivery day of a subscription order, else the day it was placed in India.
 */
export const listCustomerOrdersBetween = (customerId: number, phone: string, from: string, to: string) =>
  query<ShopOrder & { bill_day: string }>(
    `select f.*, to_char(f.day, 'YYYY-MM-DD') as bill_day from (
       select w.*, coalesce(w.subscription_day, (w.created_at at time zone 'Asia/Kolkata')::date) as day
       from (${WITH_ITEMS} where o.customer_id = $1 or o.phone = $2) w
     ) f where f.day between $3::date and $4::date order by f.day, f.created_at`,
    [customerId, phone, from, to],
  );

/** [q] matches the order number, customer name or phone, or the address. */
export const listOrders = (status?: string, kind?: "regular" | "subscription", q?: string) => {
  const params: unknown[] = [];
  const where = [kind === "subscription" ? "o.subscription_day is not null" : kind === "regular" ? "o.subscription_day is null" : ""].filter(Boolean);
  if (status) {
    params.push(status);
    where.push(`o.status = $${params.length}`);
  }
  if (q?.trim()) {
    params.push(`%${q.trim()}%`);
    const p = `$${params.length}`;
    where.push(`(o.order_no ilike ${p} or o.name ilike ${p} or o.phone ilike ${p} or o.address ilike ${p})`);
  }
  return query<ShopOrder>(`${WITH_ITEMS} ${where.length ? `where ${where.join(" and ")}` : ""} order by o.created_at desc limit 200`, params);
};

export async function setOrderStatus(id: number, status: string): Promise<boolean> {
  const r = await query<{ changed: boolean }>(
    `update shop_order o set status = $2, updated_at = now(),
       -- cash is collected at the door; an autopay order is paid when its debit goes through
       payment_status = case when $2 = 'delivered' and o.payment_method <> 'autopay' then 'paid' else o.payment_status end
     from (select id, status as was from shop_order where id = $1) p
     where o.id = p.id returning p.was is distinct from $2 as changed`,
    [id, status],
  );
  if (r[0]?.changed) await notifyOrderStatus(id, status);
  if (r[0]?.changed && status === "delivered") await chargeDelivered(id);
  return r.length > 0;
}

/** Staff give an order to a rider (or take it back with null). A placed order becomes confirmed. */
export async function assignRider(orderId: number, riderId: number | null): Promise<boolean> {
  // D2C home deliveries go to delivery boys only, never to a transporter
  if (riderId != null && !(await one(`select 1 from shop_rider where id = $1 and kind = 'delivery'`, [riderId]))) return false;
  const r = await query<{ status: string; was_status: string; was_rider: number | null }>(
    `update shop_order o set rider_id = $2, assigned_at = case when $2::int is null then null else now() end,
       delivery_seq = case when o.rider_id is distinct from $2 then null else o.delivery_seq end,
       status = case when $2::int is not null and o.status = 'placed' then 'confirmed' else o.status end, updated_at = now()
     from (select id, status as was_status, rider_id as was_rider from shop_order where id = $1) p
     where o.id = p.id and o.status in ('placed', 'confirmed', 'out_for_delivery')
     returning o.status, p.was_status, p.was_rider`,
    [orderId, riderId],
  );
  if (r[0]) {
    if (riderId != null && r[0].was_rider !== riderId) await notifyRiderAssigned(orderId, riderId);
    if (r[0].status !== r[0].was_status) await notifyOrderStatus(orderId, r[0].status);
  }
  return r.length > 0;
}

/** The orders a rider still has to deliver, in the order to deliver them (see route-plan). */
export const riderOrders = (riderId: number) =>
  query<ShopOrder>(`${WITH_ITEMS} where o.rider_id = $1 and o.status in ('confirmed', 'out_for_delivery') order by o.delivery_seq nulls last, o.assigned_at`, [riderId]);

export const riderOrder = (riderId: number, id: number) =>
  one<ShopOrder>(`${WITH_ITEMS} where o.rider_id = $1 and o.id = $2`, [riderId, id]);

export async function riderPickup(riderId: number, id: number): Promise<boolean> {
  const r = await query<{ changed: boolean }>(
    `update shop_order o set status = 'out_for_delivery', picked_up_at = coalesce(o.picked_up_at, now()), updated_at = now()
     from (select id, status as was from shop_order where id = $1) p
     where o.id = p.id and o.rider_id = $2 and o.status in ('confirmed', 'out_for_delivery') returning p.was <> 'out_for_delivery' as changed`,
    [id, riderId],
  );
  if (r[0]?.changed) await notifyOrderStatus(id, "out_for_delivery");
  return r.length > 0;
}

/**
 * The customer rates the delivery partner, 1 to 5 stars and an optional note, within a week of delivery
 * (they can change it in that time). The order's access key is the customer's proof, as for tracking.
 */
export async function rateDelivery(key: string, stars: number, note: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!/^[0-9a-f]{32}$/.test(key)) return { ok: false, status: 404, error: "Order not found." };
  const r = await one<{ id: number }>(
    `update shop_order set rider_rating = $2, rider_rating_note = $3, rated_at = now(), updated_at = now()
      where access_key = $1 and status = 'delivered' and rider_id is not null and delivered_at > now() - interval '7 days'
      returning id`,
    [key, stars, note.slice(0, 300) || null],
  );
  if (r) return { ok: true };
  const o = await one<{ status: string; rider_id: number | null }>(`select status, rider_id from shop_order where access_key = $1`, [key]);
  if (!o) return { ok: false, status: 404, error: "Order not found." };
  if (o.status !== "delivered" || o.rider_id == null) return { ok: false, status: 409, error: "You can rate the delivery once the order is delivered." };
  return { ok: false, status: 409, error: "This delivery can no longer be rated." };
}

/** Delivered only with the customer's OTP; cash on delivery is then marked paid. */
export async function riderDeliver(riderId: number, id: number, otp: string): Promise<"ok" | "wrong_otp" | "not_found"> {
  const o = await one<{ delivery_otp: string }>(`select delivery_otp from shop_order where id = $1 and rider_id = $2 and status = 'out_for_delivery'`, [id, riderId]);
  if (!o) return "not_found";
  if (o.delivery_otp !== otp) return "wrong_otp";
  // the rider's rate at the moment of handover is what this delivery earned them
  await query(
    `update shop_order set status = 'delivered', delivered_at = now(), updated_at = now(),
            payment_status = case when payment_method = 'autopay' then payment_status else 'paid' end,
            rider_pay = (select pay_per_delivery from shop_rider where id = $2)
      where id = $1`,
    [id, riderId],
  );
  await notifyOrderStatus(id, "delivered");
  await chargeDelivered(id);
  return "ok";
}

/**
 * The rider's phone says where it is. The stretch since its last position is added to today's distance
 * when it looks like riding: the last position under 10 minutes old, at least 15 m (GPS jitter below
 * that), under 2 km and under 100 km/h (a jump, not a ride).
 */
export async function setRiderLocation(riderId: number, lat: number, lng: number): Promise<void> {
  const prev = await one<{ lat: number | null; lng: number | null; secs: number | null }>(
    `update shop_rider r set lat = $2, lng = $3, location_at = now()
       from (select lat, lng, extract(epoch from now() - location_at)::float as secs from shop_rider where id = $1) p
      where r.id = $1 returning p.lat, p.lng, p.secs`,
    [riderId, lat, lng],
  );
  const fresh = !!prev && prev.lat != null && prev.lng != null && prev.secs != null && prev.secs <= 600;
  const m = fresh ? haversine({ lat: prev.lat!, lng: prev.lng! }, { lat, lng }) : 0;
  // the track the Dashboard draws (delivery and rider tracking): every position except a GPS jump
  if (!fresh || m / Math.max(prev!.secs!, 1) <= 28) {
    await query(`insert into shop_rider_ping (rider_id, lat, lng) values ($1, $2, $3)`, [riderId, lat, lng]);
    if (Math.random() < 0.01) await query(`delete from shop_rider_ping where rider_id = $1 and at < now() - interval '90 days'`, [riderId]);
  }
  if (!fresh) return;
  if (m < 15 || m > 2000 || m / Math.max(prev!.secs!, 1) > 28) return;
  await query(
    `insert into shop_rider_km (rider_id, day, metres) values ($1, (now() at time zone 'Asia/Kolkata')::date, $2)
     on conflict (rider_id, day) do update set metres = shop_rider_km.metres + excluded.metres`,
    [riderId, Math.round(m)],
  );
}
