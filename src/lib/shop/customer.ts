import "server-only";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { one, query } from "@/lib/db";
import { hashPin, pinMatches } from "./rider";

export interface Customer { id: number; name: string; phone: string }

const MAX_TRIES = 5;
const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; token: string; customer: Customer; created: boolean }
  | { ok: false; status: number; error: string };

/**
 * Phone + 5-digit PIN -> a fresh session token (replaces any earlier one).
 * A number with no account yet is registered with the PIN it first signs in with (a name is needed then).
 */
export async function customerLogin(phone: string, pin: string, name: string): Promise<LoginResult> {
  const c = await one<Customer & { pin_hash: string; failed_tries: number; locked: boolean }>(
    `select id, name, phone, pin_hash, failed_tries, coalesce(locked_until > now(), false) as locked from shop_customer where phone = $1`,
    [phone],
  );
  const token = randomBytes(32).toString("hex");

  if (!c) {
    if (name.length < 2) return { ok: false, status: 400, error: "Enter your name to create your account." };
    const made = await one<Customer>(
      `insert into shop_customer (name, phone, pin_hash, token) values ($1, $2, $3, $4)
       on conflict (phone) do nothing returning id, name, phone`,
      [name.slice(0, 80), phone, hashPin(pin), token],
    );
    if (!made) return { ok: false, status: 409, error: "Please try again." };
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
  await query(`update shop_customer set token = $2, failed_tries = 0, locked_until = null where id = $1`, [c.id, token]);
  return { ok: true, token, customer: { id: c.id, name: c.name, phone: c.phone }, created: false };
}

export async function customerFromRequest(req: NextRequest): Promise<Customer | null> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!t) return null;
  return one<Customer>(`select id, name, phone from shop_customer where token = $1`, [t]);
}
