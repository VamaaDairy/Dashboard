import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { one, query } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { pinCleared } from "@/lib/pin-guard";
import { hashPin, pinMatches } from "@/lib/shop/rider";

/** The Gaia Salesforce app is the staff app: everything an employee does with the company lives here. */

const IST_TODAY = `(now() at time zone 'Asia/Kolkata')::date`;

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

export const validPoint = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

export function metres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---------------------------------------------------------------- one-time codes

const CODE_TTL_MIN = 10;
const RESEND_AFTER_SEC = 30;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

const hashCode = (phone: string, code: string) =>
  createHmac("sha256", process.env.JWT_SECRET || "dev-secret-change-me").update(`employee:${phone}:${code}`).digest("hex");

const otpText = () =>
  process.env.SMS_OTP_TEXT ?? "Your One Time Password (OTP) is {otp} Please enter this in the App to complete the verification. Regards Team Gaia Fresh";

/** Texts a fresh code to this number, replacing any earlier one. Throttled per number. */
export async function sendEmployeeOtp(phone: string): Promise<Result> {
  const prev = await one<{ wait: number; in_window: number; window_open: boolean }>(
    `select extract(epoch from now() - sent_at)::int as wait, sent_in_window as in_window,
            window_start > now() - interval '1 hour' as window_open
       from emp_otp where phone = $1`,
    [phone],
  );
  if (prev && prev.wait < RESEND_AFTER_SEC) return fail(`Please wait ${RESEND_AFTER_SEC - prev.wait} seconds before asking for another code.`);
  if (prev?.window_open && prev.in_window >= MAX_PER_HOUR) return fail("Too many codes requested. Please try again in an hour.");

  const code = String(randomInt(100000, 1000000));
  await query(
    `insert into emp_otp (phone, code_hash, expires_at) values ($1, $2, now() + make_interval(mins => $3))
     on conflict (phone) do update set
       code_hash = $2, expires_at = excluded.expires_at, attempts = 0, sent_at = now(),
       window_start = case when emp_otp.window_start > now() - interval '1 hour' then emp_otp.window_start else now() end,
       sent_in_window = case when emp_otp.window_start > now() - interval '1 hour' then emp_otp.sent_in_window + 1 else 1 end`,
    [phone, hashCode(phone, code), CODE_TTL_MIN],
  );
  try {
    await sendSms(phone, otpText().replace("{otp}", code));
  } catch (e) {
    console.error("Employee OTP SMS failed:", e);
    return fail("We could not send the SMS right now. Please try again.");
  }
  return { ok: true };
}

/** True when `code` is the live code for this number; the code is used up. Also used by the distributor sign-up and Forgot PIN. */
export const consumeOtp = (phone: string, code: string) => matchEmployeeOtp(phone, code, true);

/** The same check without using the code up: the app confirms the number before it asks for a PIN. */
export const checkEmployeeOtp = (phone: string, code: string) => matchEmployeeOtp(phone, code, false);

async function matchEmployeeOtp(phone: string, code: string, use: boolean): Promise<boolean> {
  const r = await one<{ code_hash: string; attempts: number; expired: boolean }>(
    `select code_hash, attempts, expires_at < now() as expired from emp_otp where phone = $1`,
    [phone],
  );
  if (!r || r.expired || r.attempts >= MAX_ATTEMPTS) return false;
  const given = Buffer.from(hashCode(phone, code));
  const want = Buffer.from(r.code_hash);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    await query(`update emp_otp set attempts = attempts + 1 where phone = $1`, [phone]);
    return false;
  }
  if (use) await query(`update emp_otp set expires_at = now() where phone = $1`, [phone]);
  return true;
}

// ---------------------------------------------------------------- who is signed in

export interface Employee {
  loginId: number;
  staffUid: string;
  name: string;
  phone: string;
  code: string | null;
  designation: string | null;
  department: string | null;
  /** has a sales route / sales designation: gets Route, store visits and orders on behalf of distributors */
  sales: boolean;
}

