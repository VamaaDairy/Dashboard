import "server-only";
import { one, query } from "@/lib/db";

/**
 * The D2C business in numbers: who the app's customers are and what they buy. A sale is an order that
 * wasn't cancelled and isn't still waiting for its online payment; its day is the day it was placed,
 * India time.
 */
const SOLD = `o.status not in ('cancelled', 'awaiting_payment')`;
const DAY = `(o.created_at at time zone 'Asia/Kolkata')::date`;
const IN_RANGE = `${DAY} between $1::date and $2::date`;

// a product's category on the D2C list, else the Product Master's
const CATEGORY = `coalesce((select coalesce(nullif(ap.category, ''), nullif(trim(p.category), ''))
                              from fp_product p left join app_product ap on ap.channel = 'd2c' and ap.product_uid = p.uid
                             where p.sku_code = i.sku_code limit 1), 'Other')`;

const n = (v: unknown) => Number(v ?? 0);

// ---- customers ----

export interface CustomerRow {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  pincode: string | null;
  joined: Date;
  last_login: Date | null;
  orders: number;
  spend: number;
  last_order: Date | null;
  first_order: Date | null;
  subscriptions: number;
}

export const CUSTOMER_SORTS = {
  newest: "c.created_at desc",
  spend: "spend desc, c.created_at desc",
  orders: "orders desc, c.created_at desc",
  recent: "last_order desc nulls last",
  name: "lower(c.name)",
} as const;
export type CustomerSort = keyof typeof CUSTOMER_SORTS;

/** Everyone with an account in the Gaia app, with what they have ordered. */
export function listCustomers(q: string, sort: CustomerSort): Promise<CustomerRow[]> {
  const like = `%${q.trim().toLowerCase()}%`;
  return query<CustomerRow>(
    `select c.id, c.name, c.phone, c.address, c.pincode, c.created_at as joined, c.last_login,
            count(o.id) filter (where ${SOLD})::int as orders,
            coalesce(sum(o.total) filter (where ${SOLD}), 0)::float as spend,
            max(o.created_at) filter (where ${SOLD}) as last_order,
            min(o.created_at) filter (where ${SOLD}) as first_order,
            (select count(*)::int from shop_subscription s where s.customer_id = c.id and s.status = 'active') as subscriptions
       from shop_customer c
       left join shop_order o on o.customer_id = c.id
      where $1 = '%%' or lower(c.name) like $1 or c.phone like $1 or lower(coalesce(c.address, '')) like $1 or coalesce(c.pincode, '') like $1
      group by c.id
      order by ${CUSTOMER_SORTS[sort]}
      limit 2000`,
    [like],
  );
}

export interface CustomerOrder { id: number; order_no: string; created_at: Date; status: string; total: number; payment_method: string; items: string; subscription_day: string | null }

/** One customer in full: the account, every order, their subscriptions and what they buy most. */
export async function customerDetail(id: number) {
  const c = (await listCustomers("", "newest")).find((x) => x.id === id);
  if (!c) return null;
  const [orders, subs, products] = await Promise.all([
    query<CustomerOrder>(
      `select o.id, o.order_no, o.created_at, o.status, o.total::float as total, o.payment_method, o.subscription_day,
              coalesce((select string_agg(i.name || ' × ' || i.qty, ', ' order by i.id) from shop_order_item i where i.order_id = o.id), '') as items
         from shop_order o where o.customer_id = $1 order by o.created_at desc limit 500`,
      [id],
    ),
    query<{ id: number; sku_code: string; qty: number; frequency: string; start_date: string; end_date: string | null; status: string; name: string | null }>(
      `select s.id, s.sku_code, s.qty, s.frequency, to_char(s.start_date, 'YYYY-MM-DD') as start_date, to_char(s.end_date, 'YYYY-MM-DD') as end_date, s.status,
              (select p.sku_name from fp_product p where p.sku_code = s.sku_code limit 1) as name
         from shop_subscription s where s.customer_id = $1 order by s.status = 'active' desc, s.start_date desc`,
      [id],
    ),
    query<{ name: string; qty: number; amount: number }>(
      `select i.name, sum(i.qty)::int as qty, sum(i.line_total)::float as amount
         from shop_order o join shop_order_item i on i.order_id = o.id
        where o.customer_id = $1 and ${SOLD} group by i.name order by amount desc limit 10`,
      [id],
    ),
  ]);
  return { customer: c, orders, subs, products };
}

// ---- sales ----

export interface SalesSummary {
  revenue: number;
  orders: number;
  items: number;
  customers: number;
  newCustomers: number;
  cancelled: number;
  online: number;
  subscriptionRevenue: number;
}

export async function salesSummary(from: string, to: string): Promise<SalesSummary> {
  const r = await one<Record<string, unknown>>(
    `select coalesce(sum(o.total) filter (where ${SOLD}), 0) as revenue,
            count(*) filter (where ${SOLD}) as orders,
            coalesce((select sum(i.qty) from shop_order_item i join shop_order o on o.id = i.order_id where ${SOLD} and ${IN_RANGE}), 0) as items,
            count(distinct coalesce(o.customer_id::text, o.phone)) filter (where ${SOLD}) as customers,
            (select count(*) from shop_customer c where (c.created_at at time zone 'Asia/Kolkata')::date between $1::date and $2::date) as new_customers,
            count(*) filter (where o.status = 'cancelled') as cancelled,
            coalesce(sum(o.total) filter (where ${SOLD} and o.payment_method = 'online'), 0) as online,
            coalesce(sum(o.total) filter (where ${SOLD} and o.subscription_day is not null), 0) as subscription_revenue
       from shop_order o where ${IN_RANGE}`,
    [from, to],
  );
  return {
    revenue: n(r?.revenue), orders: n(r?.orders), items: n(r?.items), customers: n(r?.customers), newCustomers: n(r?.new_customers),
    cancelled: n(r?.cancelled), online: n(r?.online), subscriptionRevenue: n(r?.subscription_revenue),
  };
}

