import "server-only";
import { one, query, tx } from "@/lib/db";
import type { PayLine } from "@/lib/employee";

/** The office side of the Gaia Salesforce staff app: who is where, and everything employees send that needs an answer. */

const IST_TODAY = `(now() at time zone 'Asia/Kolkata')::date`;
const FULL_NAME = (a: string) => `trim(concat_ws(' ', ${a}.first_name, ${a}.last_name))`;

/** A staff row is on the sales side: sales designation, a sales login, or a route assigned. `a` is the fp_staff alias, `d` fp_designation. */
const SALES_SIDE = (a: string, d: string) => `(coalesce(${d}.sales, 0) = 1
  or exists (select 1 from dist_login dl where dl.staff_uid = ${a}.uid and dl.kind = 'salesman' and dl.active)
  or exists (select 1 from fp_beat b where b.staff_uid = ${a}.uid and coalesce(b.status, 1) <> 0)
  or exists (select 1 from fp_staff_beat sb where sb.staff_uid = ${a}.uid and sb.unassigned_date is null and coalesce(sb.status, 1) <> 0))`;

export async function overview() {
  const r = await one<Record<string, number>>(
    `select
       (select count(*)::int from emp_login where active) as accounts,
       (select count(*)::int from emp_signup where status = 'pending') as signups,
       (select count(*)::int from emp_attendance where work_date = ${IST_TODAY}) as "punchedToday",
       (select count(*)::int from emp_attendance where work_date = ${IST_TODAY} and out_at is null) as "stillIn",
       (select count(*)::int from sf_day where work_date = ${IST_TODAY} and ended_at is null) as "fieldOn",
       (select count(*)::int from emp_leave where status = 'pending') as leaves,
       (select count(*)::int from emp_claim where status = 'pending') as claims,
       (select coalesce(sum(amount), 0)::float from emp_claim where status = 'pending') as "claimAmount",
       (select count(*)::int from emp_claim where status = 'approved') as "toPay",
       (select count(*)::int from emp_request where status <> 'closed') as requests`,
  );
  return r!;
}

// ---------------------------------------------------------------- account requests and logins

export interface SignupRow { id: number; phone: string; name: string; email: string | null; department: string | null; status: string; remark: string | null; createdAt: string; staffName: string | null }

export async function listSignups(): Promise<SignupRow[]> {
  return query<SignupRow>(
    `select g.id, g.phone, g.name, g.email, g.department, g.status, g.remark, g.created_at as "createdAt", ${FULL_NAME("s")} as "staffName"
       from emp_signup g left join fp_staff s on s.uid = g.staff_uid
      order by (g.status = 'pending') desc, g.created_at desc limit 200`,
  );
}

export interface StaffOption { uid: string; name: string; code: string | null; phone: string | null; designation: string | null }

export async function staffOptions(onlyUnlinked: boolean): Promise<StaffOption[]> {
  return query<StaffOption>(
    `select s.uid, ${FULL_NAME("s")} as name, s.employee_code as code, s.phone, d.designation
       from fp_staff s left join fp_designation d on d.uid = s.designation_uid
      where s.active = 1 ${onlyUnlinked ? "and not exists (select 1 from emp_login l where l.staff_uid = s.uid)" : ""}
      order by s.first_name, s.last_name limit 2000`,
  );
}

export async function approveSignup(id: number, staffUid: string): Promise<string | null> {
  return tx(async (c) => {
    const g = (await c.query<{ phone: string }>(`select phone from emp_signup where id = $1 and status = 'pending' for update`, [id])).rows[0];
    if (!g) return "This request was already handled.";
    const taken = (await c.query(`select 1 from emp_login where phone = $1 and staff_uid <> $2`, [g.phone, staffUid])).rows[0];
    if (taken) return "This number already belongs to another employee's login.";
    await c.query(
      `insert into emp_login (staff_uid, phone) values ($1, $2) on conflict (staff_uid) do update set phone = excluded.phone, active = true, token = null`,
      [staffUid, g.phone],
    );
    await c.query(`update emp_signup set status = 'approved', staff_uid = $2, decided_at = now() where id = $1`, [id, staffUid]);
    return null;
  });
}

export async function rejectSignup(id: number, remark: string) {
  await query(`update emp_signup set status = 'rejected', remark = $2, decided_at = now() where id = $1 and status = 'pending'`, [id, remark.slice(0, 300) || null]);
}

export interface LoginRow { id: number; staffUid: string; name: string; code: string | null; phone: string; active: boolean; lastLogin: string | null; device: string | null }