const EMP_SELECT = `
  select l.id as "loginId", l.staff_uid as "staffUid", l.phone,
         trim(concat_ws(' ', s.first_name, s.last_name)) as name, s.employee_code as code,
         d.designation, d.department,
         (coalesce(d.sales, 0) = 1
          or exists (select 1 from dist_login dl where dl.staff_uid = s.uid and dl.kind = 'salesman' and dl.active)
          or exists (select 1 from fp_beat b where b.staff_uid = s.uid and coalesce(b.status, 1) <> 0)
          or exists (select 1 from fp_staff_beat sb where sb.staff_uid = s.uid and sb.unassigned_date is null and coalesce(sb.status, 1) <> 0)) as sales
    from emp_login l
    join fp_staff s on s.uid = l.staff_uid
    left join fp_designation d on d.uid = s.designation_uid`;

const normPhone = (p: string) => p.replace(/\D/g, "").slice(-10);

export type VerifyOutcome =
  | { ok: true; status: "signed_in"; token: string; employee: Employee }
  | { ok: true; status: "pending" }
  | { ok: false; error: string };

/**
 * Checks the code. A number that belongs to an active employee (a login the office made, or the mobile on the staff
 * record) signs in, and with `newPin` (Forgot PIN) that becomes their PIN. Any other number, when `signup` details
 * are given, becomes a request the office reviews.
 */
export async function verifyEmployee(
  phoneRaw: string,
  code: string,
  signup: { name?: string; email?: string; department?: string } | null,
  device: string | null,
  newPin: string | null = null,
): Promise<VerifyOutcome> {
  const phone = normPhone(phoneRaw);
  if (newPin !== null && !/^\d{4,8}$/.test(newPin)) return fail("The PIN must be 4 to 8 digits.");
  if (!(await consumeOtp(phone, code))) return fail("That code is wrong or has expired. Ask for a new one.");

  // a login the office made for this number, else the mobile saved on an active staff record
  let login = await one<{ id: number; staff_uid: string; active: boolean }>(`select id, staff_uid, active from emp_login where phone = $1`, [phone]);
  if (!login) {
    const staff = await query<{ uid: string }>(
      `select uid from fp_staff where active = 1 and right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = $1`,
      [phone],
    );
    if (staff.length === 1) {
      login = await one(
        `insert into emp_login (staff_uid, phone) values ($1, $2)
         on conflict (staff_uid) do update set phone = excluded.phone returning id, staff_uid, active`,
        [staff[0].uid, phone],
      );
    } else if (staff.length > 1) {
      return fail("This number is on more than one staff record. Please contact HR.");
    }
  }

  if (login) {
    if (newPin) {
      // the new PIN signs every phone out; this one signs straight back in below
      await query(`with gone as (delete from emp_session where login_id = $1) update emp_login set pin_hash = $2 where id = $1`, [login.id, hashPin(newPin)]);
      await pinCleared("emp", phone); // a PIN set with an SMS code ends any wrong-PIN lock
    }
    return signIn(login, device);
  }

  // not an employee on file yet
  const name = (signup?.name ?? "").trim().slice(0, 80);
  if (!name) return fail("This number is not registered. Create an account with your name, and HR will approve it.");
  const email = (signup?.email ?? "").trim().slice(0, 120);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email, or leave it empty.");
  await query(
    `insert into emp_signup (phone, name, email, department) values ($1, $2, $3, $4)
     on conflict (phone) where status = 'pending' do update set name = excluded.name, email = excluded.email, department = excluded.department`,
    [phone, name, email || null, (signup?.department ?? "").trim().slice(0, 80) || null],
  );
  return { ok: true, status: "pending" };
}

/** Signs this phone in with a new session (the employee's other phones stay signed in), if the person is still active. */
async function signIn(login: { id: number; staff_uid: string; active: boolean }, device: string | null): Promise<VerifyOutcome> {
  if (!login.active) return fail("This account is switched off. Please contact HR.");
  const live = await one(`select 1 from fp_staff where uid = $1 and active = 1`, [login.staff_uid]);
  if (!live) return fail("This employee record is not active. Please contact HR.");
  const token = randomBytes(32).toString("hex");
  await query(
    `with s as (insert into emp_session (token, login_id, device) values ($2, $1, $3))
     update emp_login set last_login = now(), device = $3 where id = $1`,
    [login.id, token, device?.slice(0, 120) ?? null],
  );
  const employee = await one<Employee>(`${EMP_SELECT} where l.id = $1`, [login.id]);
  return employee ? { ok: true, status: "signed_in", token, employee } : fail("Could not sign you in.");
}

/**
 * Sign-in with mobile number and PIN: the PIN the employee set (Forgot PIN sets one with an SMS code), or for a
 * sales officer who has not set one, the PIN Gaia gave them for ordering (their sales-officer login).
 */
