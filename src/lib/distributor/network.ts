import "server-only";
import { query } from "@/lib/db";

/**
 * A partner's network for the Gaia Distributors app: every customer under it in Customer Masters (parent links) -
 * a super stockist's distributors and their retailers, a distributor's retailers - with what each ordered in the
 * period, the retailers' requirements, and the network's top products. Read-only; the firm is the signed-in one.
 */

export interface NetworkNode {
  uid: string;
  name: string;
  code: string | null;
  channel: string | null;
  city: string | null;
  phone: string | null;
  /** the firm above it in the network (null for the signed-in firm itself) */
  parentUid: string | null;
  /** 0 = the signed-in firm, 1 = directly under it, 2 = under those */
  depth: number;
  orders: number;
  value: number;
  lastOrder: string | null;
  /** retailer requirements in the period: sent, and still open */
  needsSent: number;
  needsOpen: number;
}

export interface Network {
  days: number;
  root: NetworkNode;
  nodes: NetworkNode[];
  /** per channel below the signed-in firm: how many customers, how many ordered, orders and value */
  levels: Array<{ channel: string; customers: number; active: number; orders: number; value: number }>;
  products: Array<{ sku: string; name: string; qty: number; value: number }>;
}

export async function networkOf(firmUid: string, days: number): Promise<Network | null> {
  const d = Math.min(Math.max(Math.round(days) || 30, 1), 365);
  const rows = await query<NetworkNode>(
    `with recursive tree as (
         select f.uid, null::uuid as parent, 0 as depth from fp_firm f where f.uid = $1
         union all
         select c.uid, t.uid, t.depth + 1 from fp_firm c join tree t on c.parent_firm_uid = t.uid
          where c.active = 1 and t.depth < 3 and c.uid <> $1
       ),
       nodes as (select distinct on (uid) uid, parent, depth from tree order by uid, depth limit 3000)
     select f.uid, f.name, f.firm_code as code, ch.channel, f.city, f.phone, n.parent as "parentUid", n.depth,
            coalesce(o.n, 0)::int as orders, coalesce(o.v, 0)::float as value, o.last::text as "lastOrder",
            coalesce(q.sent, 0)::int as "needsSent", coalesce(q.open, 0)::int as "needsOpen"
       from nodes n
       join fp_firm f on f.uid = n.uid
       left join fp_channel ch on ch.uid = f.channel_uid
       left join lateral (
         select count(*) as n, sum(b.total_cost) as v, max((b.booking_time at time zone 'Asia/Kolkata')::date) as last
           from fp_booking_order b
          where b.from_firm_uid = f.uid and b.booking_time > now() - make_interval(days => $2)
            and lower(b.status) not in ('cancelled', 'rejected')
       ) o on true
       left join lateral (
         select count(*) as sent, count(*) filter (where x.status = 'open') as open
           from dist_demand x where x.retailer_firm_uid = f.uid and x.created_at > now() - make_interval(days => $2)
       ) q on true
      order by n.depth, value desc, f.name`,
    [firmUid, d],
  );
  const root = rows.find((r) => r.depth === 0);
  if (!root) return null;
  const below = rows.filter((r) => r.depth > 0);

  const levels = new Map<string, { channel: string; customers: number; active: number; orders: number; value: number }>();
  for (const r of below) {
    const k = r.channel ?? "Other";
    const l = levels.get(k) ?? { channel: k, customers: 0, active: 0, orders: 0, value: 0 };
    l.customers++;
    if (r.orders > 0) l.active++;
    l.orders += r.orders;
    l.value += r.value;
    levels.set(k, l);
  }

  const products = below.length
    ? await query<{ sku: string; name: string; qty: number; value: number }>(
        `select p.sku_code as sku, p.sku_name as name, sum(i.quantity)::float as qty, sum(i.total_cost)::float as value
           from fp_booking_order b
           join fp_booking_order_item i on i.booking_order_uid = b.uid
           join fp_product p on p.uid = i.product_uid
          where b.from_firm_uid = any($1::uuid[]) and b.booking_time > now() - make_interval(days => $2)
            and lower(b.status) not in ('cancelled', 'rejected')
          group by 1, 2 order by qty desc limit 10`,
        [below.map((r) => r.uid), d],
      )
    : [];

  return {
    days: d,
    root,
    nodes: below,
    levels: [...levels.values()].map((l) => ({ ...l, value: Math.round(l.value) })).sort((a, b) => b.customers - a.customers),
    products: products.map((p) => ({ ...p, value: Math.round(p.value) })),
  };
}
