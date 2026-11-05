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

/** Phone + PIN -> a fresh session token (replaces any earlier one), or null; "wrong-kind" when the PIN is right
 *  but the partner signed in as the other kind (a delivery boy choosing Transporter, or the other way round). */
export async function riderLogin(phone: string, pin: string, kind?: PartnerKind): Promise<{ token: string; rider: Rider } | "wrong-kind" | null> {
  const r = await one<Rider & { pin_hash: string }>(`select * from shop_rider where phone = $1 and active`, [phone]);
  if (!r || !pinMatches(pin, r.pin_hash)) return null;
  if (kind && r.kind !== kind) return "wrong-kind";
  const token = randomBytes(32).toString("hex");
  await query(`update shop_rider set token = $2 where id = $1`, [r.id, token]);
  const { pin_hash: _p, ...rider } = r;
  return { token, rider };
}

/** A partner creates their own account from the app (the number is already confirmed by SMS). Signed in straight away;
 *  orders still only reach them once the office assigns one. Null when the number already has an account, even a deactivated one. */
export async function riderSignup(name: string, phone: string, pin: string, kind: PartnerKind, vehicleNo: string | null): Promise<{ token: string; rider: Rider } | null> {
  const token = randomBytes(32).toString("hex");
  const rider = await one<Rider>(
    `insert into shop_rider (name, phone, pin_hash, kind, vehicle_no, token) values ($1, $2, $3, $4, $5, $6)
     on conflict (phone) do nothing
     returning id, name, phone, active, lat, lng, location_at, pay_per_delivery, kind, vehicle_no`,
    [name, phone, hashPin(pin), kind, vehicleNo, token],
  );
  return rider ? { token, rider } : null;
}

export async function riderFromRequest(req: NextRequest): Promise<Rider | null> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!t) return null;
  return one<Rider>(`select id, name, phone, active, lat, lng, location_at, pay_per_delivery, kind, vehicle_no from shop_rider where token = $1 and active`, [t]);
}
