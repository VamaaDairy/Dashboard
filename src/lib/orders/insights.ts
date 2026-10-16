import { query, one } from "@/lib/db";

const monthStart = `date_trunc('month', current_date)::date`;

export interface Dashboard {
  salesToday: number; salesMonth: number; ordersMonth: number; openOrders: number;
  byKind: Array<{ kind: string; orders: number; total: number }>;
  customers: number; activeStaff: number; visitsToday: number; visitsMonth: number; presentToday: number;
  outOfStock: number; openTickets: number; pendingExpenses: number;
  topProducts: Array<{ name: string; qty: number; amount: number }>;
  topCustomers: Array<{ name: string; orders: number; amount: number }>;
  ranking: Array<{ name: string; orders: number; amount: number; visits: number }>;
  trend: Array<{ month: string; total: number }>;
}

export async function getDashboard(): Promise<Dashboard> {
  const n = async (sql: string) => Number((await one<{ v: number }>(sql))?.v ?? 0);
  const [salesToday, salesMonth, ordersMonth, openOrders, customers, activeStaff, visitsToday, visitsMonth, presentToday, outOfStock, openTickets, pendingExpenses] = await Promise.all([
    n(`select coalesce(sum(total),0) v from ord_order where status <> 'cancelled' and order_date = current_date`),
    n(`select coalesce(sum(total),0) v from ord_order where status <> 'cancelled' and order_date >= ${monthStart}`),
    n(`select count(*)::int v from ord_order where status <> 'cancelled' and order_date >= ${monthStart}`),
    n(`select count(*)::int v from ord_order where status in ('created','approved','invoiced')`),
    n(`select count(*)::int v from ord_customer where status = 'active'`),
    n(`select count(*)::int v from ord_staff where is_active`),
    n(`select count(*)::int v from ord_visit where visit_date = current_date`),
    n(`select count(*)::int v from ord_visit where visit_date >= ${monthStart}`),
    n(`select count(*)::int v from ord_attendance where day = current_date and status in ('present','half')`),
    n(`select count(*)::int v from (select p.id from ord_product p left join ord_stock_move m on m.product_id = p.id where p.is_active group by p.id having coalesce(sum(m.qty),0) <= 0) x`),
    n(`select count(*)::int v from ord_ticket where status in ('open','in_progress')`),
    n(`select count(*)::int v from ord_expense where status = 'pending'`),
  ]);
  const [byKind, topProducts, topCustomers, ranking, trend] = await Promise.all([
    query<Dashboard["byKind"][number]>(
      `select kind, count(*)::int as orders, coalesce(sum(total),0) as total from ord_order
        where status <> 'cancelled' and order_date >= ${monthStart} group by kind order by kind`),
    query<Dashboard["topProducts"][number]>(
      `select p.name, sum(i.qty) as qty, sum(i.amount) as amount from ord_order_item i
         join ord_order o on o.id = i.order_id join ord_product p on p.id = i.product_id
        where o.status <> 'cancelled' and o.order_date >= ${monthStart} group by p.name order by 3 desc limit 5`),
    query<Dashboard["topCustomers"][number]>(
      `select coalesce(c.name, o.customer_name, 'Walk-in') as name, count(*)::int as orders, sum(o.total) as amount
         from ord_order o left join ord_customer c on c.id = o.customer_id
        where o.status <> 'cancelled' and o.order_date >= ${monthStart} group by 1 order by 3 desc limit 5`),
    query<Dashboard["ranking"][number]>(
      `select s.name,
              (select count(*)::int from ord_order o where o.staff_id = s.id and o.status <> 'cancelled' and o.order_date >= ${monthStart}) as orders,
              (select coalesce(sum(o.total),0) from ord_order o where o.staff_id = s.id and o.status <> 'cancelled' and o.order_date >= ${monthStart}) as amount,
              (select count(*)::int from ord_visit v where v.staff_id = s.id and v.visit_date >= ${monthStart}) as visits
         from ord_staff s where s.is_active order by amount desc, visits desc limit 8`),
    query<Dashboard["trend"][number]>(
      `select to_char(m, 'Mon YY') as month,
              coalesce((select sum(total) from ord_order o where o.status <> 'cancelled' and date_trunc('month', o.order_date) = m), 0) as total
         from generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month') m order by m`),
  ]);
  return { salesToday, salesMonth, ordersMonth, openOrders, byKind, customers, activeStaff, visitsToday, visitsMonth, presentToday, outOfStock, openTickets, pendingExpenses, topProducts, topCustomers, ranking, trend };
}

