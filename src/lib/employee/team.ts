import "server-only";
import { one, query } from "@/lib/db";
import { trail, type TrailPoint, type TrailVisit } from "./admin";

/**
 * A manager's team in the Gaia Salesforce app: everyone under them in the reporting line (fp_staff.reporting_manager_uid),
 * every level down, with today's day (attendance, sales day, last position, visits) and their orders and revenue over a
 * period; and for one of them, a day's map (the phone's route), visits and orders. Nobody sees anyone outside their line.
 */

const IST_TODAY = `(now() at time zone 'Asia/Kolkata')::date`;
const NAME = (a: string) => `trim(concat_ws(' ', ${a}.first_name, ${a}.last_name))`;

export interface TeamMember {
  uid: string;
  name: string;
  code: string | null;
  designation: string | null;
  phone: string | null;
  managerUid: string | null;
  manager: string | null;
  /** 1 = reports to the signed-in person, 2 = to one of those, ... */
  depth: number;
  /** under this person in turn */
  reports: number;
  hasApp: boolean;
  today: {
    attendanceIn: string | null;
    attendanceOut: string | null;
    dayStarted: string | null;
    dayEnded: string | null;
    lastSeen: { lat: number; lng: number; at: string } | null;
    visits: number;
    verified: number;
    orders: number;
    value: number;
  };
  period: { orders: number; value: number; visits: number; days: number };
}

const TEAM_TREE = `
  with recursive team as (
      select s.uid, s.reporting_manager_uid as manager, 1 as depth from fp_staff s
       where s.reporting_manager_uid = $1 and s.active = 1
      union all
      select s.uid, s.reporting_manager_uid, t.depth + 1 from fp_staff s join team t on s.reporting_manager_uid = t.uid
       where s.active = 1 and t.depth < 10 and s.uid <> $1
    )`;

/** Is `memberUid` somewhere under `managerUid` in the reporting line? */
export async function inTeam(managerUid: string, memberUid: string): Promise<boolean> {
  return !!(await one(`${TEAM_TREE} select 1 from team where uid = $2 limit 1`, [managerUid, memberUid]));
}

export async function teamOf(managerUid: string, days: number): Promise<TeamMember[]> {
  const d = Math.min(Math.max(Math.round(days) || 7, 1), 90);
  const rows = await query<Omit<TeamMember, "today" | "period"> & Record<string, unknown>>(
    `${TEAM_TREE},
     members as (select distinct on (uid) uid, manager, depth from team order by uid, depth)
     select s.uid, ${NAME("s")} as name, s.employee_code as code, dg.designation, s.phone,
            m.manager as "managerUid", ${NAME("mg")} as manager, m.depth,
            (select count(*)::int from fp_staff x where x.reporting_manager_uid = s.uid and x.active = 1) as reports,
            exists (select 1 from emp_login l where l.staff_uid = s.uid and l.active) as "hasApp",
            a.in_at as "attendanceIn", a.out_at as "attendanceOut", sd.started_at as "dayStarted", sd.ended_at as "dayEnded",
            loc.lat as "lastLat", loc.lng as "lastLng", loc.recorded_at as "lastAt",
            coalesce(tv.n, 0)::int as "tVisits", coalesce(tv.ok, 0)::int as "tVerified",
            coalesce(tor.n, 0)::int as "tOrders", coalesce(tor.v, 0)::float as "tValue",
            coalesce(po.n, 0)::int as "pOrders", coalesce(po.v, 0)::float as "pValue", coalesce(pv.n, 0)::int as "pVisits", coalesce(pd.n, 0)::int as "pDays"
       from members m
       join fp_staff s on s.uid = m.uid
       left join fp_designation dg on dg.uid = s.designation_uid
       left join fp_staff mg on mg.uid = m.manager
       left join emp_attendance a on a.staff_uid = s.uid and a.work_date = ${IST_TODAY}
       left join sf_day sd on sd.staff_uid = s.uid and sd.work_date = ${IST_TODAY}
       left join lateral (select lat, lng, recorded_at from sf_location where staff_uid = s.uid and recorded_at > now() - interval '1 day' order by recorded_at desc limit 1) loc on true
       left join lateral (select count(*) as n, count(*) filter (where verified) as ok from sf_visit where staff_uid = s.uid and work_date = ${IST_TODAY}) tv on true
       left join lateral (select count(*) as n, sum(total_cost) as v from fp_booking_order where staff_uid = s.uid
                           and (booking_time at time zone 'Asia/Kolkata')::date = ${IST_TODAY} and lower(status) not in ('cancelled', 'rejected')) tor on true
       left join lateral (select count(*) as n, sum(total_cost) as v from fp_booking_order where staff_uid = s.uid
                           and booking_time > now() - make_interval(days => $2) and lower(status) not in ('cancelled', 'rejected')) po on true
       left join lateral (select count(*) as n from sf_visit where staff_uid = s.uid and work_date > ${IST_TODAY} - $2) pv on true
       left join lateral (select count(*) as n from sf_day where staff_uid = s.uid and work_date > ${IST_TODAY} - $2) pd on true
      order by m.depth, name`,
    [managerUid, d],
  );
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return rows.map((r) => ({
    uid: r.uid, name: r.name, code: r.code, designation: r.designation, phone: r.phone, managerUid: r.managerUid, manager: r.manager,
    depth: r.depth, reports: r.reports, hasApp: r.hasApp,
    today: {
      attendanceIn: iso(r.attendanceIn), attendanceOut: iso(r.attendanceOut), dayStarted: iso(r.dayStarted), dayEnded: iso(r.dayEnded),
      lastSeen: r.lastLat != null ? { lat: r.lastLat as number, lng: r.lastLng as number, at: iso(r.lastAt)! } : null,
      visits: r.tVisits as number, verified: r.tVerified as number, orders: r.tOrders as number, value: Math.round(r.tValue as number),
    },
    period: { orders: r.pOrders as number, value: Math.round(r.pValue as number), visits: r.pVisits as number, days: r.pDays as number },
  }));
}

