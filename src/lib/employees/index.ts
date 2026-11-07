import "server-only";
import { one, query, tx } from "@/lib/db";

/**
 * Employee Master (migration 094): every employee - the staff list, fp_staff, which the Employee app and the
 * Salesforce app sign in against - in one of three groups with a department, and the dashboard login that is them.
 *
 * Until HR places someone, a sales designation counts as Salesforce; everyone else is "Not set".
 */
export type Wing = "salesforce" | "plant" | "office";
export type WingTab = Wing | "unset";
export const WINGS: Array<{ key: Wing; label: string; about: string }> = [
  { key: "salesforce", label: "Salesforce", about: "Sales officers, ASMs, promoters and the rest of the field team" },
  { key: "plant", label: "Plant", about: "Production, quality, store, procurement, dispatch and maintenance" },
  { key: "office", label: "Office", about: "Accounts, HR, admin and management" },
];
export const isWing = (w: unknown): w is Wing => WINGS.some((x) => x.key === w);
export const isWingTab = (w: string): w is WingTab => w === "unset" || isWing(w);
export const wingLabel = (w: string | null) => WINGS.find((x) => x.key === w)?.label ?? "Not set";

const SALES_DESIGNATION = `(coalesce(d.sales, 0) = 1
  or d.designation ~* '(sales|\\mso\\M|\\maso\\M|\\masm\\M|\\mrsm\\M|\\mzsm\\M|\\mtsi\\M|\\mtse\\M|promoter|merchandis|territory|field)')`;
/** The group: HR's choice, else Salesforce for a sales designation. */
const WING = `coalesce(m.wing, case when ${SALES_DESIGNATION} then 'salesforce' end)`;
const FULL_NAME = (a: string) => `nullif(trim(${a}.first_name || ' ' || coalesce(${a}.last_name, '')), '')`;

const FROM = `fp_staff s
  left join emp_master m on m.staff_uid = s.uid
  left join fp_designation d on d.uid = s.designation_uid
  left join department dep on dep.id = m.department_id
  left join fp_staff mgr on mgr.uid = s.reporting_manager_uid
  left join app_user u on u.id = m.app_user_id`;

/** Photo URL for an employee (their own from the Employee app, else the staff record's). */
export const employeePhoto = (uid: string) => `/api/employees/photo/${uid}`;

export interface EmployeeRow {
  uid: string; name: string; code: string | null; designation: string | null; department: string | null; departmentId: number | null;
  wing: Wing | null; wingSet: boolean; phone: string | null; email: string | null; manager: string | null; joined: Date | null;
  active: boolean; hasPhoto: boolean;
  employeeApp: boolean; salesforceApp: boolean; dashboard: { email: string; role: string; active: boolean } | null;
}

const ROW = `s.uid, ${FULL_NAME("s")} as name, s.employee_code as code, d.designation,
  coalesce(dep.name, nullif(trim(d.department), '')) as department, m.department_id as "departmentId",
  ${WING} as wing, m.wing is not null as "wingSet", s.phone, s.email, ${FULL_NAME("mgr")} as manager, s.date_of_joining as joined,
  coalesce(s.active, 1) = 1 as active,
  (exists (select 1 from emp_profile p where p.staff_uid = s.uid and p.photo is not null) or nullif(trim(s.profile_pic), '') is not null) as "hasPhoto",
  exists (select 1 from emp_login l where l.staff_uid = s.uid and l.active) as "employeeApp",
  exists (select 1 from dist_login l where l.staff_uid = s.uid and l.kind = 'salesman' and l.active) as "salesforceApp",
  case when u.id is null then null else json_build_object('email', u.email, 'role', u.role, 'active', u.is_active) end as dashboard`;

/** Employees of one group (or the ones not placed yet), active first. */
export function listEmployees(tab: WingTab, q = "", departmentId?: number): Promise<EmployeeRow[]> {
  const like = `%${q.trim().toLowerCase()}%`;
  return query<EmployeeRow>(
    `select ${ROW} from ${FROM}
      where (${tab === "unset" ? `${WING} is null and $1::text is null` : `${WING} = $1::text`})
        and ($2 = '%%' or lower(${FULL_NAME("s")}) like $2 or lower(coalesce(s.employee_code, '')) like $2 or coalesce(s.phone, '') like $2
             or lower(coalesce(d.designation, '')) like $2 or lower(coalesce(dep.name, d.department, '')) like $2)
        and ($3::int is null or m.department_id = $3)
      order by coalesce(s.active, 1) = 1 desc, ${FULL_NAME("s")}
      limit 3000`,
    [tab === "unset" ? null : tab, like, departmentId ?? null],
  );
}