export async function pinSignIn(phoneRaw: string, pin: string, device: string | null): Promise<VerifyOutcome> {
  const phone = normPhone(phoneRaw);
  const wrong = fail("Wrong number or PIN. Forgot it? Tap Forgot PIN to set a new one.");
  const own = await one<{ id: number; staff_uid: string; active: boolean; pin_hash: string | null }>(`select id, staff_uid, active, pin_hash from emp_login where phone = $1`, [phone]);
  if (own?.pin_hash) return pinMatches(pin, own.pin_hash) ? signIn(own, device) : wrong;

  const so = await one<{ staff_uid: string; pin_hash: string; active: boolean }>(
    `select staff_uid, pin_hash, active from dist_login where phone = $1 and kind = 'salesman' and staff_uid is not null`,
    [phone],
  );
  if (!so) return fail("No PIN is set for this number yet. Tap Forgot PIN to set one with an SMS code.");
  if (!pinMatches(pin, so.pin_hash)) return wrong;
  if (!so.active) return fail("This account is switched off. Please contact HR.");
  // the staff app login for this person; made now if they never signed in before
  const login =
    (own && own.staff_uid === so.staff_uid ? own : null) ??
    (await one<{ id: number; staff_uid: string; active: boolean }>(
      `insert into emp_login (staff_uid, phone) values ($1, $2)
       on conflict (staff_uid) do update set phone = emp_login.phone returning id, staff_uid, active`,
      [so.staff_uid, phone],
    ).catch(() => one<{ id: number; staff_uid: string; active: boolean }>(`select id, staff_uid, active from emp_login where staff_uid = $1`, [so.staff_uid])));
  return login ? signIn(login, device) : fail("Could not sign you in. Tap Forgot PIN to set a PIN with an SMS code.");
}

/** Whether this number has an account request waiting for the office. */
export async function signupPending(phoneRaw: string): Promise<boolean> {
  return !!(await one(`select 1 from emp_signup where phone = $1 and status = 'pending'`, [normPhone(phoneRaw)]));
}

export async function empFromRequest(req: NextRequest): Promise<Employee | null> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!t) return null;
  // read on every call, so switching a person off in the staff master signs their phones out at once
  const e = await one<Employee>(`${EMP_SELECT} join emp_session es on es.login_id = l.id where es.token = $1 and l.active and s.active = 1`, [t]);
  // "last seen" at most once an hour - enough to tell live sessions from forgotten phones
  if (e) await query(`update emp_session set last_seen = now() where token = $1 and last_seen < now() - interval '1 hour'`, [t]);
  return e;
}

/** Signs this phone out: its session ends; the employee's other phones stay signed in. */
export async function endEmpSession(req: NextRequest): Promise<void> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (t) await query(`delete from emp_session where token = $1`, [t]);
}

// ---------------------------------------------------------------- profile

export interface Profile extends Employee {
  email: string | null;
  address: string | null;
  city: string | null;
  joined: string | null;
  dob: string | null;
  manager: string | null;
  managerPhone: string | null;
  employmentType: string | null;
  aadhaarLast4: string | null;
  pan: string | null;
  bloodGroup: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRel: string | null;
  bankName: string | null;
  accountNo: string | null;
  ifsc: string | null;
}

export async function getProfile(e: Employee): Promise<Profile> {
  const r = await one<Omit<Profile, keyof Employee>>(
    `select s.email, nullif(trim(concat_ws(', ', s.address, s.city, s.pincode)), '') as address, s.city,
            to_char(s.date_of_joining at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as joined,
            to_char(s.date_of_birth at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as dob,
            nullif(trim(concat_ws(' ', m.first_name, m.last_name)), '') as manager, m.phone as "managerPhone",
            case s.employment_type when 1 then 'Permanent' when 2 then 'Contract' when 3 then 'Trainee' else null end as "employmentType",
            right(s.aadhar_number, 4) as "aadhaarLast4", s.pan,
            p.blood_group as "bloodGroup", p.emergency_name as "emergencyName", p.emergency_phone as "emergencyPhone", p.emergency_rel as "emergencyRel",
            p.bank_name as "bankName", coalesce(p.account_no, s.account_number) as "accountNo", p.ifsc
       from fp_staff s
       left join fp_staff m on m.uid = s.reporting_manager_uid
       left join emp_profile p on p.staff_uid = s.uid
      where s.uid = $1`,
    [e.staffUid],
  );
  return { ...e, ...r! };
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) || null : null);

