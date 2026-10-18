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
 * Phone + 5-digit PIN -> a fresh session token (replaces any earlier one).
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
      `insert into shop_customer (name, phone, pin_hash, token, last_login) values ($1, $2, $3, $4, now())
       on conflict (phone) do nothing returning ${COLS}`,
      [name.slice(0, 80), phone, hashPin(pin), token],
    );
    if (!made) return { ok: false, status: 409, error: "This number already has an account. Please sign in." };
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
  await query(`update shop_customer set token = $2, failed_tries = 0, locked_until = null, last_login = now() where id = $1`, [c.id, token]);
  const { pin_hash: _h, failed_tries: _f, locked: _l, ...customer } = c;
  return { ok: true, token, customer, created: false };
}

export async function customerFromRequest(req: NextRequest): Promise<Customer | null> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!t) return null;
  return one<Customer>(`select ${COLS} from shop_customer where token = $1`, [t]);
}
