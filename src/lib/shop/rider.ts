import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { one, query } from "@/lib/db";

export type PartnerKind = "delivery" | "transporter";

export interface Rider { id: number; name: string; phone: string; active: boolean; lat: number | null; lng: number | null; location_at: Date | null; pay_per_delivery?: number; kind?: PartnerKind; vehicle_no?: string | null }

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

export function pinMatches(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const got = scryptSync(pin, Buffer.from(salt, "hex"), 32);
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

/** A new session for one phone; the partner's other phones stay signed in. */
async function openSession(riderId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await query(`insert into shop_rider_session (token, rider_id) values ($1, $2)`, [token, riderId]);
  return token;
}

/** Phone + PIN -> a new session token for this phone (other phones stay signed in), or null; "wrong-kind" when the PIN
 *  is right but the partner signed in as the other kind (a delivery boy choosing Transporter, or the other way round). */
export async function riderLogin(phone: string, pin: string, kind?: PartnerKind): Promise<{ token: string; rider: Rider } | "wrong-kind" | null> {
  const r = await one<Rider & { pin_hash: string }>(`select * from shop_rider where phone = $1 and active`, [phone]);
  if (!r || !pinMatches(pin, r.pin_hash)) return null;
  if (kind && r.kind !== kind) return "wrong-kind";
  const token = await openSession(r.id);
  const { pin_hash: _p, ...rider } = r;
  return { token, rider };
}

/** Forgot PIN (the number confirmed by SMS): the new PIN signs every phone out, then this phone gets a fresh session. */
export async function riderResetPin(phone: string, pin: string): Promise<{ token: string; rider: Rider } | null> {
  const r = await one<Rider & { pin_hash: string }>(
    `with gone as (delete from shop_rider_session where rider_id in (select id from shop_rider where phone = $1 and active))
     update shop_rider set pin_hash = $2 where phone = $1 and active returning *`,
    [phone, hashPin(pin)],
  );
  if (!r) return null;
  const token = await openSession(r.id);
  const { pin_hash: _p, ...rider } = r;
  return { token, rider };
}

/** A partner creates their own account from the app (the number is already confirmed by SMS). Signed in straight away;
 *  orders still only reach them once the office assigns one. Null when the number already has an account, even a deactivated one. */
export async function riderSignup(name: string, phone: string, pin: string, kind: PartnerKind, vehicleNo: string | null): Promise<{ token: string; rider: Rider } | null> {
  const token = randomBytes(32).toString("hex");
  // the account and this phone's session in one statement
  const rider = await one<Rider>(
    `with r as (
       insert into shop_rider (name, phone, pin_hash, kind, vehicle_no) values ($1, $2, $3, $4, $5)
       on conflict (phone) do nothing
       returning id, name, phone, active, lat, lng, location_at, pay_per_delivery, kind, vehicle_no
     ), s as (insert into shop_rider_session (token, rider_id) select $6, id from r)
     select * from r`,
    [name, phone, hashPin(pin), kind, vehicleNo, token],
  );
  return rider ? { token, rider } : null;
}

export async function riderFromRequest(req: NextRequest): Promise<Rider | null> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!t) return null;
  const r = await one<Rider>(
    `select r.id, r.name, r.phone, r.active, r.lat, r.lng, r.location_at, r.pay_per_delivery, r.kind, r.vehicle_no
       from shop_rider_session s join shop_rider r on r.id = s.rider_id
      where s.token = $1 and r.active`,
    [t],
  );
  // "last seen" at most once an hour - enough to tell live sessions from forgotten phones
  if (r) await query(`update shop_rider_session set last_seen = now() where token = $1 and last_seen < now() - interval '1 hour'`, [t]);
  return r;
}

/** Signs this phone out: its session ends; the partner's other phones stay signed in. */
export async function endRiderSession(req: NextRequest): Promise<void> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (t) await query(`delete from shop_rider_session where token = $1`, [t]);
}
