import "server-only";
import { one, query } from "@/lib/db";
import { WITH_ITEMS, type ShopOrder } from "./orders";
import { haversine } from "./route-plan";

/**
 * The D2C orders table: filters, paging, counts per status and today's figures. Read-only - status and rider
 * changes go through the existing actions (lib/shop/actions), exactly as before.
 */

export type DateRange = "today" | "yesterday" | "7d" | "30d" | "all" | "custom";
export const DATE_RANGES: Array<[DateRange, string]> = [["all", "All dates"], ["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["custom", "Custom range"]];

export interface BoardFilter {
  status?: string;
  kind?: "regular" | "subscription";
  q?: string;
  range: DateRange;
  from?: string;
  to?: string;
  pay?: "cod" | "online" | "autopay";
  /** a rider id, or "none" for not assigned */
  rider?: string;
  pin?: string;
  page: number;
}

export const PAGE_SIZE = 50;

/** The order's day: a subscription's delivery day, else the day it was placed (India time). */
const DAY = `coalesce(o.subscription_day, (o.created_at at time zone 'Asia/Kolkata')::date)`;
const TODAY = `(now() at time zone 'Asia/Kolkata')::date`;

function where(f: BoardFilter, withStatus: boolean) {
  const params: unknown[] = [];
  const w: string[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (f.range === "today") w.push(`${DAY} = ${TODAY}`);
  else if (f.range === "yesterday") w.push(`${DAY} = ${TODAY} - 1`);
  else if (f.range === "7d") w.push(`${DAY} > ${TODAY} - 7`);
  else if (f.range === "30d") w.push(`${DAY} > ${TODAY} - 30`);
  else if (f.range === "custom") {
    if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) w.push(`${DAY} >= ${p(f.from)}::date`);
    if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) w.push(`${DAY} <= ${p(f.to)}::date`);
  }
  if (f.kind === "subscription") w.push("o.subscription_day is not null");
  if (f.kind === "regular") w.push("o.subscription_day is null");
  if (f.pay) w.push(`o.payment_method = ${p(f.pay)}`);
  if (f.rider === "none") w.push("o.rider_id is null");
  else if (f.rider && /^\d+$/.test(f.rider)) w.push(`o.rider_id = ${p(Number(f.rider))}`);
  if (f.pin) w.push(`o.pincode = ${p(f.pin)}`);
  if (f.q?.trim()) {
    const s = p(`%${f.q.trim()}%`);
    w.push(`(o.order_no ilike ${s} or o.name ilike ${s} or o.phone ilike ${s} or o.address ilike ${s} or o.pincode ilike ${s})`);
  }
  if (withStatus && f.status) w.push(`o.status = ${p(f.status)}`);
  return { sql: w.length ? `where ${w.join(" and ")}` : "", params };
}

export interface BoardRow extends ShopOrder {
  /** this customer's how-many-th order (by phone, cancelled ones not counted) */
  nth: number;
}

export interface Board {
  rows: BoardRow[];
  total: number;
  /** sum of order totals over every page of the filtered list (cancelled left out) */
  value: number;
  counts: Record<string, number>;
  all: number;
}

export async function orderBoard(f: BoardFilter): Promise<Board> {
  const list = where(f, true);
  const forCounts = where(f, false);
  const offset = (Math.max(1, f.page) - 1) * PAGE_SIZE;
  const [rows, sum, counts] = await Promise.all([
    query<BoardRow>(
      `select w.*, (select count(*)::int from shop_order x where x.phone = w.phone and (x.status <> 'cancelled' or x.id = w.id) and x.created_at <= w.created_at) as nth
         from (${WITH_ITEMS} ${list.sql} order by o.created_at desc limit ${PAGE_SIZE} offset ${offset}) w
        order by w.created_at desc`,
      list.params,
    ),
    one<{ n: number; v: number }>(
      `select count(*)::int as n, coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0)::float as v from shop_order o ${list.sql}`,
      list.params,
    ),
    query<{ status: string; n: number }>(`select o.status, count(*)::int as n from shop_order o ${forCounts.sql} group by o.status`, forCounts.params),
  ]);
  return {
    rows,
    total: sum?.n ?? 0,
    value: sum?.v ?? 0,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    all: counts.reduce((a, c) => a + c.n, 0),
  };
}

export interface Today {
  orders: number; subscription: number; value: number;
  toDeliver: number; unassigned: number;
  cashToCollect: number; codOut: number;
  awaitingPayment: number;
}

/** Today's figures for the strip at the top, whatever the filters. */
export async function today(): Promise<Today> {
  const r = await one<Today>(
    `select count(*) filter (where status <> 'cancelled' and status <> 'awaiting_payment')::int as orders,
            count(*) filter (where subscription_day is not null and status <> 'cancelled')::int as subscription,
            coalesce(sum(total) filter (where status not in ('cancelled', 'awaiting_payment')), 0)::float as value,
            count(*) filter (where status in ('placed', 'confirmed', 'out_for_delivery'))::int as "toDeliver",
            count(*) filter (where status in ('placed', 'confirmed') and rider_id is null)::int as unassigned,
            coalesce(sum(total) filter (where payment_method = 'cod' and payment_status = 'pending' and status in ('placed', 'confirmed', 'out_for_delivery')), 0)::float as "cashToCollect",
            count(*) filter (where payment_method = 'cod' and status = 'out_for_delivery')::int as "codOut",
            count(*) filter (where status = 'awaiting_payment')::int as "awaitingPayment"
       from shop_order o where ${DAY} = ${TODAY}`,
  );
  return r ?? { orders: 0, subscription: 0, value: 0, toDeliver: 0, unassigned: 0, cashToCollect: 0, codOut: 0, awaitingPayment: 0 };
}

/** Pincodes seen in the last 90 days, most orders first, for the filter. */
export const recentPincodes = () =>
  query<{ pin: string; n: number }>(
    `select pincode as pin, count(*)::int as n from shop_order where pincode is not null and pincode <> '' and created_at > now() - interval '90 days'
      group by pincode order by count(*) desc limit 60`,
  );

// ---------------------------------------------------------------- the tracking column

export interface Tracking {
  /** 0 placed, 1 confirmed, 2 rider assigned, 3 picked up, 4 delivered; null when cancelled / awaiting payment */
  step: number | null;
  text: string;
  live: boolean;
  /** minutes the order has waited longer than it should at this step */
  late: number | null;
}

const hm = (d: Date | string) => new Date(d).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
const minsBetween = (a: Date | string, b: Date | string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
const duration = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);

/** Where an order is on its way to the customer, in one line. */
export function trackingOf(o: ShopOrder, now = new Date()): Tracking {
  if (o.status === "cancelled") return { step: null, text: `Cancelled ${hm(o.updated_at ?? o.created_at)}`, live: false, late: null };
  if (o.status === "awaiting_payment") return { step: null, text: "Waiting for online payment", live: false, late: null };
  if (o.status === "delivered" || o.delivered_at) {
    const took = o.picked_up_at && o.delivered_at ? ` · ${duration(minsBetween(o.picked_up_at, o.delivered_at))} after pick-up` : "";
    return { step: 4, text: `Delivered${o.delivered_at ? ` ${hm(o.delivered_at)}` : ""}${took}${o.rider_rating ? ` · ★ ${o.rider_rating}` : ""}`, live: false, late: null };
  }
  if (o.picked_up_at) {
    const r = o.rider;
    let text = `On the way since ${hm(o.picked_up_at)}`;
    let live = false;
    if (r?.lat != null && r.lng != null && o.lat != null && o.lng != null && r.location_at) {
      const age = minsBetween(r.location_at, now);
      const km = haversine({ lat: r.lat, lng: r.lng }, { lat: o.lat, lng: o.lng }) / 1000;
      live = age <= 10;
      text = `${km < 10 ? km.toFixed(1) : Math.round(km)} km away · ${age <= 0 ? "just now" : `${duration(age)} ago`}`;
    }
    const out = minsBetween(o.picked_up_at, now);
    return { step: 3, text, live, late: out > 90 ? out - 90 : null };
  }
  if (o.rider_id) return { step: 2, text: `Assigned ${o.assigned_at ? hm(o.assigned_at) : ""}, not picked up`, live: false, late: null };
  // subscription orders are made ahead of their day, so only regular orders can be late here
  const waited = o.subscription_day ? 0 : minsBetween(o.created_at, now);
  if (o.status === "confirmed") return { step: 1, text: "Waiting for a rider", live: false, late: waited > 60 ? waited - 60 : null };
  return { step: 0, text: "Not confirmed yet", live: false, late: waited > 30 ? waited - 30 : null };
}

// ---------------------------------------------------------------- the URL's filters

export type BoardParams = { status?: string; kind?: string; q?: string; range?: string; from?: string; to?: string; pay?: string; rider?: string; pin?: string; page?: string };

const STATUSES = ["awaiting_payment", "placed", "confirmed", "out_for_delivery", "delivered", "cancelled"];

export function boardFilter(sp: BoardParams): BoardFilter {
  return {
    status: sp.status && STATUSES.includes(sp.status) ? sp.status : undefined,
    kind: sp.kind === "regular" || sp.kind === "subscription" ? sp.kind : undefined,
    q: sp.q?.trim() || undefined,
    range: DATE_RANGES.some(([r]) => r === sp.range) ? (sp.range as DateRange) : "all",
    from: sp.from, to: sp.to,
    pay: sp.pay === "cod" || sp.pay === "online" || sp.pay === "autopay" ? sp.pay : undefined,
    rider: sp.rider || undefined,
    pin: sp.pin || undefined,
    page: Math.max(1, Number(sp.page) || 1),
  };
}

/** Every order the filters match (no paging, at most 10,000), for the CSV export. */
export async function exportOrders(f: BoardFilter) {
  const w = where(f, true);
  return query<{
    order_no: string; placed: string; day: string; type: string; name: string; phone: string; address: string; pincode: string | null; notes: string | null;
    items: string; qty: number; subtotal: number; delivery_fee: number; total: number; payment_method: string; payment_status: string; status: string;
    rider: string | null; assigned: string | null; picked_up: string | null; delivered: string | null; rating: number | null;
  }>(
    `select o.order_no, to_char(o.created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as placed, to_char(${DAY}, 'YYYY-MM-DD') as day,
            case when o.subscription_day is null then 'Regular' else 'Subscription' end as type,
            o.name, o.phone, o.address, o.pincode, o.notes,
            coalesce((select string_agg(i.qty || ' x ' || i.name || ' (' || i.sku_code || ')', '; ' order by i.id) from shop_order_item i where i.order_id = o.id), '') as items,
            coalesce((select sum(i.qty)::int from shop_order_item i where i.order_id = o.id), 0) as qty,
            o.subtotal::float as subtotal, o.delivery_fee::float as delivery_fee, o.total::float as total, o.payment_method, o.payment_status, o.status,
            (select r.name from shop_rider r where r.id = o.rider_id) as rider,
            to_char(o.assigned_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as assigned,
            to_char(o.picked_up_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as picked_up,
            to_char(o.delivered_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as delivered, o.rider_rating as rating
       from shop_order o ${w.sql} order by o.created_at desc limit 10000`,
    w.params,
  );
}

/** Orders for printed delivery slips, in the order asked for. */
export async function slipOrders(ids: number[]) {
  if (!ids.length) return [];
  const rows = await query<ShopOrder>(`${WITH_ITEMS} where o.id = any($1::int[])`, [ids]);
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is ShopOrder => !!r);
}