export async function listLogins(): Promise<LoginRow[]> {
  return query<LoginRow>(
    `select l.id, l.staff_uid as "staffUid", ${FULL_NAME("s")} as name, s.employee_code as code, l.phone, l.active, l.last_login as "lastLogin", l.device
       from emp_login l join fp_staff s on s.uid = l.staff_uid order by s.first_name, s.last_name`,
  );
}

export async function setLoginActive(id: number, active: boolean) {
  await query(`update emp_login set active = $2, token = case when $2 then token else null end where id = $1`, [id, active]);
}

// ---------------------------------------------------------------- sites a punch is checked against

export interface SiteRow { id: number; name: string; lat: number; lng: number; radiusM: number }
export const listSites = () => query<SiteRow>(`select id, name, lat, lng, radius_m as "radiusM" from emp_site where active order by name`);
export async function addSite(name: string, lat: number, lng: number, radiusM: number) {
  await query(`insert into emp_site (name, lat, lng, radius_m) values ($1, $2, $3, $4)`, [name, lat, lng, radiusM]);
}
export const removeSite = (id: number) => query(`update emp_site set active = false where id = $1`, [id]);

// ---------------------------------------------------------------- live team and trail

export interface TeamMember {
  uid: string; name: string; phone: string | null; code: string | null;
  startedAt: string | null; endedAt: string | null;
  lat: number | null; lng: number | null; seenAt: string | null; battery: number | null; speed: number | null;
  visits: number; verified: number; orders: number; orderValue: number; atStore: string | null; km: number;
}

/** Every sales employee who is on the field today (or has a route), with the last place their phone reported. */
export async function teamLive(): Promise<TeamMember[]> {
  return query<TeamMember>(
    `select s.uid, ${FULL_NAME("s")} as name, s.phone, s.employee_code as code,
            d.started_at as "startedAt", d.ended_at as "endedAt",
            p.lat, p.lng, p.recorded_at as "seenAt", p.battery, p.speed,
            (select count(*)::int from sf_visit v where v.staff_uid = s.uid and v.work_date = ${IST_TODAY}) as visits,
            (select count(*)::int from sf_visit v where v.staff_uid = s.uid and v.work_date = ${IST_TODAY} and v.verified) as verified,
            (select count(*)::int from fp_booking_order o join sf_visit v on v.id = o.sf_visit_id where v.staff_uid = s.uid and v.work_date = ${IST_TODAY}) as orders,
            (select coalesce(sum(o.total_cost), 0)::float from fp_booking_order o join sf_visit v on v.id = o.sf_visit_id where v.staff_uid = s.uid and v.work_date = ${IST_TODAY}) as "orderValue",
            (select f.name from sf_visit v join fp_firm f on f.uid = v.firm_uid where v.staff_uid = s.uid and v.check_out_at is null limit 1) as "atStore",
            coalesce((select sum(2 * 6371 * asin(sqrt(least(1, sin(radians(t.lat - t.plat) / 2) ^ 2
                      + cos(radians(t.plat)) * cos(radians(t.lat)) * sin(radians(t.lng - t.plng) / 2) ^ 2))))
                from (select lat, lng, lag(lat) over w as plat, lag(lng) over w as plng
                        from sf_location where staff_uid = s.uid and (recorded_at at time zone 'Asia/Kolkata')::date = ${IST_TODAY} and (accuracy is null or accuracy <= 100)
                        window w as (order by recorded_at)) t where t.plat is not null), 0)::float as km
       from fp_staff s
       left join fp_designation dg on dg.uid = s.designation_uid
       left join sf_day d on d.staff_uid = s.uid and d.work_date = ${IST_TODAY}
       left join lateral (select lat, lng, recorded_at, battery, speed from sf_location l
                           where l.staff_uid = s.uid and l.recorded_at > now() - interval '2 days' order by l.recorded_at desc limit 1) p on true
      where s.active = 1 and (d.id is not null or ${SALES_SIDE("s", "dg")})
      order by (d.started_at is not null and d.ended_at is null) desc, d.started_at nulls last, s.first_name`,
  );
}

export interface TrailPoint { lat: number; lng: number; at: string; speed: number | null; battery: number | null }
export interface TrailVisit { id: number; store: string; lat: number | null; lng: number | null; inAt: string; outAt: string | null; verified: boolean; outcome: string | null; orders: number; value: number }

