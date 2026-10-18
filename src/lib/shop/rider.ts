import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { one, query } from "@/lib/db";

export interface Rider { id: number; name: string; phone: string; active: boolean; lat: number | null; lng: number | null; location_at: Date | null }

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

function pinMatches(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const got = scryptSync(pin, Buffer.from(salt, "hex"), 32);
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Phone + PIN -> a fresh session token (replaces any earlier one), or null. */
export async function riderLogin(phone: string, pin: string): Promise<{ token: string; rider: Rider } | null> {
  const r = await one<Rider & { pin_hash: string }>(`select * from shop_rider where phone = $1 and active`, [phone]);
  if (!r || !pinMatches(pin, r.pin_hash)) return null;
  const token = randomBytes(32).toString("hex");
  await query(`update shop_rider set token = $2 where id = $1`, [r.id, token]);
  const { pin_hash: _p, ...rider } = r;
  return { token, rider };
}

export async function riderFromRequest(req: NextRequest): Promise<Rider | null> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!t) return null;
  return one<Rider>(`select id, name, phone, active, lat, lng, location_at from shop_rider where token = $1 and active`, [t]);
}