export async function wingCounts(): Promise<Record<WingTab, number>> {
  const rows = await query<{ wing: string | null; n: number }>(`select ${WING} as wing, count(*)::int as n from ${FROM} group by 1`);
  const out: Record<WingTab, number> = { salesforce: 0, plant: 0, office: 0, unset: 0 };
  for (const r of rows) out[(r.wing as Wing | null) ?? "unset"] += r.n;
  return out;
}

// ---------------------------------------------------------------- one employee

export interface EmployeeProfile extends EmployeeRow {
  firstName: string; lastName: string | null; gender: string | null; birthday: Date | null;
  address: string | null; city: string | null; pincode: string | null; state: string | null;
  aadhaar: string | null; pan: string | null; grade: string | null; territory: string | null; route: string | null;
  employmentType: number | null; managerUid: string | null; firm: string | null;
  resignedOn: Date | null; leftOn: Date | null;
  own: { bloodGroup: string | null; emergencyName: string | null; emergencyPhone: string | null; emergencyRel: string | null;
         bankName: string | null; accountNo: string | null; ifsc: string | null } | null;
  employeeLogin: { phone: string; active: boolean; lastLogin: Date | null } | null;
  salesforceLogin: { phone: string; active: boolean } | null;
  dashboardUserId: string | null;
  reports: Array<{ uid: string; name: string; designation: string | null }>;
  month: { present: number; leaves: number } | null;
}

export async function employeeProfile(uid: string): Promise<EmployeeProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return null;
  return one<EmployeeProfile>(
    `select ${ROW}, s.first_name as "firstName", s.last_name as "lastName", s.gender, s.date_of_birth as birthday,
            s.address, s.city, s.pincode, s.state_state as state,
            case when length(regexp_replace(coalesce(s.aadhar_number, ''), '\\D', '', 'g')) >= 4
                 then 'XXXX XXXX ' || right(regexp_replace(s.aadhar_number, '\\D', '', 'g'), 4) end as aadhaar,
            s.pan, s.grade, s.territory_code as territory, s.route, s.employment_type as "employmentType",
            s.reporting_manager_uid as "managerUid", f.name as firm, s.resignation_date as "resignedOn", s.deactivation_date as "leftOn",
            (select json_build_object('bloodGroup', p.blood_group, 'emergencyName', p.emergency_name, 'emergencyPhone', p.emergency_phone,
                                      'emergencyRel', p.emergency_rel, 'bankName', p.bank_name,
                                      'accountNo', case when p.account_no is null then null else 'XXXX' || right(p.account_no, 4) end, 'ifsc', p.ifsc)
               from emp_profile p where p.staff_uid = s.uid) as own,
            (select json_build_object('phone', l.phone, 'active', l.active, 'lastLogin', l.last_login) from emp_login l where l.staff_uid = s.uid) as "employeeLogin",
            (select json_build_object('phone', l.phone, 'active', l.active) from dist_login l where l.staff_uid = s.uid and l.kind = 'salesman' limit 1) as "salesforceLogin",
            m.app_user_id as "dashboardUserId",
            coalesce((select json_agg(json_build_object('uid', r.uid, 'name', ${FULL_NAME("r")}, 'designation', rd.designation) order by r.first_name)
                        from fp_staff r left join fp_designation rd on rd.uid = r.designation_uid
                       where r.reporting_manager_uid = s.uid and coalesce(r.active, 1) = 1), '[]') as reports,
            (select json_build_object(
                      'present', (select count(distinct a.work_date)::int from emp_attendance a
                                   where a.staff_uid = s.uid and a.work_date >= date_trunc('month', current_date)),
                      'leaves', (select count(*)::int from emp_leave lv where lv.staff_uid = s.uid and lv.status = 'approved'
                                   and lv.to_date >= date_trunc('month', current_date)))) as month
       from ${FROM} left join fp_firm f on f.uid = s.firm_uid
      where s.uid = $1`,
    [uid],
  );
}

