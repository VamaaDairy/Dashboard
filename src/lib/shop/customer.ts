import "server-only";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { one, query } from "@/lib/db";
import { hashPin, pinMatches } from "./rider";

export interface Customer {
  id: number;
  name: string;
  phone: string;
  /** Where they last ordered to - pre-fills checkout. */
  address: string | null;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
}

const COLS = `id, name, phone, address, pincode, lat, lng`;

/** What the app is told about the signed-in customer. */
export const customerJson = (c: Customer) => ({ name: c.name, phone: c.phone, address: c.address, pincode: c.pincode, lat: c.lat, lng: c.lng });

const MAX_TRIES = 5;
const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; token: string; customer: Customer; created: boolean }
  | { ok: false; status: number; error: string };

/**
 * Phone + 5-digit PIN -> a new session token for this phone. Other phones stay signed in;
 * a session lasts until the customer signs out on that phone.
 * mode "signup" creates the account (name needed) and refuses a number that already has one;
 * mode "signin" refuses a number with no account. Without a mode (older apps) an unknown
 * number is registered with the PIN it first signs in with.
 */
export async function customerLogin(phone: string, pin: string, name: string, mode?: "signin" | "signup"): Promise<LoginResult> {
  const c = await one<Customer & { pin_hash: string; failed_tries: number; locked: boolean }>(
    `select ${COLS}, pin_hash, failed_tries, coalesce(locked_until > now(), false) as locked from shop_customer where phone = $1`,
    [phone],
  );
  const token = randomBytes(32).toString("hex");

  if (c && mode === "signup") return { ok: false, status: 409, error: "This number already has an account. Please sign in." };
  if (!c && mode === "signin") return { ok: false, status: 404, error: "No account with this number yet. Create one to continue." };

  if (!c) {
    if (name.length < 2) return { ok: false, status: 400, error: "Enter your name to create your account." };
    const made = await one<Customer>(
      `insert into shop_customer (name, phone, pin_hash, last_login) values ($1, $2, $3, now())
       on conflict (phone) do nothing returning ${COLS}`,
      [name.slice(0, 80), phone, hashPin(pin)],
    );
    if (!made) return { ok: false, status: 409, error: "This number already has an account. Please sign in." };
    await query(`insert into shop_customer_session (token, customer_id) values ($1, $2)`, [token, made.id]);
    // orders placed with this number before the account existed are theirs
    await query(`update shop_order set customer_id = $1 where customer_id is null and phone = $2`, [made.id, phone]);
    return { ok: true, token, customer: made, created: true };
  }

  if (c.locked) return { ok: false, status: 429, error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.` };
  if (!pinMatches(pin, c.pin_hash)) {
    await query(
      `update shop_customer set
         locked_until = case when failed_tries + 1 >= $2 then now() + make_interval(mins => $3) end,
         failed_tries = case when failed_tries + 1 >= $2 then 0 else failed_tries + 1 end
       where id = $1`,
      [c.id, MAX_TRIES, LOCK_MINUTES],
    );
    return { ok: false, status: 401, error: "Wrong PIN for this number." };
  }
  await query(`update shop_customer set failed_tries = 0, locked_until = null, last_login = now() where id = $1`, [c.id]);
  await query(`insert into shop_customer_session (token, customer_id) values ($1, $2)`, [token, c.id]);
  const { pin_hash: _h, failed_tries: _f, locked: _l, ...customer } = c;
  return { ok: true, token, customer, created: false };
}

export type ProfileChange = { name?: string; address?: string; pincode?: string | null; lat?: number | null; lng?: number | null };

/** Checks a profile change from the app; null fields are left as they are. */
export function parseProfile(body: unknown): { ok: true; change: ProfileChange } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const change: ProfileChange = {};
  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < 2 || name.length > 80) return { ok: false, error: "Enter your name (2 to 80 letters)." };
    change.name = name;
  }
  if (b.address !== undefined) {
    const address = typeof b.address === "string" ? b.address.trim() : "";
    if (address.length < 5 || address.length > 300) return { ok: false, error: "Enter a full delivery address." };
    const pin = typeof b.pincode === "string" ? b.pincode.trim() : "";
    if (pin && !/^\d{6}$/.test(pin)) return { ok: false, error: "Pincode must be 6 digits." };
    const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
    Object.assign(change, { address, pincode: pin || null, lat: num(b.lat, -90, 90), lng: num(b.lng, -180, 180) });
  }
  if (change.name === undefined && change.address === undefined) return { ok: false, error: "Nothing to change." };
  return { ok: true, change };
}

/** Saves the customer's name and/or delivery address. */
export async function updateProfile(id: number, ch: ProfileChange): Promise<Customer> {
  const c = await one<Customer>(
    `update shop_customer set
       name = coalesce($2, name),
       address = case when $3::boolean then $4 else address end,
       pincode = case when $3::boolean then $5 else pincode end,
       lat = case when $3::boolean then $6 else lat end,
       lng = case when $3::boolean then $7 else lng end
     where id = $1 returning ${COLS}`,
    [id, ch.name ?? null, ch.address !== undefined, ch.address ?? null, ch.pincode ?? null, ch.lat ?? null, ch.lng ?? null],
  );
  return c!;
}

export async function customerFromRequest(req: NextRequest): Promise<Customer | null> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!t) return null;
  const c = await one<Customer>(
    `select ${COLS.split(", ").map((x) => `c.${x}`).join(", ")} from shop_customer_session s join shop_customer c on c.id = s.customer_id where s.token = $1`,
    [t],
  );
  // "last seen" at most once an hour - enough to tell live sessions from forgotten phones
  if (c) await query(`update shop_customer_session set last_seen = now() where token = $1 and last_seen < now() - interval '1 hour'`, [t]);
  return c;
}

/** Signs this phone out: its session ends; the customer's other phones stay signed in. */
export async function endSession(req: NextRequest): Promise<void> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (t) await query(`delete from shop_customer_session where token = $1`, [t]);
}
