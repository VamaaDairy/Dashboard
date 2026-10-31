import "server-only";
import type { NextRequest } from "next/server";
import { one, query } from "@/lib/db";
import { distFromRequest, distLogin, type DistLogin } from "@/lib/distributor";
import { empFromRequest } from "@/lib/employee";

/** A check-in is allowed (and the visit counts as physically verified) only this close to the store's saved location. */
export const VISIT_RADIUS_M = 250;
/** A fix less accurate than this (metres) is not trusted for a check-in. */
export const MAX_ACCURACY_M = 200;
export const MAX_PINGS = 100;

const IST_TODAY = `(now() at time zone 'Asia/Kolkata')::date`;

export type SfLogin = DistLogin & { staffUid: string };

/** Sales officers sign in here with the phone + PIN the office issued (login kind 'salesman'). */
export const sfLogin = (phone: string, pin: string) => distLogin(phone, pin, "salesman");

/**
 * The sales officer behind a request: an employee signed in with a mobile code who is on the sales side (sales designation
 * or a route assigned), or - for older app builds - a sales login with a PIN. Orders are booked as this login.
 */
export async function sfFromRequest(req: NextRequest): Promise<SfLogin | null> {
  const e = await empFromRequest(req);
  if (e) return e.sales ? { id: 0, kind: "salesman", firmUid: null, staffUid: e.staffUid, name: e.name, phone: e.phone } : null;
  const l = await distFromRequest(req, "salesman");
  return l?.staffUid ? (l as SfLogin) : null;
}

/** Metres between two points. */
export function metres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const validPoint = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

// ---------------------------------------------------------------- the fixed route

export interface SfStore {
  uid: string;
  name: string;
  code: string;
  channel: string | null;
  address: string | null;
  area: string | null;
  city: string | null;
  phone: string | null;
  contact: string | null;
  lat: number | null;
  lng: number | null;
  /** the distributor above this store when it is not one itself (orders are booked for distributors) */
  parentUid: string | null;
  parentName: string | null;
  /** today's visit to it: none yet, in progress or done */
  visit: { id: number; status: "open" | "done"; outcome: string | null; verified: boolean } | null;
}

export interface SfBeat {
  uid: string;
  name: string;
  code: string;
  /** the weekday the route is walked on, as set on the beat; null when it is every day */
  day: string | null;
  today: boolean;
  startTime: string | null;
  endTime: string | null;
  stores: SfStore[];
}

export interface SfOpenVisit {
  id: number;
  firmUid: string;
  firmName: string;
  checkInAt: string;
  verified: boolean;
  distanceM: number | null;
}