export interface KpiRow { staff: string; sales: [number, number]; orders: [number, number]; visits: [number, number]; new_outlets: [number, number] }

/** Target and achieved per employee for one month (YYYY-MM). Achieved comes straight from orders, visits and customers. */
export async function kpiProgress(period: string): Promise<KpiRow[]> {
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Month must look like 2026-04");
  const rows = await query<{ staff: string; metric: string; target: number | null; achieved: number }>(
    `with p as (select to_date($1 || '-01', 'YYYY-MM-DD') as d)
     select s.name as staff, m.metric,
            (select t.target from ord_kpi_target t where t.staff_id = s.id and t.period = $1 and t.metric = m.metric) as target,
            case m.metric
              when 'sales' then (select coalesce(sum(o.total),0) from ord_order o, p where o.staff_id = s.id and o.status <> 'cancelled' and o.order_date >= p.d and o.order_date < p.d + interval '1 month')
              when 'orders' then (select count(*) from ord_order o, p where o.staff_id = s.id and o.status <> 'cancelled' and o.order_date >= p.d and o.order_date < p.d + interval '1 month')
              when 'visits' then (select count(*) from ord_visit v, p where v.staff_id = s.id and v.visit_date >= p.d and v.visit_date < p.d + interval '1 month')
              else (select count(*) from ord_customer c, p where c.staff_id = s.id and c.created_at >= p.d and c.created_at < p.d + interval '1 month')
            end::numeric as achieved
       from ord_staff s cross join (values ('sales'),('orders'),('visits'),('new_outlets')) m(metric)
      where s.is_active order by s.name`,
    [period],
  );
  const by = new Map<string, KpiRow>();
  for (const r of rows) {
    const row = by.get(r.staff) ?? { staff: r.staff, sales: [0, 0], orders: [0, 0], visits: [0, 0], new_outlets: [0, 0] };
    row[r.metric as "sales"] = [Number(r.target ?? 0), Number(r.achieved)];
    by.set(r.staff, row);
  }
  return [...by.values()];
}

// ---- downloadable reports -------------------------------------------
export interface ReportDef { key: string; title: string; description: string; sql: string; headers: string[] }

