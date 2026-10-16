import { query } from "@/lib/db";
import { narrowed, range, staffCte, type DashFilters } from "./dash";
import type { RCell } from "@/components/fp/dash/ReportTable";

/* Report queries behind the Insights screens. Each returns rows of display-ready cells. */
const inr = (n: unknown) => "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");
const n0 = (v: unknown) => Number(v ?? 0);

export interface Report { head: string[]; rows: RCell[][]; right: number[]; tone?: Record<string, "good" | "warn" | "bad"> }

const LIVE = "o.status not in ('Cancelled','Rejected')";

/** Market Visits: one row per employee with their schedule, calls and orders for the range. */
export async function marketVisits(f: DashFilters): Promise<Report> {
  const p: unknown[] = [];
  const cte = staffCte(f, p);
  const [a, b] = range(f, p);
  const ord = (kind: string, expr: string) =>
    `(select ${expr} from fp_booking_order o where o.staff_uid = st.uid and o.order_type = '${kind}' and o.booking_time >= ${a} and o.booking_time < ${b} and ${LIVE})`;
  const rows = await query<Record<string, unknown>>(
    `with ${cte}
     select stt.region, st.team_team as team, s.state_state as state, concat_ws(' ', st.first_name, st.last_name) as name, s.employee_code as code, st.designation,
            concat_ws(' ', m.first_name, m.last_name) as manager,
            count(c.uid) as scheduled,
            count(c.uid) filter (where c.status = 'Completed') as completed,
            count(c.uid) filter (where c.mark_visit = 1) as mark,
            count(c.uid) filter (where c.mark_visit = 1 and c.deviation = 'Deviated') as dev_mark,
            count(c.uid) filter (where c.mark_visit = 1 and coalesce(c.deviation,'') <> 'Deviated') as nondev_mark,
            count(c.uid) filter (where c.booking_order = 1) as ordered,
            count(c.uid) filter (where c.deviation = 'Deviated') as dev_calls,
            count(c.uid) filter (where coalesce(c.deviation,'') <> 'Deviated') as nondev_calls,
            count(distinct c.firm_uid) filter (where c.booking_order = 1) as uob,
            count(c.uid) filter (where c.status <> 'Completed') as missed,
            (select count(*) from fp_firm f2 where f2.sales_contact_uid = st.uid and f2.new_customer = 1) as new_outlets,
            ${ord("SECONDARY", "count(*)")} as sec_orders, ${ord("SECONDARY", "coalesce(sum(o.total_quantity),0)")} as sec_qty, ${ord("SECONDARY", "coalesce(sum(o.total_cost),0)")} as sec_val,
            ${ord("PRIMARY", "count(*)")} as pri_orders, ${ord("PRIMARY", "coalesce(sum(o.total_quantity),0)")} as pri_qty, ${ord("PRIMARY", "coalesce(sum(o.total_cost),0)")} as pri_val,
            (select count(*) from fp_booking_order o where o.staff_uid = st.uid and o.booking_time >= ${a} and o.booking_time < ${b} and o.status in ('Cancelled','Rejected')) as cancelled
       from st join fp_staff s on s.uid = st.uid left join fp_state stt on stt.state = s.state_state left join fp_staff m on m.uid = s.reporting_manager_uid
       left join fp_staff_channel_activity c on c.staff_uid = st.uid and c.scheduled_time >= ${a} and c.scheduled_time < ${b}
      group by st.uid, stt.region, st.team_team, s.state_state, st.first_name, st.last_name, s.employee_code, st.designation, m.first_name, m.last_name order by name`, p);
  return {
    head: ["Region", "Branch/Team", "State", "Name", "Code", "Designation", "Reporting Manager", "Scheduled Outlets", "Completed", "Mark Visit", "Deviated Mark Visit", "Non-Deviated Mark Visit", "% Coverage", "Order Taken", "%Productivity",
           "Deviated Call Count", "Non-Deviated Call Count", "Unique Outlets Billed", "New Outlets Added", "Missed", "Secondary Orders", "Secondary Order Quantity", "Secondary Order Value", "Primary Orders", "Primary Order Quantity", "Primary Order Value", "Cancelled Orders"],
    right: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
    rows: rows.map((r) => [r.region as string, r.team as string, r.state as string, r.name as string, r.code as string, r.designation as string, (r.manager as string) || null,
      n0(r.scheduled), n0(r.completed), n0(r.mark), n0(r.dev_mark), n0(r.nondev_mark), pct(n0(r.completed), n0(r.scheduled)), n0(r.ordered), pct(n0(r.ordered), n0(r.completed)),
      n0(r.dev_calls), n0(r.nondev_calls), n0(r.uob), n0(r.new_outlets), n0(r.missed), n0(r.sec_orders), n0(r.sec_qty), inr(r.sec_val), n0(r.pri_orders), n0(r.pri_qty), inr(r.pri_val), n0(r.cancelled)]),
  };
}