export interface SfDay {
  date: string;
  startedAt: string | null;
  endedAt: string | null;
  visits: number;
  verified: number;
  orders: number;
  orderValue: number;
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Whether a beat's day-of-visit text ("Monday", "MON", "Mon, Thu") includes this weekday; a beat with no day is walked every day. */
function walkedOn(day: string | null, weekday: number): boolean {
  const d = (day ?? "").toLowerCase().trim();
  if (!d) return true;
  return d.split(/[^a-z]+/).filter(Boolean).some((p) => p.slice(0, 3) === DAYS[weekday]);
}

/** Today's date (IST) as yyyy-mm-dd, and its weekday 0-6. */
async function istToday(): Promise<{ date: string; weekday: number }> {
  const r = await one<{ date: string; weekday: number }>(`select ${IST_TODAY}::text as date, extract(dow from ${IST_TODAY})::int as weekday`);
  return r!;
}

/** The officer's fixed route: every beat assigned to them with its stores, today's beats flagged, and where today's visits stand. */
export async function routePlan(staffUid: string) {
  const { date, weekday } = await istToday();
  const beats = await query<{ uid: string; name: string; code: string; day: string | null; startTime: string | null; endTime: string | null }>(
    `select b.uid, b.beat_name as name, b.beat_code as code, nullif(trim(b.day_of_visit), '') as day,
            b.start_time as "startTime", b.end_time as "endTime"
       from fp_beat b
      where coalesce(b.status, 1) <> 0
        and (b.staff_uid = $1 or exists (
              select 1 from fp_staff_beat sb
               where sb.beat_uid = b.uid and sb.staff_uid = $1 and sb.unassigned_date is null and coalesce(sb.status, 1) <> 0))
      order by b.beat_name`,
    [staffUid],
  );
  const stores = beats.length
    ? await query<Omit<SfStore, "visit"> & { beatUid: string }>(
        `select f.uid, f.name, f.firm_code as code, ch.channel, f.address, f.place as area, f.city, f.phone, f.contact_person as contact,
                f.latitude as lat, f.longitude as lng, f.beat_uid as "beatUid",
                case when ch.level <= 3 then null else f.parent_firm_uid end as "parentUid",
                case when ch.level <= 3 then null else p.name end as "parentName"
           from fp_firm f
           left join fp_channel ch on ch.uid = f.channel_uid
           left join fp_firm p on p.uid = f.parent_firm_uid
          where f.beat_uid = any($1) and f.active = 1
          order by f.name`,
        [beats.map((b) => b.uid)],
      )
    : [];
  const visits = await query<{ id: number; firmUid: string; open: boolean; outcome: string | null; verified: boolean }>(
    `select id, firm_uid as "firmUid", check_out_at is null as open, outcome, verified
       from sf_visit where staff_uid = $1 and work_date = $2 order by check_in_at`,
    [staffUid, date],
  );
  // the latest visit to each store today wins
  const latest = new Map(visits.map((v) => [v.firmUid, v]));
  return {
    date,
    beats: beats.map<SfBeat>((b) => ({
      ...b,
      today: walkedOn(b.day, weekday),
      stores: stores
        .filter((s) => s.beatUid === b.uid)
        .map(({ beatUid: _beat, ...s }) => {
          const v = latest.get(s.uid);
          return { ...s, visit: v ? { id: v.id, status: v.open ? ("open" as const) : ("done" as const), outcome: v.outcome, verified: v.verified } : null };
        }),
    })),
  };
}

// ---------------------------------------------------------------- the working day

export async function dayStatus(staffUid: string): Promise<{ day: SfDay; open: SfOpenVisit | null }> {
  const { date } = await istToday();
  const day = await one<SfDay>(
    `select $2::text as date, d.started_at as "startedAt", d.ended_at as "endedAt",
            (select count(*)::int from sf_visit v where v.staff_uid = $1 and v.work_date = $2) as visits,
            (select count(*)::int from sf_visit v where v.staff_uid = $1 and v.work_date = $2 and v.verified) as verified,
            (select count(*)::int from fp_booking_order o join sf_visit v on v.id = o.sf_visit_id where v.staff_uid = $1 and v.work_date = $2) as orders,
            (select coalesce(sum(o.total_cost), 0)::float from fp_booking_order o join sf_visit v on v.id = o.sf_visit_id where v.staff_uid = $1 and v.work_date = $2) as "orderValue"
       from (select 1) x left join sf_day d on d.staff_uid = $1 and d.work_date = $2`,
    [staffUid, date],
  );
  const open = await one<SfOpenVisit>(
    `select v.id, v.firm_uid as "firmUid", f.name as "firmName", v.check_in_at as "checkInAt", v.verified, v.distance_m as "distanceM"
       from sf_visit v join fp_firm f on f.uid = v.firm_uid where v.staff_uid = $1 and v.check_out_at is null`,
    [staffUid],
  );
  return { day: day!, open };
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function startDay(staffUid: string, lat: unknown, lng: unknown): Promise<Result> {
  if (!validPoint(lat, lng)) return { ok: false, error: "Turn on your location to start the day." };
  const { date } = await istToday();
  const r = await query(
    `insert into sf_day (staff_uid, work_date, start_lat, start_lng) values ($1, $2, $3, $4)
     on conflict (staff_uid, work_date) do nothing returning id`,
    [staffUid, date, lat, lng],
  );
  if (!r.length) {
    // already started today: fine, unless it was ended
    const d = await one<{ ended: boolean }>(`select ended_at is not null as ended from sf_day where staff_uid = $1 and work_date = $2`, [staffUid, date]);
    if (d?.ended) return { ok: false, error: "Your day has already ended." };
  }
  // starting the sales day is also the attendance punch-in (unless already punched in)
  await query(
    `insert into emp_attendance (staff_uid, work_date, in_lat, in_lng, in_method) values ($1, $2, $3, $4, 'sales_day')
     on conflict (staff_uid, work_date) do nothing`,
    [staffUid, date, lat, lng],
  );
  return { ok: true };
}

export async function endDay(staffUid: string, lat: unknown, lng: unknown): Promise<Result> {
  const { date } = await istToday();
  const open = await one(`select 1 from sf_visit where staff_uid = $1 and check_out_at is null`, [staffUid]);
  if (open) return { ok: false, error: "Check out of the store you are at before ending the day." };
  const here = validPoint(lat, lng);
  const r = await query(
    `update sf_day set ended_at = now(), end_lat = $3, end_lng = $4 where staff_uid = $1 and work_date = $2 and ended_at is null returning id`,
    [staffUid, date, here ? lat : null, here ? lng : null],
  );
  if (!r.length) return { ok: false, error: "Your day is not started, or has already ended." };
  // ... and ending it is the punch-out
  await query(
    `update emp_attendance set out_at = now(), out_lat = $3, out_lng = $4, out_method = 'sales_day'
      where staff_uid = $1 and work_date = $2 and out_at is null`,
    [staffUid, date, here ? lat : null, here ? lng : null],
  );
  return { ok: true };
}

// ---------------------------------------------------------------- store visits

export async function checkIn(
  login: SfLogin,
  input: { firmUid: string; lat: unknown; lng: unknown; accuracy?: unknown },
): Promise<Result<{ visitId: number; distanceM: number | null; verified: boolean }>> {
  const { lat, lng } = input;
  if (!validPoint(lat, lng)) return { ok: false, error: "Could not read your location. Turn on GPS and try again." };
  const accuracy = typeof input.accuracy === "number" && input.accuracy >= 0 ? input.accuracy : null;
  if (accuracy !== null && accuracy > MAX_ACCURACY_M) {
    return { ok: false, error: `Your location is not accurate enough (${Math.round(accuracy)} m). Move to an open spot and try again.` };
  }

  const { date } = await istToday();
  const day = await one<{ ended: boolean }>(`select ended_at is not null as ended from sf_day where staff_uid = $1 and work_date = $2`, [login.staffUid, date]);
  if (!day) return { ok: false, error: "Start your day first." };
  if (day.ended) return { ok: false, error: "Your day has ended." };

  const store = await one<{ name: string; lat: number | null; lng: number | null; beatUid: string | null }>(
    `select name, latitude as lat, longitude as lng, beat_uid as "beatUid" from fp_firm where uid = $1 and active = 1`,
    [input.firmUid],
  );
  if (!store) return { ok: false, error: "This store is not available." };

  const distance = store.lat != null && store.lng != null ? Math.round(metres(lat, input.lng as number, store.lat, store.lng)) : null;
  if (distance !== null && distance > VISIT_RADIUS_M) {
    const far = distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`;
    return { ok: false, error: `You are ${far} from ${store.name}. Reach the store to check in (within ${VISIT_RADIUS_M} m).` };
  }
  const plan = await routePlan(login.staffUid);
  const onRoute = plan.beats.some((b) => b.today && b.stores.some((s) => s.uid === input.firmUid));

  try {
    const v = await one<{ id: number }>(
      `insert into sf_visit (staff_uid, firm_uid, beat_uid, work_date, on_route, in_lat, in_lng, in_accuracy, distance_m, verified)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [login.staffUid, input.firmUid, store.beatUid, date, onRoute, lat, input.lng, accuracy, distance, distance !== null],
    );
    return { ok: true, visitId: v!.id, distanceM: distance, verified: distance !== null };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { ok: false, error: "You are already checked in at a store. Check out first." };
    throw e;
  }
}

const OUTCOMES = ["order", "no_order", "shop_closed", "follow_up"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const isOutcome = (v: unknown): v is Outcome => (OUTCOMES as readonly unknown[]).includes(v);

export async function checkOut(
  login: SfLogin,
  input: { visitId: number; lat: unknown; lng: unknown; outcome: Outcome; notes?: string | null },
): Promise<Result> {
  const notes = (input.notes ?? "").trim().slice(0, 500) || null;
  // an "order" outcome needs an order booked during this visit
  if (input.outcome === "order") {
    const has = await one(`select 1 from fp_booking_order where sf_visit_id = $1`, [input.visitId]);
    if (!has) return { ok: false, error: "No order was booked in this visit. Pick another outcome, or place the order." };
  }
  const here = validPoint(input.lat, input.lng);
  const r = await query(
    `update sf_visit set check_out_at = now(), out_lat = $3, out_lng = $4, outcome = $5, notes = $6
      where id = $1 and staff_uid = $2 and check_out_at is null returning id`,
    [input.visitId, login.staffUid, here ? input.lat : null, here ? input.lng : null, input.outcome, notes],
  );
  return r.length ? { ok: true } : { ok: false, error: "This visit is not open." };
}

/** Whether a visit is this officer's own and still open: the only kind an order can be booked in. */
export async function ownsOpenVisit(staffUid: string, visitId: number): Promise<boolean> {
  return !!(await one(`select 1 from sf_visit where id = $1 and staff_uid = $2 and check_out_at is null`, [visitId, staffUid]));
}

// ---------------------------------------------------------------- location trail

export interface Ping { lat: number; lng: number; accuracy?: number; speed?: number; battery?: number; at: string }

/** Stores a batch of location fixes (the phone queues them while offline). Only while the day is on; fixes from the future or days old are dropped. */
export async function savePings(staffUid: string, pings: Ping[]): Promise<number> {
  const { date } = await istToday();
  const on = await one(`select 1 from sf_day where staff_uid = $1 and work_date = $2 and ended_at is null`, [staffUid, date]);
  if (!on) return 0;
  const good = pings.filter((p) => validPoint(p.lat, p.lng) && Number.isFinite(Date.parse(p.at))).slice(0, MAX_PINGS);
  if (!good.length) return 0;
  const rows = await query(
    `insert into sf_location (staff_uid, lat, lng, accuracy, speed, battery, recorded_at)
     select $1, x.lat, x.lng, x.accuracy, x.speed, x.battery, x.at
       from jsonb_to_recordset($2::jsonb) as x(lat float8, lng float8, accuracy real, speed real, battery smallint, at timestamptz)
      where x.at <= now() + interval '5 minutes' and x.at > now() - interval '2 days'
     returning 1`,
    [staffUid, JSON.stringify(good)],
  );
  return rows.length;
}

// ---------------------------------------------------------------- activity (the officer's own recent days)

export interface SfDayLog extends SfDay { km: number; firstPing: string | null; lastPing: string | null }

export async function activity(staffUid: string, days: number): Promise<SfDayLog[]> {
  const n = Math.min(Math.max(Math.floor(days) || 7, 1), 31);
  return query<SfDayLog>(
    `with d as (select generate_series(${IST_TODAY} - ($2::int - 1), ${IST_TODAY}, interval '1 day')::date as day),
     trail as (
       select (recorded_at at time zone 'Asia/Kolkata')::date as day, recorded_at, lat, lng,
              lag(lat) over w as plat, lag(lng) over w as plng
         from sf_location where staff_uid = $1 and (accuracy is null or accuracy <= 100)
         window w as (partition by (recorded_at at time zone 'Asia/Kolkata')::date order by recorded_at)
     )
     select d.day::text as date, sd.started_at as "startedAt", sd.ended_at as "endedAt",
            (select count(*)::int from sf_visit v where v.staff_uid = $1 and v.work_date = d.day) as visits,
            (select count(*)::int from sf_visit v where v.staff_uid = $1 and v.work_date = d.day and v.verified) as verified,
            (select count(*)::int from fp_booking_order o join sf_visit v on v.id = o.sf_visit_id where v.staff_uid = $1 and v.work_date = d.day) as orders,
            (select coalesce(sum(o.total_cost), 0)::float from fp_booking_order o join sf_visit v on v.id = o.sf_visit_id where v.staff_uid = $1 and v.work_date = d.day) as "orderValue",
            coalesce((select sum(2 * 6371 * asin(sqrt(least(1, sin(radians(t.lat - t.plat) / 2) ^ 2
                      + cos(radians(t.plat)) * cos(radians(t.lat)) * sin(radians(t.lng - t.plng) / 2) ^ 2))))
                      from trail t where t.day = d.day and t.plat is not null), 0)::float as km,
            (select min(recorded_at) from trail t where t.day = d.day) as "firstPing",
            (select max(recorded_at) from trail t where t.day = d.day) as "lastPing"
       from d left join sf_day sd on sd.staff_uid = $1 and sd.work_date = d.day
      order by d.day desc`,
    [staffUid, n],
  );
}