export async function saveProfile(staffUid: string, b: Record<string, unknown>): Promise<Result> {
  const ephone = clip(b.emergencyPhone, 15)?.replace(/\D/g, "") ?? null;
  if (ephone && !/^\d{8,12}$/.test(ephone)) return fail("Enter a valid emergency contact number.");
  const ifsc = clip(b.ifsc, 11)?.toUpperCase() ?? null;
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return fail("The IFSC code looks wrong (like HDFC0001234).");
  const acc = clip(b.accountNo, 20)?.replace(/\s/g, "") ?? null;
  if (acc && !/^\d{6,20}$/.test(acc)) return fail("Enter the bank account number with digits only.");
  const photo = typeof b.photo === "string" && b.photo.startsWith("data:image/") && b.photo.length <= 300_000 ? b.photo : null;
  await query(
    `insert into emp_profile (staff_uid, blood_group, emergency_name, emergency_phone, emergency_rel, bank_name, account_no, ifsc, photo)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (staff_uid) do update set blood_group = $2, emergency_name = $3, emergency_phone = $4, emergency_rel = $5,
       bank_name = $6, account_no = $7, ifsc = $8, photo = coalesce($9, emp_profile.photo), updated_at = now()`,
    [staffUid, clip(b.bloodGroup, 5), clip(b.emergencyName, 80), ephone, clip(b.emergencyRel, 40), clip(b.bankName, 80), acc, ifsc, photo],
  );
  return { ok: true };
}

export async function getPhoto(staffUid: string): Promise<string | null> {
  return (await one<{ photo: string | null }>(`select photo from emp_profile where staff_uid = $1`, [staffUid]))?.photo ?? null;
}

// ---------------------------------------------------------------- attendance

export interface PunchInput { lat?: unknown; lng?: unknown; accuracy?: unknown; method?: unknown }
export interface Today {
  date: string;
  inAt: string | null;
  outAt: string | null;
  method: string | null;
  site: string | null;
  /** the day was started from the sales route, so it is closed by ending the sales day */
  salesDay: boolean;
}

const METHODS = ["biometric", "app"] as const;
const methodOf = (m: unknown) => ((METHODS as readonly unknown[]).includes(m) ? (m as "biometric" | "app") : "app");

export async function todayAttendance(staffUid: string): Promise<Today> {
  const r = await one<Today>(
    `select ${IST_TODAY}::text as date, a.in_at as "inAt", a.out_at as "outAt", a.in_method as method, a.in_site as site,
            coalesce(a.in_method = 'sales_day', false) as "salesDay"
       from (select 1) x left join emp_attendance a on a.staff_uid = $1 and a.work_date = ${IST_TODAY}`,
    [staffUid],
  );
  return r!;
}

/** The site (plant, office, depot) the phone is at, when sites are set up. */
async function siteFor(lat: number, lng: number): Promise<{ any: boolean; name: string | null; distance: number | null }> {
  const sites = await query<{ name: string; lat: number; lng: number; radius_m: number }>(`select name, lat, lng, radius_m from emp_site where active`);
  if (!sites.length) return { any: false, name: null, distance: null };
  // the site the phone is closest to (relative to its allowed radius)
  const near = sites
    .map((s) => ({ name: s.name, d: Math.round(metres(lat, lng, s.lat, s.lng)), margin: metres(lat, lng, s.lat, s.lng) - s.radius_m }))
    .sort((a, b) => a.margin - b.margin)[0];
  return { any: true, name: near.margin <= 0 ? near.name : null, distance: near.d };
}

