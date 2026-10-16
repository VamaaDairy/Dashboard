import { query } from "@/lib/db";

/** Filters shared by the Footprints dashboards. They narrow the employees whose work is counted. */
export interface DashFilters {
  from: string; to: string; region: string; team: string; state: string; designation: string; salesType: string;
}
const day = (d: Date) => d.toISOString().slice(0, 10);
const valid = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");

export function dashFilters(sp: Record<string, string>): DashFilters {
  const to = valid(sp.to) || day(new Date());
  const from = valid(sp.from) || day(new Date(Date.now() - 29 * 864e5));
  return { from, to, region: sp.region ?? "", team: sp.team ?? "", state: sp.state ?? "", designation: sp.designation ?? "", salesType: sp.salesType ?? "" };
}

/** CTE `st` of the active employees that match the filters. Returns the SQL and its parameters. */
export function staffCte(f: DashFilters, params: unknown[]): string {
  const w = ["s.active = 1"];
  const add = (cond: string, v: string) => { params.push(v); w.push(cond.replace("$$", `$${params.length}`)); };
  if (f.team) add("s.team_team = $$", f.team);
  if (f.state) add("s.state_state = $$", f.state);
  if (f.designation) add("s.designation_uid::text = $$", f.designation);
  if (f.region) add("stt.region = $$", f.region);
  return `st as (select s.uid, s.first_name, s.last_name, s.team_team, d.designation as designation from fp_staff s left join fp_designation d on d.uid = s.designation_uid left join fp_state stt on stt.state = s.state_state where ${w.join(" and ")})`;
}

export const range = (f: DashFilters, params: unknown[]) => { params.push(f.from, f.to); return [`$${params.length - 1}::date`, `$${params.length}::date + 1`] as const; };
export const narrowed = (f: DashFilters) => !!(f.team || f.state || f.designation || f.region);

export interface CompanyDash {
  attendance: { active: number; loggedIn: number; onLeave: number; notLoggedIn: number; onVisit: number };
  coverage: { scheduled: number; completed: number; productive: number; markVisit: number };
  orders: { count: number; value: number; qty: number; accepted: number; pending: number; cancelled: number; primaryValue: number; secondaryValue: number };
  ranking: Array<{ name: string; orders: number; value: number; visits: number }>;
  branches: Array<{ team: string; orders: number; value: number; staff: number }>;
  productivity: Array<{ designation: string; staff: number; visits: number; productive: number }>;
  trend: Array<{ day: string; value: number }>;
}