export async function trail(staffUid: string, date: string): Promise<{ points: TrailPoint[]; visits: TrailVisit[]; name: string | null }> {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : (await one<{ d: string }>(`select ${IST_TODAY}::text as d`))!.d;
  const [points, visits, who] = await Promise.all([
    query<TrailPoint>(
      `select lat, lng, recorded_at as at, speed, battery from sf_location
        where staff_uid = $1 and (recorded_at at time zone 'Asia/Kolkata')::date = $2 and (accuracy is null or accuracy <= 100) order by recorded_at limit 3000`,
      [staffUid, day],
    ),
    query<TrailVisit>(
      `select v.id, f.name as store, f.latitude as lat, f.longitude as lng, v.check_in_at as "inAt", v.check_out_at as "outAt", v.verified, v.outcome,
              (select count(*)::int from fp_booking_order o where o.sf_visit_id = v.id) as orders,
              (select coalesce(sum(o.total_cost), 0)::float from fp_booking_order o where o.sf_visit_id = v.id) as value
         from sf_visit v join fp_firm f on f.uid = v.firm_uid where v.staff_uid = $1 and v.work_date = $2 order by v.check_in_at`,
      [staffUid, day],
    ),
    one<{ name: string }>(`select ${FULL_NAME("s")} as name from fp_staff s where uid = $1`, [staffUid]),
  ]);
  return { points, visits, name: who?.name ?? null };
}

// ---------------------------------------------------------------- attendance

export interface AttendanceRow {
  uid: string; name: string; code: string | null; designation: string | null;
  inAt: string | null; outAt: string | null; hours: number | null; method: string | null; site: string | null; onLeave: boolean; late: boolean;
}

export async function attendanceOn(date: string): Promise<AttendanceRow[]> {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : (await one<{ d: string }>(`select ${IST_TODAY}::text as d`))!.d;
  return query<AttendanceRow>(
    `select s.uid, ${FULL_NAME("s")} as name, s.employee_code as code, dg.designation,
            a.in_at as "inAt", a.out_at as "outAt",
            case when a.out_at is not null then round(extract(epoch from a.out_at - a.in_at) / 3600.0, 2)::float end as hours,
            a.in_method as method, a.in_site as site,
            exists (select 1 from emp_leave l where l.staff_uid = s.uid and l.status = 'approved' and $1::date between l.from_date and l.to_date) as "onLeave",
            coalesce(extract(hour from a.in_at at time zone 'Asia/Kolkata') * 60 + extract(minute from a.in_at at time zone 'Asia/Kolkata') > 615, false) as late
       from emp_login l
       join fp_staff s on s.uid = l.staff_uid
       left join fp_designation dg on dg.uid = s.designation_uid
       left join emp_attendance a on a.staff_uid = s.uid and a.work_date = $1
      where l.active and s.active = 1
      order by (a.in_at is null), a.in_at, s.first_name`,
    [day],
  );
}

// ---------------------------------------------------------------- leave, claims, requests

export interface LeaveAdminRow { id: number; name: string; code: string | null; type: string; from: string; to: string; days: number; halfDay: boolean; reason: string; status: string; remark: string | null; decidedBy: string | null; createdAt: string; clash: number }

export async function listLeaveRequests(pendingOnly: boolean): Promise<LeaveAdminRow[]> {
  return query<LeaveAdminRow>(
    `select l.id, ${FULL_NAME("s")} as name, s.employee_code as code, t.name as type, l.from_date::text as "from", l.to_date::text as "to", l.days::float as days,
            l.half_day as "halfDay", l.reason, l.status, l.remark, l.decided_by as "decidedBy", l.created_at as "createdAt",
            -- other people of the same reporting manager off on these dates
            (select count(*)::int from emp_leave o join fp_staff os on os.uid = o.staff_uid
              where o.status = 'approved' and o.id <> l.id and os.reporting_manager_uid is not distinct from s.reporting_manager_uid
                and o.from_date <= l.to_date and o.to_date >= l.from_date) as clash
       from emp_leave l join fp_staff s on s.uid = l.staff_uid join emp_leave_type t on t.id = l.type_id
      ${pendingOnly ? "where l.status = 'pending'" : "where l.status <> 'cancelled'"}
      order by (l.status = 'pending') desc, l.created_at desc limit 200`,
  );
}

export async function decideLeave(id: number, approve: boolean, by: string, remark: string): Promise<string | null> {
  const r = await query(
    `update emp_leave set status = $2, decided_by = $3, decided_at = now(), remark = $4 where id = $1 and status = 'pending' returning id`,
    [id, approve ? "approved" : "rejected", by, remark.slice(0, 300) || null],
  );
  return r.length ? null : "This request was already handled.";
}