export async function punchIn(e: Employee, input: PunchInput): Promise<Result<{ today: Today }>> {
  if (!validPoint(input.lat, input.lng)) return fail("Turn on your location to punch in.");
  const accuracy = typeof input.accuracy === "number" && input.accuracy >= 0 ? input.accuracy : null;
  if (accuracy !== null && accuracy > 200) return fail(`Your location is not accurate enough (${Math.round(accuracy)} m). Move to an open spot and try again.`);
  const site = await siteFor(input.lat, input.lng as number);
  // field staff punch from wherever they are working; everyone else must be at a Gaia site once sites are set up
  if (!e.sales && site.any && !site.name) {
    return fail(`You are ${site.distance != null && site.distance >= 1000 ? `${(site.distance / 1000).toFixed(1)} km` : `${site.distance} m`} from the nearest Gaia site. Reach your office or plant to punch in.`);
  }
  const r = await query(
    `insert into emp_attendance (staff_uid, work_date, in_lat, in_lng, in_accuracy, in_method, in_site, in_distance)
     values ($1, ${IST_TODAY}, $2, $3, $4, $5, $6, $7) on conflict (staff_uid, work_date) do nothing returning id`,
    [e.staffUid, input.lat, input.lng, accuracy, methodOf(input.method), site.name, site.distance],
  );
  if (!r.length) return fail("You have already punched in today.");
  return { ok: true, today: await todayAttendance(e.staffUid) };
}

export async function punchOut(e: Employee, input: PunchInput): Promise<Result<{ today: Today }>> {
  const here = validPoint(input.lat, input.lng);
  if (e.sales) {
    const on = await one(`select 1 from sf_day where staff_uid = $1 and work_date = ${IST_TODAY} and ended_at is null`, [e.staffUid]);
    if (on) return fail("Your sales day is still on. End your day from the Route tab - that punches you out.");
  }
  const r = await query(
    `update emp_attendance set out_at = now(), out_lat = $2, out_lng = $3, out_method = $4
      where staff_uid = $1 and work_date = ${IST_TODAY} and out_at is null returning id`,
    [e.staffUid, here ? input.lat : null, here ? input.lng : null, methodOf(input.method)],
  );
  if (!r.length) return fail("You have not punched in today, or have already punched out.");
  return { ok: true, today: await todayAttendance(e.staffUid) };
}

export interface AttendanceDay {
  date: string;
  weekday: number;
  status: "present" | "half" | "leave" | "absent" | "off" | "future";
  inAt: string | null;
  outAt: string | null;
  hours: number | null;
  method: string | null;
  site: string | null;
  late: boolean;
}

export interface AttendanceMonth {
  month: string;
  days: AttendanceDay[];
  present: number;
  leave: number;
  absent: number;
  hours: number;
  late: number;
}

/** A person is late when they punch in after this hour (IST). */
const LATE_HOUR = 10;

export async function attendanceMonth(staffUid: string, month: string): Promise<AttendanceMonth> {
  const ym = /^\d{4}-\d{2}$/.test(month) ? month : (await one<{ m: string }>(`select to_char(${IST_TODAY}, 'YYYY-MM') as m`))!.m;
  const days = await query<AttendanceDay>(
    `with d as (select generate_series(($1 || '-01')::date, (($1 || '-01')::date + interval '1 month - 1 day')::date, interval '1 day')::date as day)
     select d.day::text as date, extract(dow from d.day)::int as weekday,
            a.in_at as "inAt", a.out_at as "outAt",
            case when a.out_at is not null then round(extract(epoch from a.out_at - a.in_at) / 3600.0, 2)::float end as hours,
            a.in_method as method, a.in_site as site,
            coalesce(extract(hour from a.in_at at time zone 'Asia/Kolkata') >= ${LATE_HOUR}
                     and extract(minute from a.in_at at time zone 'Asia/Kolkata') + extract(hour from a.in_at at time zone 'Asia/Kolkata') * 60 > ${LATE_HOUR * 60 + 15}, false) as late,
            case
              when d.day > ${IST_TODAY} then 'future'
              when a.id is not null and a.out_at is not null and a.out_at - a.in_at < interval '4 hours' then 'half'
              when a.id is not null then 'present'
              when exists (select 1 from emp_leave l where l.staff_uid = $2 and l.status = 'approved' and d.day between l.from_date and l.to_date) then 'leave'
              when extract(dow from d.day) = 0 then 'off'
              else 'absent'
            end as status
       from d left join emp_attendance a on a.staff_uid = $2 and a.work_date = d.day
      order by d.day`,
    [ym, staffUid],
  );
  const count = (s: AttendanceDay["status"]) => days.filter((x) => x.status === s).length;
  return {
    month: ym,
    days,
    present: count("present") + count("half") * 0.5,
    leave: count("leave"),
    absent: count("absent"),
    hours: Math.round(days.reduce((s, x) => s + (x.hours ?? 0), 0) * 10) / 10,
    late: days.filter((x) => x.late).length,
  };
}

