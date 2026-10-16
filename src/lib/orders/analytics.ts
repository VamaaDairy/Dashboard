import { query } from "@/lib/db";

const DAYS = 14;

export interface TrafficRow { staff: string; days: Array<{ day: string; visits: number; status: string | null }> }

/** Employee x day grid: how many visits each made, and what the attendance said (green / amber / red in the UI). */
export async function dayWiseVisits(): Promise<{ days: string[]; rows: TrafficRow[]; min: number }> {
  const min = Number((await query<{ value: string }>(`select value from ord_setting where key = 'min_visits_per_day'`))[0]?.value ?? 3) || 3;
  const rows = await query<{ staff: string; day: string; visits: number; status: string | null }>(
    `select s.name as staff, to_char(d, 'YYYY-MM-DD') as day,
            (select count(*)::int from ord_visit v where v.staff_id = s.id and v.visit_date = d) as visits,
            (select a.status from ord_attendance a where a.staff_id = s.id and a.day = d) as status
       from ord_staff s cross join generate_series(current_date - ${DAYS - 1}, current_date, interval '1 day') d
      where s.is_active order by s.name, d`);
  const by = new Map<string, TrafficRow>();
  for (const r of rows) {
    const t = by.get(r.staff) ?? { staff: r.staff, days: [] };
    t.days.push({ day: r.day, visits: r.visits, status: r.status });
    by.set(r.staff, t);
  }
  const list = [...by.values()];
  return { days: list[0]?.days.map((d) => d.day) ?? [], rows: list, min };
}

export interface CoverageRow { staff: string; customers: number; visited: number; billed: number }

/** Of the outlets each employee owns: how many were visited / ordered this month. */
export async function coverage(): Promise<CoverageRow[]> {
  return query<CoverageRow>(
    `select s.name as staff,
            (select count(*)::int from ord_customer c where c.staff_id = s.id and c.status = 'active') as customers,
            (select count(distinct v.customer_id)::int from ord_visit v join ord_customer c on c.id = v.customer_id
              where c.staff_id = s.id and v.visit_date >= date_trunc('month', current_date)) as visited,
            (select count(distinct o.customer_id)::int from ord_order o join ord_customer c on c.id = o.customer_id
              where c.staff_id = s.id and o.status <> 'cancelled' and o.order_date >= date_trunc('month', current_date)) as billed
       from ord_staff s where s.is_active order by s.name`);
}

export interface ProductivityRow { staff: string; visits: number; productive: number; orders: number; value: number; avg: number }

export async function productivity(): Promise<ProductivityRow[]> {
  return query<ProductivityRow>(
    `select s.name as staff,
            count(v.id)::int as visits,
            count(v.id) filter (where v.outcome = 'order')::int as productive,
            (select count(*)::int from ord_order o where o.staff_id = s.id and o.status <> 'cancelled' and o.order_date >= date_trunc('month', current_date)) as orders,
            (select coalesce(sum(o.total),0) from ord_order o where o.staff_id = s.id and o.status <> 'cancelled' and o.order_date >= date_trunc('month', current_date)) as value,
            (select coalesce(avg(o.total),0) from ord_order o where o.staff_id = s.id and o.status <> 'cancelled' and o.order_date >= date_trunc('month', current_date)) as avg
       from ord_staff s left join ord_visit v on v.staff_id = s.id and v.visit_date >= date_trunc('month', current_date)
      where s.is_active group by s.id order by value desc`);
}

export async function categoryInsights() {
  return query<{ category: string; this_month: number; last_month: number; qty: number }>(
    `select coalesce(m.name, 'Uncategorised') as category,
            coalesce(sum(i.amount) filter (where date_trunc('month', o.order_date) = date_trunc('month', current_date)), 0) as this_month,
            coalesce(sum(i.amount) filter (where date_trunc('month', o.order_date) = date_trunc('month', current_date) - interval '1 month'), 0) as last_month,
            coalesce(sum(i.qty) filter (where date_trunc('month', o.order_date) = date_trunc('month', current_date)), 0) as qty
       from ord_order_item i join ord_order o on o.id = i.order_id and o.status <> 'cancelled'
       join ord_product p on p.id = i.product_id left join ord_master m on m.id = p.category_id
      group by 1 order by 2 desc`);
}

export async function dailySales(days = 30) {
  return query<{ day: string; primary_v: number; secondary_v: number; counter_v: number; total: number; orders: number }>(
    `select to_char(d, 'YYYY-MM-DD') as day,
            coalesce(sum(o.total) filter (where o.kind = 'primary'), 0) as primary_v,
            coalesce(sum(o.total) filter (where o.kind = 'secondary'), 0) as secondary_v,
            coalesce(sum(o.total) filter (where o.kind = 'counter'), 0) as counter_v,
            coalesce(sum(o.total), 0) as total, count(o.id)::int as orders
       from generate_series(current_date - ${days - 1}, current_date, interval '1 day') d
       left join ord_order o on o.order_date = d and o.status <> 'cancelled'
      group by d order by d desc`);
}

export async function attendanceSummary() {
  return query<{ staff: string; present: number; half: number; leave: number; absent: number; marked: number }>(
    `select s.name as staff,
            count(*) filter (where a.status = 'present')::int as present,
            count(*) filter (where a.status = 'half')::int as half,
            count(*) filter (where a.status = 'leave')::int as leave,
            count(*) filter (where a.status = 'absent')::int as absent,
            count(a.id)::int as marked
       from ord_staff s left join ord_attendance a on a.staff_id = s.id and a.day >= date_trunc('month', current_date)
      where s.is_active group by s.id order by s.name`);
}

export interface MapPoint { kind: "employee" | "customer"; name: string; lat: number; lng: number; detail: string }

/** Latest known position of each employee plus every outlet with coordinates. */
export async function mapPoints(): Promise<MapPoint[]> {
  const emp = await query<{ name: string; lat: number; lng: number; at: string }>(
    `select distinct on (s.id) s.name, l.lat, l.lng, to_char(l.logged_on, 'DD Mon') || ' ' || to_char(l.logged_at, 'HH24:MI') as at
       from ord_location_log l join ord_staff s on s.id = l.staff_id order by s.id, l.logged_on desc, l.logged_at desc`);
  const cust = await query<{ name: string; lat: number; lng: number; type: string; city: string | null }>(
    `select name, lat, lng, type, city from ord_customer where lat is not null and lng is not null and status <> 'inactive'`);
  return [
    ...emp.map((e) => ({ kind: "employee" as const, name: e.name, lat: Number(e.lat), lng: Number(e.lng), detail: `Last seen ${e.at}` })),
    ...cust.map((c) => ({ kind: "customer" as const, name: c.name, lat: Number(c.lat), lng: Number(c.lng), detail: `${c.type}${c.city ? " · " + c.city : ""}` })),
  ];
}