export interface ClaimAdminRow { id: number; name: string; code: string | null; category: string; amount: number; spentOn: string; description: string; status: string; approvedAmount: number | null; remark: string | null; hasReceipt: boolean; createdAt: string; paidAt: string | null; decidedBy: string | null }

export async function listClaimRows(filter: "open" | "approved" | "all"): Promise<ClaimAdminRow[]> {
  const where = filter === "open" ? "where c.status = 'pending'" : filter === "approved" ? "where c.status = 'approved'" : "";
  return query<ClaimAdminRow>(
    `select c.id, ${FULL_NAME("s")} as name, s.employee_code as code, c.category, c.amount::float as amount, c.spent_on::text as "spentOn", c.description, c.status,
            c.approved_amount::float as "approvedAmount", c.remark, c.receipt is not null as "hasReceipt", c.created_at as "createdAt", c.paid_at as "paidAt", c.decided_by as "decidedBy"
       from emp_claim c join fp_staff s on s.uid = c.staff_uid ${where}
      order by (c.status = 'pending') desc, c.created_at desc limit 300`,
  );
}

export const claimReceiptAny = async (id: number) => (await one<{ receipt: string | null }>(`select receipt from emp_claim where id = $1`, [id]))?.receipt ?? null;

export async function decideClaim(id: number, action: "approve" | "reject" | "pay", by: string, amount: number | null, remark: string): Promise<string | null> {
  if (action === "pay") {
    const r = await query(`update emp_claim set status = 'paid', paid_at = now() where id = $1 and status = 'approved' returning id`, [id]);
    return r.length ? null : "Only an approved claim can be marked paid.";
  }
  if (action === "reject" && !remark.trim()) return "Say why the claim is rejected.";
  const r = await query(
    `update emp_claim set status = $2, decided_by = $3, decided_at = now(), remark = $4, approved_amount = case when $2 = 'approved' then coalesce($5, amount) else null end
      where id = $1 and status = 'pending' returning id`,
    [id, action === "approve" ? "approved" : "rejected", by, remark.slice(0, 300) || null, amount],
  );
  return r.length ? null : "This claim was already handled.";
}

export interface RequestAdminRow { id: number; name: string; code: string | null; phone: string | null; kind: string; subject: string; message: string; status: string; reply: string | null; createdAt: string }

export async function listRequestRows(openOnly: boolean): Promise<RequestAdminRow[]> {
  return query<RequestAdminRow>(
    `select r.id, ${FULL_NAME("s")} as name, s.employee_code as code, s.phone, r.kind, r.subject, r.message, r.status, r.reply, r.created_at as "createdAt"
       from emp_request r join fp_staff s on s.uid = r.staff_uid ${openOnly ? "where r.status <> 'closed'" : ""}
      order by (r.status = 'closed'), r.created_at desc limit 200`,
  );
}

export async function replyRequest(id: number, by: string, reply: string, close: boolean) {
  await query(
    `update emp_request set reply = $2, replied_by = $3, replied_at = now(), status = $4 where id = $1`,
    [id, reply.slice(0, 1500), by, close ? "closed" : "in_progress"],
  );
}

// ---------------------------------------------------------------- notices

export interface NoticeAdminRow { id: number; title: string; body: string; kind: string; audience: string; pinned: boolean; to: string | null; createdAt: string; by: string | null; readBy: number; reach: number }

export async function listNoticeRows(): Promise<NoticeAdminRow[]> {
  return query<NoticeAdminRow>(
    `select n.id, n.title, n.body, n.kind, n.audience, n.pinned, ${FULL_NAME("s")} as "to", n.created_at as "createdAt", n.created_by as by,
            (select count(*)::int from emp_notice_read r where r.notice_id = n.id) as "readBy",
            case n.audience when 'staff' then 1
              when 'sales' then (select count(*)::int from emp_login l join fp_staff x on x.uid = l.staff_uid left join fp_designation dg on dg.uid = x.designation_uid where l.active and ${SALES_SIDE("x", "dg")})
              else (select count(*)::int from emp_login where active) end as reach
       from emp_notice n left join fp_staff s on s.uid = n.staff_uid order by n.pinned desc, n.created_at desc limit 100`,
  );
}