// ---------------------------------------------------------------- leave

export interface LeaveBalance { typeId: number; code: string; name: string; perYear: number; paid: boolean; used: number; pending: number; left: number }
export interface LeaveRow {
  id: number; typeId: number; type: string; from: string; to: string; halfDay: boolean; days: number;
  reason: string; status: string; remark: string | null; decidedBy: string | null; createdAt: string;
}

export async function leaveBalances(staffUid: string): Promise<LeaveBalance[]> {
  return query<LeaveBalance>(
    `select t.id as "typeId", t.code, t.name, t.per_year::float as "perYear", t.paid,
            coalesce(sum(l.days) filter (where l.status = 'approved'), 0)::float as used,
            coalesce(sum(l.days) filter (where l.status = 'pending'), 0)::float as pending,
            greatest(t.per_year - coalesce(sum(l.days) filter (where l.status in ('approved', 'pending')), 0), 0)::float as left
       from emp_leave_type t
       left join emp_leave l on l.type_id = t.id and l.staff_uid = $1 and extract(year from l.from_date) = extract(year from ${IST_TODAY})
      where t.active group by t.id order by t.id`,
    [staffUid],
  );
}

export async function listLeaves(staffUid: string): Promise<LeaveRow[]> {
  return query<LeaveRow>(
    `select l.id, l.type_id as "typeId", t.name as type, l.from_date::text as "from", l.to_date::text as "to", l.half_day as "halfDay", l.days::float as days,
            l.reason, l.status, l.remark, l.decided_by as "decidedBy", l.created_at as "createdAt"
       from emp_leave l join emp_leave_type t on t.id = l.type_id where l.staff_uid = $1 order by l.created_at desc limit 100`,
    [staffUid],
  );
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export async function applyLeave(staffUid: string, b: Record<string, unknown>): Promise<Result<{ id: number }>> {
  if (!Number.isInteger(b.typeId) || !isDate(b.from) || !isDate(b.to)) return fail("Choose the leave type and the dates.");
  const reason = clip(b.reason, 300);
  if (!reason) return fail("Tell us the reason for the leave.");
  const half = b.halfDay === true;
  if (b.to < b.from) return fail("The last day cannot be before the first day.");
  if (half && b.to !== b.from) return fail("A half day is for a single date.");
  const t = await one<{ per_year: number; name: string }>(`select per_year::float, name from emp_leave_type where id = $1 and active`, [b.typeId]);
  if (!t) return fail("Unknown leave type.");
  const past = await one<{ old: boolean }>(`select $1::date < ${IST_TODAY} - 30 as old`, [b.from]);
  if (past?.old) return fail("Leave older than 30 days cannot be applied for. Send a request to HR instead.");
  // Sundays are not counted
  const d = await one<{ days: number }>(
    `select count(*)::float as days from generate_series($1::date, $2::date, interval '1 day') g where extract(dow from g) <> 0`,
    [b.from, b.to],
  );
  const days = half ? 0.5 : d!.days;
  if (days <= 0) return fail("These dates are only Sundays - no leave is needed.");
  const clash = await one(
    `select 1 from emp_leave where staff_uid = $1 and status in ('pending', 'approved') and from_date <= $3 and to_date >= $2`,
    [staffUid, b.from, b.to],
  );
  if (clash) return fail("You already have leave on some of these dates.");
  if (t.per_year > 0) {
    const bal = (await leaveBalances(staffUid)).find((x) => x.typeId === b.typeId);
    if (bal && days > bal.left) return fail(`You have ${bal.left} day${bal.left === 1 ? "" : "s"} of ${t.name} left. Apply for leave without pay, or fewer days.`);
  }
  const r = await one<{ id: number }>(
    `insert into emp_leave (staff_uid, type_id, from_date, to_date, half_day, days, reason) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [staffUid, b.typeId, b.from, b.to, half, days, reason],
  );
  return { ok: true, id: r!.id };
}

export async function cancelLeave(staffUid: string, id: number): Promise<Result> {
  const r = await query(
    `update emp_leave set status = 'cancelled' where id = $1 and staff_uid = $2
        and (status = 'pending' or (status = 'approved' and from_date > ${IST_TODAY})) returning id`,
    [id, staffUid],
  );
  return r.length ? { ok: true } : fail("This leave can no longer be cancelled.");
}

// ---------------------------------------------------------------- reimbursements

export const CLAIM_CATEGORIES = ["travel", "fuel", "food", "stay", "mobile", "client", "other"] as const;
export interface ClaimRow {
  id: number; category: string; amount: number; spentOn: string; description: string; status: string;
  approvedAmount: number | null; remark: string | null; hasReceipt: boolean; createdAt: string; paidAt: string | null;
}

export async function listClaims(staffUid: string): Promise<ClaimRow[]> {
  return query<ClaimRow>(
    `select id, category, amount::float as amount, spent_on::text as "spentOn", description, status, approved_amount::float as "approvedAmount",
            remark, receipt is not null as "hasReceipt", created_at as "createdAt", paid_at as "paidAt"
       from emp_claim where staff_uid = $1 order by created_at desc limit 100`,
    [staffUid],
  );
}

export async function claimReceipt(staffUid: string, id: number): Promise<string | null> {
  return (await one<{ receipt: string | null }>(`select receipt from emp_claim where id = $1 and staff_uid = $2`, [id, staffUid]))?.receipt ?? null;
}

export async function submitClaim(staffUid: string, b: Record<string, unknown>): Promise<Result<{ id: number }>> {
  const category = String(b.category ?? "");
  if (!(CLAIM_CATEGORIES as readonly string[]).includes(category)) return fail("Choose what the expense was for.");
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 500_000) return fail("Enter the amount you spent.");
  if (!isDate(b.spentOn)) return fail("Choose the date you spent it.");
  const when = await one<{ future: boolean; old: boolean }>(`select $1::date > ${IST_TODAY} as future, $1::date < ${IST_TODAY} - 90 as old`, [b.spentOn]);
  if (when?.future) return fail("The expense date cannot be in the future.");
  if (when?.old) return fail("Bills older than 90 days cannot be claimed in the app. Send a request to HR.");
  const description = clip(b.description, 300);
  if (!description) return fail("Add a short description.");
  const receipt = typeof b.receipt === "string" && b.receipt.startsWith("data:image/") && b.receipt.length <= 900_000 ? b.receipt : null;
  if (b.receipt && !receipt) return fail("The bill photo is too large. Take it again.");
  if (amount >= 500 && !receipt) return fail("Attach a photo of the bill for claims of ₹500 or more.");
  const r = await one<{ id: number }>(
    `insert into emp_claim (staff_uid, category, amount, spent_on, description, receipt) values ($1, $2, $3, $4, $5, $6) returning id`,
    [staffUid, category, Math.round(amount * 100) / 100, b.spentOn, description, receipt],
  );
  return { ok: true, id: r!.id };
}

export async function withdrawClaim(staffUid: string, id: number): Promise<Result> {
  const r = await query(`delete from emp_claim where id = $1 and staff_uid = $2 and status = 'pending' returning id`, [id, staffUid]);
  return r.length ? { ok: true } : fail("Only a claim that is still pending can be withdrawn.");
}

// ---------------------------------------------------------------- notices from the office

export interface NoticeRow { id: number; title: string; body: string; kind: string; pinned: boolean; personal: boolean; createdAt: string; read: boolean; by: string | null }

const NOTICE_FOR = `(n.audience = 'all' or (n.audience = 'sales' and $2::boolean) or (n.audience = 'staff' and n.staff_uid = $1))`;

export async function listNotices(e: Employee): Promise<{ notices: NoticeRow[]; unread: number }> {
  const notices = await query<NoticeRow>(
    `select n.id, n.title, n.body, n.kind, n.pinned, n.audience = 'staff' as personal, n.created_at as "createdAt",
            r.notice_id is not null as read, n.created_by as by
       from emp_notice n left join emp_notice_read r on r.notice_id = n.id and r.staff_uid = $1
      where ${NOTICE_FOR} order by n.pinned desc, n.created_at desc limit 100`,
    [e.staffUid, e.sales],
  );
  return { notices, unread: notices.filter((n) => !n.read).length };
}

export async function unreadCount(e: Employee): Promise<number> {
  const r = await one<{ n: number }>(
    `select count(*)::int as n from emp_notice n
      where ${NOTICE_FOR} and not exists (select 1 from emp_notice_read r where r.notice_id = n.id and r.staff_uid = $1)`,
    [e.staffUid, e.sales],
  );
  return r?.n ?? 0;
}

export async function markNoticeRead(e: Employee, id: number) {
  await query(
    `insert into emp_notice_read (notice_id, staff_uid)
     select n.id, $1 from emp_notice n where n.id = $3 and ${NOTICE_FOR} on conflict do nothing`,
    [e.staffUid, e.sales, id],
  );
}

export async function markAllNoticesRead(e: Employee) {
  await query(
    `insert into emp_notice_read (notice_id, staff_uid) select n.id, $1 from emp_notice n where ${NOTICE_FOR} on conflict do nothing`,
    [e.staffUid, e.sales],
  );
}

// ---------------------------------------------------------------- salary slips

export interface PayLine { label: string; amount: number }
export interface PayslipRow {
  id: number; month: string; daysInMonth: number | null; daysPaid: number | null; earnings: PayLine[]; deductions: PayLine[];
  gross: number; totalDeductions: number; net: number; note: string | null;
}

export async function listPayslips(staffUid: string): Promise<PayslipRow[]> {
  return query<PayslipRow>(
    `select id, month::text as month, days_in_month::float as "daysInMonth", days_paid::float as "daysPaid", earnings, deductions,
            gross::float as gross, total_deductions::float as "totalDeductions", net::float as net, note
       from emp_payslip where staff_uid = $1 and published order by month desc limit 36`,
    [staffUid],
  );
}

// ---------------------------------------------------------------- requests to the office

export const REQUEST_KINDS = ["hr", "document", "advance", "id_card", "it", "grievance", "other"] as const;
export interface RequestRow { id: number; kind: string; subject: string; message: string; status: string; reply: string | null; repliedAt: string | null; createdAt: string }

export async function listRequests(staffUid: string): Promise<RequestRow[]> {
  return query<RequestRow>(
    `select id, kind, subject, message, status, reply, replied_at as "repliedAt", created_at as "createdAt"
       from emp_request where staff_uid = $1 order by created_at desc limit 100`,
    [staffUid],
  );
}

export async function sendRequest(staffUid: string, b: Record<string, unknown>): Promise<Result<{ id: number }>> {
  const kind = String(b.kind ?? "");
  if (!(REQUEST_KINDS as readonly string[]).includes(kind)) return fail("Choose what this is about.");
  const subject = clip(b.subject, 120), message = clip(b.message, 1500);
  if (!subject || !message) return fail("Add a subject and your message.");
  const recent = await one<{ n: number }>(`select count(*)::int as n from emp_request where staff_uid = $1 and created_at > now() - interval '1 hour'`, [staffUid]);
  if ((recent?.n ?? 0) >= 10) return fail("You have sent many requests in the last hour. Please wait a little.");
  const r = await one<{ id: number }>(`insert into emp_request (staff_uid, kind, subject, message) values ($1, $2, $3, $4) returning id`, [staffUid, kind, subject, message]);
  return { ok: true, id: r!.id };
}

// ---------------------------------------------------------------- home summary

export async function homeSummary(e: Employee) {
  const [today, unread, balances, month, pendingClaims, latestPayslip] = await Promise.all([
    todayAttendance(e.staffUid),
    unreadCount(e),
    leaveBalances(e.staffUid),
    attendanceMonth(e.staffUid, ""),
    one<{ n: number; amount: number }>(`select count(*)::int as n, coalesce(sum(amount), 0)::float as amount from emp_claim where staff_uid = $1 and status in ('pending', 'approved')`, [e.staffUid]),
    one<{ month: string; net: number }>(`select month::text as month, net::float as net from emp_payslip where staff_uid = $1 and published order by month desc limit 1`, [e.staffUid]),
  ]);
  const birthdays = await query<{ name: string; on: string }>(
    `select trim(concat_ws(' ', first_name, last_name)) as name, to_char(date_of_birth, 'DD Mon') as "on"
       from fp_staff where active = 1 and date_of_birth is not null
        and to_char(date_of_birth at time zone 'Asia/Kolkata', 'MM-DD') = to_char(${IST_TODAY}, 'MM-DD') and uid <> $1 limit 8`,
    [e.staffUid],
  );
  return {
    today, unread, month: { present: month.present, leave: month.leave, absent: month.absent, late: month.late, hours: month.hours },
    leaveLeft: balances.filter((b) => b.perYear > 0).map((b) => ({ code: b.code, left: b.left })),
    claims: pendingClaims, latestPayslip, birthdays,
  };
}
