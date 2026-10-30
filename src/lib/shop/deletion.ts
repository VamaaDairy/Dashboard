import "server-only";
import { one, query } from "@/lib/db";
import { pinMatches } from "./rider";

const MAX_TRIES = 5;
const LOCK_MINUTES = 15;

export type DeletionResult = { ok: true; already: boolean } | { ok: false; status: number; error: string };

/**
 * Records a customer's request to delete their Gaia account. The number and PIN must match (wrong PINs
 * count towards the same lock as signing in). Nothing is deleted here: the team handles the request.
 */
export async function requestDeletion(phone: string, pin: string, reason: string): Promise<DeletionResult> {
  const c = await one<{ id: number; name: string; pin_hash: string; locked: boolean }>(
    `select id, name, pin_hash, coalesce(locked_until > now(), false) as locked from shop_customer where phone = $1`,
    [phone],
  );
  if (!c) return { ok: false, status: 404, error: "There is no Gaia account with this number." };
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
  await query(`update shop_customer set failed_tries = 0, locked_until = null where id = $1`, [c.id]);
  const made = await one<{ id: number }>(
    `insert into shop_deletion_request (customer_id, name, phone, reason) values ($1, $2, $3, $4)
     on conflict (phone) where status = 'pending' do nothing returning id`,
    [c.id, c.name, phone, reason.slice(0, 500) || null],
  );
  return { ok: true, already: !made };
}

export interface DeletionRequest {
  id: number; name: string; phone: string; reason: string | null; status: "pending" | "done" | "rejected";
  created_at: Date; handled_at: Date | null; handled_by: string | null;
}

export const listDeletionRequests = () =>
  query<DeletionRequest>(
    `select id, name, phone, reason, status, created_at, handled_at, handled_by from shop_deletion_request
      order by status = 'pending' desc, created_at desc limit 500`,
  );

/** Marks a request handled (done or rejected) by this dashboard user. */
export async function closeDeletionRequest(id: number, status: "done" | "rejected", by: string): Promise<void> {
  await query(`update shop_deletion_request set status = $2, handled_at = now(), handled_by = $3 where id = $1 and status = 'pending'`, [id, status, by]);
}