export async function createNotice(n: { title: string; body: string; kind: string; audience: string; staffUid: string | null; pinned: boolean }, by: string) {
  await query(
    `insert into emp_notice (title, body, kind, audience, staff_uid, pinned, created_by) values ($1, $2, $3, $4, $5, $6, $7)`,
    [n.title, n.body, n.kind, n.audience, n.audience === "staff" ? n.staffUid : null, n.pinned, by],
  );
}
export const deleteNotice = (id: number) => query(`delete from emp_notice where id = $1`, [id]);

// ---------------------------------------------------------------- salary slips

export interface PayslipAdminRow { id: number; name: string; code: string | null; month: string; gross: number; totalDeductions: number; net: number; published: boolean }

export async function listPayslipRows(month: string): Promise<PayslipAdminRow[]> {
  return query<PayslipAdminRow>(
    `select p.id, ${FULL_NAME("s")} as name, s.employee_code as code, p.month::text as month, p.gross::float as gross, p.total_deductions::float as "totalDeductions", p.net::float as net, p.published
       from emp_payslip p join fp_staff s on s.uid = p.staff_uid where p.month = $1::date order by s.first_name, s.last_name`,
    [`${month}-01`],
  );
}

export async function savePayslip(
  p: { staffUid: string; month: string; daysInMonth: number | null; daysPaid: number | null; earnings: PayLine[]; deductions: PayLine[]; note: string | null },
  by: string,
) {
  const gross = Math.round(p.earnings.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const ded = Math.round(p.deductions.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  await query(
    `insert into emp_payslip (staff_uid, month, days_in_month, days_paid, earnings, deductions, gross, total_deductions, net, note, created_by)
     values ($1, $2::date, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11)
     on conflict (staff_uid, month) do update set days_in_month = $3, days_paid = $4, earnings = $5::jsonb, deductions = $6::jsonb,
       gross = $7, total_deductions = $8, net = $9, note = $10, created_by = $11, published = true`,
    [p.staffUid, `${p.month}-01`, p.daysInMonth, p.daysPaid, JSON.stringify(p.earnings), JSON.stringify(p.deductions), gross, ded, gross - ded, p.note, by],
  );
}

export const deletePayslip = (id: number) => query(`delete from emp_payslip where id = $1`, [id]);

/**
 * Salary slips from a spreadsheet saved as CSV. Columns: employee_code, month (YYYY-MM), optional days_in_month and days_paid,
 * then earnings as "E:Basic", "E:HRA" ... and deductions as "D:PF", "D:TDS" ...
 */
export async function importPayslips(csv: string, by: string): Promise<{ saved: number; errors: string[] }> {
  const rows = parseCsv(csv);
  const errors: string[] = [];
  if (rows.length < 2) return { saved: 0, errors: ["The file is empty."] };
  const head = rows[0].map((h) => h.trim());
  const col = (n: string) => head.findIndex((h) => h.toLowerCase() === n);
  const ci = col("employee_code"), mi = col("month");
  if (ci < 0 || mi < 0) return { saved: 0, errors: ["The first row must have employee_code and month columns."] };
  const di = col("days_in_month"), pi = col("days_paid");
  const money = head.map((h, i) => ({ i, kind: /^e:/i.test(h) ? "E" : /^d:/i.test(h) ? "D" : "", label: h.slice(2).trim() })).filter((c) => c.kind && c.label);
  if (!money.some((c) => c.kind === "E")) return { saved: 0, errors: ["Add earning columns named like E:Basic, E:HRA."] };
  let saved = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((x) => !x.trim())) continue;
    const code = row[ci]?.trim(), month = row[mi]?.trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? "")) { errors.push(`Row ${r + 1}: month must look like 2026-10.`); continue; }
    const staff = await one<{ uid: string }>(`select uid from fp_staff where active = 1 and lower(employee_code) = lower($1)`, [code]);
    if (!staff) { errors.push(`Row ${r + 1}: no active employee with code ${code}.`); continue; }
    const lines = (k: string): PayLine[] => money.filter((c) => c.kind === k).map((c) => ({ label: c.label, amount: Number((row[c.i] ?? "").replace(/,/g, "")) || 0 })).filter((l) => l.amount !== 0);
    const earnings = lines("E");
    if (!earnings.length) { errors.push(`Row ${r + 1}: no earnings.`); continue; }
    await savePayslip({ staffUid: staff.uid, month, daysInMonth: di >= 0 ? Number(row[di]) || null : null, daysPaid: pi >= 0 ? Number(row[pi]) || null : null, earnings, deductions: lines("D"), note: null }, by);
    saved++;
  }
  return { saved, errors: errors.slice(0, 20) };
}

/** Minimal CSV reader: quotes, commas and newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; rows.push(row); row = []; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
