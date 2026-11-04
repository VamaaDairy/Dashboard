import "server-only";
import { one, query } from "@/lib/db";

/** Wrong PINs allowed for one number before it is blocked. */
export const MAX_PIN_FAILS = 5;
/** How long a number stays blocked after too many wrong PINs. */
export const PIN_LOCK_MINUTES = 15;

export type PinScope = "rider" | "dist" | "sf" | "emp";

/** Minutes left on this number's lock, or 0 when it may try a PIN. */
export async function pinLockedFor(scope: PinScope, phone: string): Promise<number> {
  const r = await one<{ mins: number }>(
    `select ceil(extract(epoch from (locked_until - now())) / 60)::int as mins
       from pin_attempt where scope = $1 and phone = $2 and locked_until > now()`,
    [scope, phone],
  );
  return r?.mins ?? 0;
}

/** Count a wrong PIN; the 5th in a row locks the number. A wrong PIN after 15 quiet minutes starts the count again. */
export async function pinFailed(scope: PinScope, phone: string): Promise<void> {
  await query(
    `insert into pin_attempt (scope, phone, fails, updated_at) values ($1, $2, 1, now())
     on conflict (scope, phone) do update set
       fails = case when pin_attempt.updated_at < now() - make_interval(mins => $4::int) then 1 else pin_attempt.fails + 1 end,
       locked_until = case
         when pin_attempt.updated_at >= now() - make_interval(mins => $4::int) and pin_attempt.fails + 1 >= $3::int
         then now() + make_interval(mins => $4::int) else pin_attempt.locked_until end,
       updated_at = now()`,
    [scope, phone, MAX_PIN_FAILS, PIN_LOCK_MINUTES],
  );
}

/** A right PIN (or a PIN reset by SMS) clears the count. */
export async function pinCleared(scope: PinScope, phone: string): Promise<void> {
  await query(`delete from pin_attempt where scope = $1 and phone = $2`, [scope, phone]);
}

export const lockedMessage = (mins: number) =>
  `Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