/** Day-wise Visit Dashboard: every employee on one day, coloured by how the day went. */
export async function dayWise(f: DashFilters, day: string): Promise<Report> {
  const p: unknown[] = [day];
  const cte = staffCte(f, p);
  const rows = await query<Record<string, unknown>>(
    `with ${cte}
     select concat_ws(' ', st.first_name, st.last_name) as name, s.employee_code as code, st.designation, st.team_team as team,
            a.login_time, coalesce(a.absent, 0) as absent, (a.uid is not null) as marked,
            (select count(*) from fp_staff_channel_activity c where c.staff_uid = st.uid and c.scheduled_time::date = $1::date) as scheduled,
            (select count(*) from fp_staff_channel_activity c where c.staff_uid = st.uid and c.scheduled_time::date = $1::date and c.status = 'Completed') as completed,
            (select count(*) from fp_staff_channel_activity c where c.staff_uid = st.uid and c.scheduled_time::date = $1::date and c.booking_order = 1) as productive,
            (select coalesce(sum(o.total_cost),0) from fp_booking_order o where o.staff_uid = st.uid and o.booking_time::date = $1::date and ${LIVE}) as value
       from st join fp_staff s on s.uid = st.uid left join fp_staff_attendance a on a.staff_uid = st.uid and a.attendance_date::date = $1::date order by name`, p);
  const tone: Record<string, "good" | "warn" | "bad"> = {};
  const out: RCell[][] = rows.map((r) => {
    const sched = n0(r.scheduled), done = n0(r.completed);
    let status: string, t: "good" | "warn" | "bad";
    if (Number(r.absent) === 1) { status = "Absent / leave"; t = "warn"; }
    else if (!r.marked) { status = "Not logged in"; t = "bad"; }
    else if (sched === 0) { status = "No calls scheduled"; t = "warn"; }
    else if (done / sched >= 0.8) { status = "On track"; t = "good"; }
    else if (done / sched >= 0.5) { status = "Behind"; t = "warn"; }
    else { status = "Far behind"; t = "bad"; }
    tone[`4:${status}`] = t;
    return [r.name as string, r.code as string, r.designation as string, r.team as string, status,
      r.login_time ? new Date(String(r.login_time)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null, sched, done, n0(r.productive), inr(r.value)];
  });
  return { head: ["Employee", "Code", "Designation", "Branch/Team", "Day status", "Login", "Scheduled", "Completed", "Productive", "Order value"], rows: out, right: [6, 7, 8, 9], tone };
}

/** Sales Rep Productivity */
export async function productivityReport(f: DashFilters): Promise<Report> {
  const p: unknown[] = [];
  const cte = staffCte(f, p);
  const [a, b] = range(f, p);
  const rows = await query<Record<string, unknown>>(
    `with ${cte}
     select concat_ws(' ', st.first_name, st.last_name) as name, s.employee_code as code, st.designation, st.team_team as team,
            (select count(distinct at.attendance_date::date) from fp_staff_attendance at where at.staff_uid = st.uid and at.attendance_date >= ${a} and at.attendance_date < ${b} and coalesce(at.absent,0) = 0) as days,
            (select count(*) from fp_staff_channel_activity c where c.staff_uid = st.uid and c.scheduled_time >= ${a} and c.scheduled_time < ${b} and c.status = 'Completed') as calls,
            (select count(*) from fp_staff_channel_activity c where c.staff_uid = st.uid and c.scheduled_time >= ${a} and c.scheduled_time < ${b} and c.booking_order = 1) as productive,
            (select count(*) from fp_booking_order o where o.staff_uid = st.uid and o.booking_time >= ${a} and o.booking_time < ${b} and ${LIVE}) as orders,
            (select coalesce(sum(o.total_cost),0) from fp_booking_order o where o.staff_uid = st.uid and o.booking_time >= ${a} and o.booking_time < ${b} and ${LIVE}) as value,
            (select count(*) from fp_booking_order_item i join fp_booking_order o on o.uid = i.booking_order_uid where o.staff_uid = st.uid and o.booking_time >= ${a} and o.booking_time < ${b} and ${LIVE}) as lines
       from st join fp_staff s on s.uid = st.uid order by value desc`, p);
  return {
    head: ["Employee", "Code", "Designation", "Branch/Team", "Days worked", "Calls", "Productive calls", "Strike rate", "Calls / day", "Orders", "Order value", "Avg order value", "Lines / order"],
    right: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    rows: rows.map((r) => [r.name as string, r.code as string, r.designation as string, r.team as string, n0(r.days), n0(r.calls), n0(r.productive), pct(n0(r.productive), n0(r.calls)),
      n0(r.days) ? (n0(r.calls) / n0(r.days)).toFixed(1) : "0", n0(r.orders), inr(r.value), n0(r.orders) ? inr(n0(r.value) / n0(r.orders)) : "₹0", n0(r.orders) ? (n0(r.lines) / n0(r.orders)).toFixed(1) : "0"]),
  };
}

const FIELDS: Record<string, string> = { category: "p.category", subCategory: "p.sub_category", brand: "p.brand", superBrand: "p.super_brand", sku: "p.sku_name" };
export const CATEGORY_FIELDS = [["category", "Category"], ["subCategory", "Sub category"], ["brand", "Brand"], ["superBrand", "Super brand"], ["sku", "SKU"]] as const;

/** Category Insights: what sold, by the chosen product grouping. */
export async function categoryInsights(f: DashFilters, field: string): Promise<Report> {
  const col = FIELDS[field] ?? FIELDS.category;
  const p: unknown[] = [];
  const cte = staffCte(f, p);
  const [a, b] = range(f, p);
  const typ = f.salesType === "primary" ? "and o.order_type = 'PRIMARY'" : f.salesType === "secondary" ? "and o.order_type = 'SECONDARY'" : "";
  const scoped = narrowed(f) ? "and o.staff_uid in (select uid from st)" : "";
  const rows = await query<Record<string, unknown>>(
    `with ${cte}
     select coalesce(${col}, 'Unclassified') as k, sum(i.total_cost) as value, sum(i.quantity) as qty, count(distinct o.uid) as orders, count(distinct o.from_firm_uid) as outlets
       from fp_booking_order_item i join fp_booking_order o on o.uid = i.booking_order_uid join fp_product p on p.uid = i.product_uid
      where o.booking_time >= ${a} and o.booking_time < ${b} and ${LIVE} ${typ} ${scoped}
      group by 1 order by value desc`, p);
  const total = rows.reduce((s, r) => s + n0(r.value), 0);
  return {
    head: [CATEGORY_FIELDS.find((c) => c[0] === field)?.[1] ?? "Category", "Order value", "Share", "Quantity", "Orders", "Outlets"],
    right: [1, 2, 3, 4, 5],
    rows: rows.map((r) => [r.k as string, inr(r.value), pct(n0(r.value), total), n0(r.qty), n0(r.orders), n0(r.outlets)]),
  };
}

/** Overall Summary: region / state roll-up for the range. */
export async function overallSummary(f: DashFilters): Promise<Report> {
  const rows = await query<Record<string, unknown>>(
    `select coalesce(stt.region, 'Unassigned') as region, coalesce(f.state_state, 'Unassigned') as state,
            count(distinct f.uid) filter (where c.level = 3) as outlets,
            count(distinct b.from_firm_uid) filter (where c.level = 3) as billed,
            count(distinct b.uid) as orders, coalesce(sum(b.total_cost), 0) as value
       from fp_firm f join fp_channel c on c.uid = f.channel_uid left join fp_state stt on stt.state = f.state_state
       left join fp_booking_order b on b.from_firm_uid = f.uid and b.status not in ('Cancelled','Rejected') and b.booking_time >= $1::date and b.booking_time < $2::date + 1
      group by 1, 2 order by value desc`, [f.from, f.to]);
  const emp = await query<{ state: string; n: number }>(`select coalesce(state_state, 'Unassigned') as state, count(*)::int as n from fp_staff where active = 1 group by 1`);
  const ec = new Map(emp.map((e) => [e.state, e.n]));
  return {
    head: ["Region", "State", "Employees", "Retail outlets", "Outlets billed", "Billing %", "Orders", "Order value"],
    right: [2, 3, 4, 5, 6, 7],
    rows: rows.map((r) => [r.region as string, r.state as string, ec.get(r.state as string) ?? 0, n0(r.outlets), n0(r.billed), pct(n0(r.billed), n0(r.outlets)), n0(r.orders), inr(r.value)]),
  };
}

export interface MapPoint { kind: "employee" | "customer"; name: string; lat: number; lng: number; detail: string }

/** Last known position of each matching employee. */
export async function employeePoints(f: DashFilters): Promise<MapPoint[]> {
  const p: unknown[] = [];
  const cte = staffCte(f, p);
  const rows = await query<{ name: string; lat: number; lng: number; at: string; kind: string | null }>(
    `with ${cte}
     select distinct on (st.uid) concat_ws(' ', st.first_name, st.last_name) as name, l.latitude as lat, l.longitude as lng,
            to_char(l.activity_time, 'DD Mon HH24:MI') as at, l.activity_type as kind
       from st join fp_staff_location l on l.staff_uid = st.uid order by st.uid, l.activity_time desc`, p);
  return rows.map((r) => ({ kind: "employee" as const, name: r.name, lat: Number(r.lat), lng: Number(r.lng), detail: `${r.kind ?? "Location"} · ${r.at}` }));
}

export async function customerPoints(f: { state: string; team: string; channel: string }): Promise<MapPoint[]> {
  const p: unknown[] = [];
  const w = ["fi.latitude is not null", "fi.longitude is not null", "fi.active = 1"];
  if (f.state) { p.push(f.state); w.push(`fi.state_state = $${p.length}`); }
  if (f.team) { p.push(f.team); w.push(`fi.team_team = $${p.length}`); }
  if (f.channel) { p.push(f.channel); w.push(`fi.channel_uid::text = $${p.length}`); }
  const rows = await query<{ name: string; lat: number; lng: number; channel: string | null; city: string | null }>(
    `select fi.name, fi.latitude as lat, fi.longitude as lng, c.channel, fi.city from fp_firm fi left join fp_channel c on c.uid = fi.channel_uid where ${w.join(" and ")} limit 2000`, p);
  return rows.map((r) => ({ kind: "customer" as const, name: r.name, lat: Number(r.lat), lng: Number(r.lng), detail: `${r.channel ?? ""}${r.city ? " · " + r.city : ""}` }));
}