/** Every subscription order of a customer (by account, else by phone), newest delivery day first. */
export async function subscriptionOrders(customerId: number | null, phone: string): Promise<BoardRow[]> {
  return query<BoardRow>(
    `select w.*, (select count(*)::int from shop_order x where x.phone = w.phone and (x.status <> 'cancelled' or x.id = w.id) and x.created_at <= w.created_at) as nth
       from (${WITH_ITEMS} where o.subscription_day is not null and (($1::int is not null and o.customer_id = $1) or ($1::int is null and o.phone = $2))
             order by o.subscription_day desc, o.created_at desc limit 500) w
      order by w.subscription_day desc, w.created_at desc`,
    [customerId, phone],
  );
}

/** Orders for an invoice over a period (YYYY-MM-DD, both included): subscription ones only when `subscription`. */
export async function invoiceOrders(customerId: number | null, phone: string, from: string, to: string, subscription: boolean): Promise<ShopOrder[]> {
  return query<ShopOrder>(
    `${WITH_ITEMS} where (($1::int is not null and o.customer_id = $1) or ($1::int is null and o.phone = $2))
       and ${DAY} between $3::date and $4::date ${subscription ? "and o.subscription_day is not null" : ""}
     order by ${DAY}, o.created_at`,
    [customerId, phone, from, to],
  );
}