export const REPORTS: ReportDef[] = [
  {
    key: "orders", title: "Orders", description: "Every order with customer, salesman, status and value.",
    headers: ["Order no", "Type", "Date", "Customer", "Salesman", "Status", "Subtotal", "Tax", "Total"],
    sql: `select o.order_no, o.kind, to_char(o.order_date,'YYYY-MM-DD'), coalesce(c.name,o.customer_name,''), coalesce(s.name,''), o.status, o.subtotal, o.tax, o.total
            from ord_order o left join ord_customer c on c.id=o.customer_id left join ord_staff s on s.id=o.staff_id order by o.order_date desc, o.order_no`,
  },
  {
    key: "order-lines", title: "Order lines", description: "Product-wise lines of every order.",
    headers: ["Order no", "Type", "Date", "Customer", "SKU", "Product", "Qty", "Rate", "Discount %", "GST %", "Amount"],
    sql: `select o.order_no, o.kind, to_char(o.order_date,'YYYY-MM-DD'), coalesce(c.name,o.customer_name,''), p.sku, p.name, i.qty, i.rate, i.discount_pct, i.gst_pct, i.amount
            from ord_order_item i join ord_order o on o.id=i.order_id join ord_product p on p.id=i.product_id left join ord_customer c on c.id=o.customer_id order by o.order_date desc, o.order_no, p.name`,
  },
  {
    key: "sales-by-product", title: "Sales by product", description: "Quantity and value sold per product (cancelled orders left out).",
    headers: ["SKU", "Product", "Qty", "Amount"],
    sql: `select p.sku, p.name, sum(i.qty), sum(i.amount) from ord_order_item i join ord_order o on o.id=i.order_id join ord_product p on p.id=i.product_id
           where o.status <> 'cancelled' group by p.sku, p.name order by 4 desc`,
  },
  {
    key: "sales-by-customer", title: "Sales by customer", description: "Orders and value per customer (cancelled orders left out).",
    headers: ["Code", "Customer", "Type", "Orders", "Amount"],
    sql: `select coalesce(c.code,''), coalesce(c.name,o.customer_name,'Walk-in'), coalesce(c.type,'counter'), count(*), sum(o.total)
            from ord_order o left join ord_customer c on c.id=o.customer_id where o.status <> 'cancelled' group by 1,2,3 order by 5 desc`,
  },
  {
    key: "stock", title: "Stock on hand", description: "Current stock per product from the stock ledger.",
    headers: ["SKU", "Product", "On hand", "Value at trade rate"],
    sql: `select p.sku, p.name, coalesce(sum(m.qty),0), coalesce(sum(m.qty),0)*p.rate from ord_product p left join ord_stock_move m on m.product_id=p.id group by p.id order by p.name`,
  },
  {
    key: "purchases", title: "Purchase orders", description: "Purchase orders with supplier and total.",
    headers: ["PO no", "Date", "Supplier", "Status", "Total"],
    sql: `select po_no, to_char(po_date,'YYYY-MM-DD'), supplier, status, total from ord_purchase order by po_date desc`,
  },
  {
    key: "customers", title: "Customer master", description: "All customers with their distributor and salesman.",
    headers: ["Code", "Name", "Type", "Distributor", "Salesman", "City", "Phone", "GSTIN", "Credit limit", "Status"],
    sql: `select c.code, c.name, c.type, coalesce(d.name,''), coalesce(s.name,''), coalesce(c.city,''), coalesce(c.phone,''), coalesce(c.gst_no,''), c.credit_limit, c.status
            from ord_customer c left join ord_customer d on d.id=c.parent_id left join ord_staff s on s.id=c.staff_id order by c.name`,
  },
  {
    key: "visits", title: "Market visits", description: "Visit log with outcome and order value.",
    headers: ["Date", "Employee", "Customer", "Outcome", "Order value", "Notes"],
    sql: `select to_char(v.visit_date,'YYYY-MM-DD'), s.name, coalesce(c.name,''), v.outcome, v.order_value, coalesce(v.notes,'')
            from ord_visit v join ord_staff s on s.id=v.staff_id left join ord_customer c on c.id=v.customer_id order by v.visit_date desc`,
  },
  {
    key: "attendance", title: "Attendance", description: "Daily attendance with in and out times.",
    headers: ["Date", "Employee", "Status", "In", "Out"],
    sql: `select to_char(a.day,'YYYY-MM-DD'), s.name, a.status, coalesce(to_char(a.check_in,'HH24:MI'),''), coalesce(to_char(a.check_out,'HH24:MI'),'')
            from ord_attendance a join ord_staff s on s.id=a.staff_id order by a.day desc, s.name`,
  },
  {
    key: "expenses", title: "Expenses", description: "Employee expense claims with status.",
    headers: ["Date", "Employee", "Type", "Amount", "Status", "Note"],
    sql: `select to_char(e.day,'YYYY-MM-DD'), s.name, coalesce(m.name,''), e.amount, e.status, coalesce(e.note,'')
            from ord_expense e join ord_staff s on s.id=e.staff_id left join ord_master m on m.id=e.type_id order by e.day desc`,
  },
  {
    key: "kpi", title: "KPI targets", description: "Targets set per employee, month and metric.",
    headers: ["Employee", "Month", "Metric", "Target"],
    sql: `select s.name, t.period, t.metric, t.target from ord_kpi_target t join ord_staff s on s.id=t.staff_id order by t.period desc, s.name`,
  },
  {
    key: "tickets", title: "Support tickets", description: "All tickets with status and resolution.",
    headers: ["Ticket", "Subject", "Customer", "Assigned to", "Priority", "Status", "Resolution"],
    sql: `select k.ticket_no, k.subject, coalesce(c.name,''), coalesce(s.name,''), k.priority, k.status, coalesce(k.resolution,'')
            from ord_ticket k left join ord_customer c on c.id=k.customer_id left join ord_staff s on s.id=k.staff_id order by k.created_at desc`,
  },
];

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // a leading = + - @ would be run as a formula by Excel; defuse it
  const safe = /^[=+@]/.test(s) || (/^-/.test(s) && Number.isNaN(Number(s))) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function reportCsv(key: string): Promise<{ name: string; csv: string } | null> {
  const def = REPORTS.find((r) => r.key === key);
  if (!def) return null;
  const { pool } = await import("@/lib/db");
  const res = await pool.query({ text: def.sql, rowMode: "array" });
  const lines = [def.headers, ...(res.rows as unknown[][])].map((r) => r.map(csvCell).join(","));
  return { name: `${def.key}-${new Date().toISOString().slice(0, 10)}.csv`, csv: "﻿" + lines.join("\r\n") + "\r\n" };
}