export async function companyDashboard(f: DashFilters): Promise<CompanyDash> {
  const p0: unknown[] = [];
  const cte = staffCte(f, p0);
  const q = <T,>(sql: string, extra: unknown[] = []) => query<T>(sql, [...p0, ...extra]);
  const n = p0.length;
  const ord = f.salesType === "primary" ? "and b.order_type = 'PRIMARY'" : f.salesType === "secondary" ? "and b.order_type = 'SECONDARY'" : "";
  // primary orders have no employee; only count them when no employee filter narrows the view
  const ordStaff = narrowed(f) ? "and b.staff_uid in (select uid from st)" : "";

  const [att] = await q<{ active: number; logged: number; leave: number; visit: number }>(
    `with ${cte}
     select (select count(*)::int from st) as active,
            (select count(distinct a.staff_uid)::int from fp_staff_attendance a join st on st.uid = a.staff_uid where a.attendance_date::date = $${n + 1}::date and a.login_time is not null and coalesce(a.absent,0) = 0) as logged,
            (select count(distinct a.staff_uid)::int from fp_staff_attendance a join st on st.uid = a.staff_uid where a.attendance_date::date = $${n + 1}::date and coalesce(a.absent,0) = 1) as leave,
            (select count(distinct c.staff_uid)::int from fp_staff_channel_activity c join st on st.uid = c.staff_uid where c.scheduled_time::date = $${n + 1}::date) as visit`, [f.to]);
  const rp: unknown[] = [];
  const [cov] = await (async () => {
    const c2 = staffCte(f, rp);
    const [a, b] = range(f, rp);
    return query<{ scheduled: number; completed: number; productive: number; mark: number }>(
      `with ${c2}
       select count(*)::int as scheduled, count(*) filter (where c.status = 'Completed')::int as completed,
              count(*) filter (where c.booking_order = 1)::int as productive, count(*) filter (where c.mark_visit = 1)::int as mark
         from fp_staff_channel_activity c join st on st.uid = c.staff_uid where c.scheduled_time >= ${a} and c.scheduled_time < ${b}`, rp);
  })();
  const op: unknown[] = [];
  const oc = staffCte(f, op);
  const [oa, ob] = range(f, op);
  const [o] = await query<{ count: number; value: number; qty: number; accepted: number; pending: number; cancelled: number; pv: number; sv: number }>(
    `with ${oc}
     select count(*)::int as count, coalesce(sum(b.total_cost),0) as value, coalesce(sum(b.total_quantity),0) as qty,
            count(*) filter (where b.status in ('Accepted','Delivered'))::int as accepted, count(*) filter (where b.status = 'Pending')::int as pending,
            count(*) filter (where b.status in ('Cancelled','Rejected'))::int as cancelled,
            coalesce(sum(b.total_cost) filter (where b.order_type = 'PRIMARY'),0) as pv, coalesce(sum(b.total_cost) filter (where b.order_type = 'SECONDARY'),0) as sv
       from fp_booking_order b where b.booking_time >= ${oa} and b.booking_time < ${ob} ${ord} ${ordStaff}`, op);

  const rkp: unknown[] = [];
  const rc = staffCte(f, rkp);
  const [ra, rb] = range(f, rkp);
  const ranking = await query<CompanyDash["ranking"][number]>(
    `with ${rc}
     select concat_ws(' ', st.first_name, st.last_name) as name,
            (select count(*)::int from fp_booking_order b where b.staff_uid = st.uid and b.booking_time >= ${ra} and b.booking_time < ${rb} and b.status not in ('Cancelled','Rejected')) as orders,
            (select coalesce(sum(b.total_cost),0) from fp_booking_order b where b.staff_uid = st.uid and b.booking_time >= ${ra} and b.booking_time < ${rb} and b.status not in ('Cancelled','Rejected')) as value,
            (select count(*)::int from fp_staff_channel_activity c where c.staff_uid = st.uid and c.scheduled_time >= ${ra} and c.scheduled_time < ${rb}) as visits
       from st order by value desc, visits desc limit 8`, rkp);

  const bp: unknown[] = [];
  const bc = staffCte(f, bp);
  const [ba, bb] = range(f, bp);
  const branches = await query<CompanyDash["branches"][number]>(
    `with ${bc}
     select coalesce(st.team_team, 'Unassigned') as team, count(b.uid)::int as orders, coalesce(sum(b.total_cost),0) as value, count(distinct st.uid)::int as staff
       from st left join fp_booking_order b on b.staff_uid = st.uid and b.booking_time >= ${ba} and b.booking_time < ${bb} and b.status not in ('Cancelled','Rejected')
      group by 1 order by value desc`, bp);

  const pp: unknown[] = [];
  const pc = staffCte(f, pp);
  const [pa, pb] = range(f, pp);
  const productivity = await query<CompanyDash["productivity"][number]>(
    `with ${pc}
     select coalesce(st.designation, '—') as designation, count(distinct st.uid)::int as staff, count(c.uid)::int as visits, count(c.uid) filter (where c.booking_order = 1)::int as productive
       from st left join fp_staff_channel_activity c on c.staff_uid = st.uid and c.scheduled_time >= ${pa} and c.scheduled_time < ${pb}
      group by 1 order by visits desc`, pp);

  const tp: unknown[] = [f.from, f.to];
  const tc = staffCte(f, tp);
  const trend = await query<CompanyDash["trend"][number]>(
    `with ${tc}
     select to_char(d, 'DD Mon') as day, coalesce(sum(b.total_cost), 0) as value
       from generate_series($1::date, $2::date, interval '1 day') d
       left join fp_booking_order b on b.booking_time::date = d and b.status not in ('Cancelled','Rejected') ${ord} ${ordStaff}
      group by d order by d`, tp);

  return {
    attendance: { active: att.active, loggedIn: att.logged, onLeave: att.leave, notLoggedIn: Math.max(0, att.active - att.logged - att.leave), onVisit: att.visit },
    coverage: { scheduled: cov.scheduled, completed: cov.completed, productive: cov.productive, markVisit: cov.mark },
    orders: { count: o.count, value: Number(o.value), qty: Number(o.qty), accepted: o.accepted, pending: o.pending, cancelled: o.cancelled, primaryValue: Number(o.pv), secondaryValue: Number(o.sv) },
    ranking, branches, productivity, trend,
  };
}

export async function filterOptions() {
  const [regions, teams, states, designations] = await Promise.all([
    query<{ v: string }>(`select distinct region as v from fp_state order by 1`),
    query<{ v: string }>(`select team as v from fp_team order by 1`),
    query<{ v: string }>(`select state as v from fp_state order by 1`),
    query<{ id: string; label: string }>(`select uid::text as id, designation as label from fp_designation order by 2`),
  ]);
  return { regions: regions.map((r) => r.v), teams: teams.map((r) => r.v), states: states.map((r) => r.v), designations };
}