export interface DayRow { day: string; orders: number; revenue: number; items: number; customers: number; cod: number; online: number; cancelled: number }

/** Day by day (every day in the period, empty ones too). */
export function salesByDay(from: string, to: string): Promise<DayRow[]> {
  return query<DayRow>(
    `select to_char(d, 'YYYY-MM-DD') as day,
            count(o.id) filter (where ${SOLD})::int as orders,
            coalesce(sum(o.total) filter (where ${SOLD}), 0)::float as revenue,
            coalesce((select sum(i.qty) from shop_order_item i join shop_order o2 on o2.id = i.order_id
                       where (o2.created_at at time zone 'Asia/Kolkata')::date = d and o2.status not in ('cancelled', 'awaiting_payment')), 0)::int as items,
            count(distinct coalesce(o.customer_id::text, o.phone)) filter (where ${SOLD})::int as customers,
            coalesce(sum(o.total) filter (where ${SOLD} and o.payment_method = 'cod'), 0)::float as cod,
            coalesce(sum(o.total) filter (where ${SOLD} and o.payment_method = 'online'), 0)::float as online,
            count(o.id) filter (where o.status = 'cancelled')::int as cancelled
       from generate_series($1::date, $2::date, interval '1 day') d
       left join shop_order o on ${DAY} = d
      group by d order by d`,
    [from, to],
  );
}

export interface ProductRow { sku: string; name: string; category: string; qty: number; revenue: number; orders: number; customers: number; avg_price: number }

export function salesByProduct(from: string, to: string): Promise<ProductRow[]> {
  return query<ProductRow>(
    `select i.sku_code as sku, min(i.name) as name, ${CATEGORY} as category,
            sum(i.qty)::int as qty, sum(i.line_total)::float as revenue, count(distinct o.id)::int as orders,
            count(distinct coalesce(o.customer_id::text, o.phone))::int as customers,
            (sum(i.line_total) / nullif(sum(i.qty), 0))::float as avg_price
       from shop_order o join shop_order_item i on i.order_id = o.id
      where ${SOLD} and ${IN_RANGE}
      group by i.sku_code order by revenue desc`,
    [from, to],
  );
}

export interface CategoryRow { category: string; qty: number; revenue: number; orders: number; products: number }

export async function salesByCategory(from: string, to: string): Promise<CategoryRow[]> {
  const products = await salesByProduct(from, to);
  const m = new Map<string, CategoryRow>();
  for (const p of products) {
    const c = m.get(p.category) ?? { category: p.category, qty: 0, revenue: 0, orders: 0, products: 0 };
    c.qty += p.qty;
    c.revenue += p.revenue;
    c.orders += p.orders;
    c.products += 1;
    m.set(p.category, c);
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

export interface BuyerRow { id: number | null; name: string; phone: string; orders: number; revenue: number; items: number; last_order: Date }

export function salesByCustomer(from: string, to: string): Promise<BuyerRow[]> {
  return query<BuyerRow>(
    `select o.customer_id as id, (array_agg(o.name order by o.created_at desc))[1] as name, o.phone,
            count(*)::int as orders, sum(o.total)::float as revenue,
            coalesce(sum((select sum(i.qty) from shop_order_item i where i.order_id = o.id)), 0)::int as items, max(o.created_at) as last_order
       from shop_order o where ${SOLD} and ${IN_RANGE}
      group by o.customer_id, o.phone order by revenue desc`,
    [from, to],
  );
}

export interface PaymentRow { method: string; kind: string; orders: number; revenue: number }

/** Cash or online, one-time or subscription. */
export function salesByPayment(from: string, to: string): Promise<PaymentRow[]> {
  return query<PaymentRow>(
    `select o.payment_method as method, case when o.subscription_day is null then 'One-time' else 'Subscription' end as kind,
            count(*)::int as orders, sum(o.total)::float as revenue
       from shop_order o where ${SOLD} and ${IN_RANGE}
      group by 1, 2 order by revenue desc`,
    [from, to],
  );
}

export interface AreaRow { pincode: string; orders: number; revenue: number; customers: number }

export function salesByArea(from: string, to: string): Promise<AreaRow[]> {
  return query<AreaRow>(
    `select coalesce(nullif(o.pincode, ''), 'No pincode') as pincode, count(*)::int as orders, sum(o.total)::float as revenue,
            count(distinct coalesce(o.customer_id::text, o.phone))::int as customers
       from shop_order o where ${SOLD} and ${IN_RANGE}
      group by 1 order by revenue desc`,
    [from, to],
  );
}

export interface StatusRow { status: string; orders: number; revenue: number }

/** Every order placed in the period by where it stands now, cancelled ones included. */
export function ordersByStatus(from: string, to: string): Promise<StatusRow[]> {
  return query<StatusRow>(
    `select o.status, count(*)::int as orders, coalesce(sum(o.total), 0)::float as revenue from shop_order o where ${IN_RANGE} group by 1 order by orders desc`,
    [from, to],
  );
}