// ---------------------------------------------------------------- departments

export interface Department { id: number; name: string; wing: Wing | null; active: boolean; people: number }

export const listDepartments = () =>
  query<Department>(
    `select dep.id, dep.name, dep.wing, dep.active, (select count(*)::int from emp_master m where m.department_id = dep.id) as people
       from department dep order by dep.active desc, dep.sort, dep.name`,
  );

/** Dashboard logins not yet linked to an employee (to link one). */
export const unlinkedUsers = () =>
  query<{ id: string; email: string; name: string; role: string }>(
    `select u.id, u.email, u.name, u.role from app_user u
      where not exists (select 1 from emp_master m where m.app_user_id = u.id) order by u.name`,
  );

// ---------------------------------------------------------------- changes

export type Result = { ok: true } | { ok: false; error: string };

const audit = (who: string, record: string, summary: string, after: unknown) =>
  query(`insert into master_audit (actor, slug, record_id, action, summary, before, after) values ($1, 'employees', $2, 'update', $3, null, $4)`,
    [who, record, summary, JSON.stringify(after)]);

/** Puts employees in a group and/or department. `wing: null` takes them out of any group. */
export async function placeEmployees(uids: string[], change: { wing?: Wing | null; departmentId?: number | null }, who: string): Promise<Result> {
  const ids = uids.filter((u) => /^[0-9a-f-]{36}$/i.test(u));
  if (!ids.length) return { ok: false, error: "Pick at least one employee." };
  if (change.wing !== undefined && change.wing !== null && !isWing(change.wing)) return { ok: false, error: "Unknown group." };
  if (change.departmentId != null && !(await one(`select 1 from department where id = $1`, [change.departmentId]))) {
    return { ok: false, error: "Unknown department." };
  }
  await tx(async (c) => {
    await c.query(
      `insert into emp_master (staff_uid, wing, department_id, updated_by)
       select u, $2, $3, $4 from unnest($1::uuid[]) u where exists (select 1 from fp_staff s where s.uid = u)
       on conflict (staff_uid) do update set
         wing = case when $5 then excluded.wing else emp_master.wing end,
         department_id = case when $6 then excluded.department_id else emp_master.department_id end,
         updated_at = now(), updated_by = $4`,
      [ids, change.wing ?? null, change.departmentId ?? null, who, change.wing !== undefined, change.departmentId !== undefined],
    );
  });
  await audit(who, ids.join(","), `${ids.length} employee(s) ${change.wing !== undefined ? `to ${wingLabel(change.wing)}` : ""}${change.departmentId !== undefined ? " department changed" : ""}`, change);
  return { ok: true };
}

/** Links a dashboard login to an employee (or unlinks it with null). */
export async function linkDashboardUser(staffUid: string, userId: string | null, who: string): Promise<Result> {
  if (userId && (await one(`select 1 from emp_master where app_user_id = $1 and staff_uid <> $2`, [userId, staffUid]))) {
    return { ok: false, error: "That login already belongs to another employee." };
  }
  await query(
    `insert into emp_master (staff_uid, app_user_id, updated_by) values ($1, $2, $3)
     on conflict (staff_uid) do update set app_user_id = $2, updated_at = now(), updated_by = $3`,
    [staffUid, userId, who],
  );
  await audit(who, staffUid, userId ? "dashboard login linked" : "dashboard login unlinked", { userId });
  return { ok: true };
}

export async function saveDepartment(input: { id?: number; name: string; wing: Wing | null; active?: boolean }, who: string): Promise<Result> {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 50) return { ok: false, error: "A department name is 2 to 50 letters." };
  if (input.wing !== null && !isWing(input.wing)) return { ok: false, error: "Unknown group." };
  try {
    if (input.id) {
      await query(`update department set name = $2, wing = $3, active = coalesce($4, active) where id = $1`, [input.id, name, input.wing, input.active ?? null]);
    } else {
      await query(`insert into department (name, wing, sort) values ($1, $2, coalesce((select max(sort) from department), 0) + 1)`, [name, input.wing]);
    }
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { ok: false, error: "There is already a department with that name." };
    throw e;
  }
  await audit(who, String(input.id ?? name), `department ${input.id ? "saved" : "added"}: ${name}`, input);
  return { ok: true };
}
