import "server-only";
import { one, query, tx } from "@/lib/db";
import { shop } from "@/lib/whatsapp/config";
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

  const key = await tx(async (c) => {
    const o = await c.query(
      `insert into shop_order (name, phone, address, pincode, notes, lat, lng, subtotal, delivery_fee, total)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id, access_key`,
      [input.name, input.phone, input.address, input.pincode, input.notes, input.lat, input.lng, subtotal, fee, subtotal + fee],
    );
    for (const i of items) {
      await c.query(
        `insert into shop_order_item (order_id, sku_code, name, image_url, qty, unit_price, line_total) values ($1, $2, $3, $4, $5, $6, $7)`,
        [o.rows[0].id, i.sku, i.name, i.image, i.qty, i.unit, i.total],
      );
    }
    return o.rows[0].access_key as string;
  });
  return { ok: true, accessKey: key };
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

export const listOrders = (status?: string) =>
  query<ShopOrder>(`${WITH_ITEMS} ${status ? "where o.status = $1" : ""} order by o.created_at desc limit 200`, status ? [status] : []);

export async function setOrderStatus(id: number, status: string): Promise<boolean> {
  const r = await query(
    `update shop_order set status = $2, updated_at = now(),
       payment_status = case when $2 = 'delivered' then 'paid' else payment_status end
     where id = $1 returning id`,
    [id, status],
  );
  return r.length > 0;
}

/** Staff give an order to a rider (or take it back with null). A placed order becomes confirmed. */
export async function assignRider(orderId: number, riderId: number | null): Promise<boolean> {
  const r = await query(
    `update shop_order set rider_id = $2, assigned_at = case when $2::int is null then null else now() end,
       status = case when $2::int is not null and status = 'placed' then 'confirmed' else status end, updated_at = now()
     where id = $1 and status in ('placed', 'confirmed', 'out_for_delivery') returning id`,
    [orderId, riderId],
  );
  return r.length > 0;
}

/** The orders a rider still has to deliver, oldest first. */
export const riderOrders = (riderId: number) =>
  query<ShopOrder>(`${WITH_ITEMS} where o.rider_id = $1 and o.status in ('confirmed', 'out_for_delivery') order by o.assigned_at`, [riderId]);

export const riderOrder = (riderId: number, id: number) =>
  one<ShopOrder>(`${WITH_ITEMS} where o.rider_id = $1 and o.id = $2`, [riderId, id]);

export async function riderPickup(riderId: number, id: number): Promise<boolean> {
  const r = await query(
    `update shop_order set status = 'out_for_delivery', picked_up_at = coalesce(picked_up_at, now()), updated_at = now()
     where id = $1 and rider_id = $2 and status in ('confirmed', 'out_for_delivery') returning id`,
    [id, riderId],
  );
  return r.length > 0;
}

/** Delivered only with the customer's OTP; cash on delivery is then marked paid. */
export async function riderDeliver(riderId: number, id: number, otp: string): Promise<"ok" | "wrong_otp" | "not_found"> {
  const o = await one<{ delivery_otp: string }>(`select delivery_otp from shop_order where id = $1 and rider_id = $2 and status = 'out_for_delivery'`, [id, riderId]);
  if (!o) return "not_found";
  if (o.delivery_otp !== otp) return "wrong_otp";
  await query(`update shop_order set status = 'delivered', delivered_at = now(), payment_status = 'paid', updated_at = now() where id = $1`, [id]);
  return "ok";
}

export const setRiderLocation = (riderId: number, lat: number, lng: number) =>
  query(`update shop_rider set lat = $2, lng = $3, location_at = now() where id = $1`, [riderId, lat, lng]);
