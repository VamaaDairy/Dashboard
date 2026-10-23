import "server-only";
import { one, query, tx } from "@/lib/db";
import { shop } from "@/lib/whatsapp/config";
import { notifyOrderStatus, notifyRiderAssigned } from "@/lib/push";
import { pricesFor } from "./catalog";
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
    return { sku, qty, name: p.name, image: p.image, unit: p.price, total: Math.round(p.price * qty * 100) / 100 };
  });
  const subtotal = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
  const fee = deliveryFor(subtotal, deliveryRule);

  const placed = await tx(async (c) => {
    const o = await c.query(
      `insert into shop_order (name, phone, address, pincode, notes, lat, lng, subtotal, delivery_fee, total, customer_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id, access_key`,
      [input.name, input.phone, input.address, input.pincode, input.notes, input.lat, input.lng, subtotal, fee, subtotal + fee, input.customerId ?? null],
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
  await notifyOrderStatus(placed.id, "placed");
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
  /** Set when the order was made from a subscription (the delivery day, YYYY-MM-DD). */
  subscription_day: string | null;
  lat: number | null;
  lng: number | null;
  rider_id: number | null;
  assigned_at: Date | null;
  picked_up_at: Date | null;
  delivered_at: Date | null;
  delivery_otp: string;
  rider: { name: string; phone: string; lat: number | null; lng: number | null; location_at: Date | null } | null;
  items: Array<{ sku_code: string; name: string; image_url: string | null; qty: number; unit_price: number; line_total: number }>;
}

const WITH_ITEMS = `
  select o.*, coalesce((
    select json_agg(json_build_object('sku_code', i.sku_code, 'name', i.name, 'image_url', i.image_url, 'qty', i.qty,
                                      'unit_price', i.unit_price, 'line_total', i.line_total) order by i.id)
    from shop_order_item i where i.order_id = o.id), '[]'::json) as items,
    (select json_build_object('name', r.name, 'phone', r.phone, 'lat', r.lat, 'lng', r.lng, 'location_at', r.location_at)
     from shop_rider r where r.id = o.rider_id) as rider
  from shop_order o`;

export const getOrderByKey = (key: string) =>
  /^[0-9a-f]{32}$/.test(key) ? one<ShopOrder>(`${WITH_ITEMS} where o.access_key = $1`, [key]) : Promise.resolve(null);

export const listOrders = (status?: string, kind?: "regular" | "subscription") => {
  const where = [status ? "o.status = $1" : "", kind === "subscription" ? "o.subscription_day is not null" : kind === "regular" ? "o.subscription_day is null" : ""].filter(Boolean);
  return query<ShopOrder>(`${WITH_ITEMS} ${where.length ? `where ${where.join(" and ")}` : ""} order by o.created_at desc limit 200`, status ? [status] : []);
};

export async function setOrderStatus(id: number, status: string): Promise<boolean> {
  const r = await query<{ changed: boolean }>(
    `update shop_order o set status = $2, updated_at = now(),
       payment_status = case when $2 = 'delivered' then 'paid' else o.payment_status end
     from (select id, status as was from shop_order where id = $1) p
     where o.id = p.id returning p.was is distinct from $2 as changed`,
    [id, status],
  );
  if (r[0]?.changed) await notifyOrderStatus(id, status);
  return r.length > 0;
}

/** Staff give an order to a rider (or take it back with null). A placed order becomes confirmed. */
export async function assignRider(orderId: number, riderId: number | null): Promise<boolean> {
  const r = await query<{ status: string; was_status: string; was_rider: number | null }>(
    `update shop_order o set rider_id = $2, assigned_at = case when $2::int is null then null else now() end,
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

/** The orders a rider still has to deliver, oldest first. */
export const riderOrders = (riderId: number) =>
  query<ShopOrder>(`${WITH_ITEMS} where o.rider_id = $1 and o.status in ('confirmed', 'out_for_delivery') order by o.assigned_at`, [riderId]);

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

/** Delivered only with the customer's OTP; cash on delivery is then marked paid. */
export async function riderDeliver(riderId: number, id: number, otp: string): Promise<"ok" | "wrong_otp" | "not_found"> {
  const o = await one<{ delivery_otp: string }>(`select delivery_otp from shop_order where id = $1 and rider_id = $2 and status = 'out_for_delivery'`, [id, riderId]);
  if (!o) return "not_found";
  if (o.delivery_otp !== otp) return "wrong_otp";
  await query(`update shop_order set status = 'delivered', delivered_at = now(), payment_status = 'paid', updated_at = now() where id = $1`, [id]);
  await notifyOrderStatus(id, "delivered");
  return "ok";
}

export const setRiderLocation = (riderId: number, lat: number, lng: number) =>
  query(`update shop_rider set lat = $2, lng = $3, location_at = now() where id = $1`, [riderId, lat, lng]);