export interface MemberDay {
  date: string;
  name: string | null;
  dayStarted: string | null;
  dayEnded: string | null;
  attendanceIn: string | null;
  attendanceOut: string | null;
  points: TrailPoint[];
  visits: TrailVisit[];
  orders: Array<{ orderId: number; party: string; status: string; items: number; value: number; at: string }>;
  km: number;
}

/** One person's day: the route their phone recorded, their store visits and the orders they booked. */
export async function memberDay(staffUid: string, date: string | null): Promise<MemberDay> {
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : (await one<{ d: string }>(`select ${IST_TODAY}::text as d`))!.d;
  const [t, sd, att, orders] = await Promise.all([
    trail(staffUid, day),
    one<{ s: string | null; e: string | null }>(`select started_at as s, ended_at as e from sf_day where staff_uid = $1 and work_date = $2`, [staffUid, day]),
    one<{ i: string | null; o: string | null }>(`select in_at as i, out_at as o from emp_attendance where staff_uid = $1 and work_date = $2`, [staffUid, day]),
    query<{ orderId: number; party: string; status: string; items: number; value: number; at: string }>(
      `select b.order_id as "orderId", f.name as party, b.status, b.total_item::int as items, b.total_cost::float as value, b.booking_time as at
         from fp_booking_order b join fp_firm f on f.uid = b.from_firm_uid
        where b.staff_uid = $1 and (b.booking_time at time zone 'Asia/Kolkata')::date = $2 order by b.booking_time`,
      [staffUid, day],
    ),
  ]);
  // the distance along the route, leaving out GPS jumps (over 2 km between two fixes)
  let m = 0;
  const rad = (x: number) => (x * Math.PI) / 180;
  for (let i = 1; i < t.points.length; i++) {
    const a = t.points[i - 1], b = t.points[i];
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    const dm = 2 * 6371000 * Math.asin(Math.sqrt(h));
    if (dm < 2000) m += dm;
  }
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    date: day, name: t.name, dayStarted: iso(sd?.s), dayEnded: iso(sd?.e), attendanceIn: iso(att?.i), attendanceOut: iso(att?.o),
    points: t.points.map((p) => ({ ...p, at: new Date(p.at).toISOString() })),
    visits: t.visits.map((v) => ({ ...v, inAt: new Date(v.inAt).toISOString(), outAt: iso(v.outAt), lat: v.lat == null ? null : Number(v.lat), lng: v.lng == null ? null : Number(v.lng) })),
    orders: orders.map((o) => ({ ...o, at: new Date(o.at).toISOString() })),
    km: Math.round(m / 100) / 10,
  };
}
