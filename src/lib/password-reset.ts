import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { one, query } from "@/lib/db";
import { hashPassword } from "@/lib/users";
import { sendSms } from "@/lib/sms";

const CODE_TTL_MIN = 10;
const RESEND_AFTER_SEC = 60;
const MAX_ATTEMPTS = 5;

/** A 10-digit Indian mobile number from whatever was typed (+91, spaces, dashes ...), or "" if it isn't one. */
export const normPhone = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "").slice(-10);
  return /^[6-9]\d{9}$/.test(d) ? d : "";
};

/** The text of the DLT-approved template; {otp} is where the code goes. */
const template = () =>
  process.env.SMS_OTP_TEXT ?? "Your One Time Password (OTP) is {otp} Please enter this in the App to complete the verification. Regards Team Gaia Fresh";

// the code is only 6 digits, so it is keyed to the server secret: a leaked table cannot be brute-forced offline
const hashCode = (userId: string, code: string) =>
  createHmac("sha256", process.env.JWT_SECRET || "dev-secret-change-me").update(`${userId}:${code}`).digest("hex");

/**
 * Texts a reset code to the mobile number saved on an active account. Silent when no account has this
 * number (or a code was sent a moment ago), so the answer never reveals which numbers are registered.
 * Throws if the SMS gateway fails, so the caller can tell the user.
 */
export async function sendResetCode(phone: string): Promise<void> {
  const u = await one<{ id: string; sent_at: Date | null }>(
    `select u.id, r.sent_at from app_user u left join password_reset r on r.user_id = u.id
      where u.mobile = $1 and u.is_active`,
    [phone],
  );
  if (!u) return;
  if (u.sent_at && Date.now() - new Date(u.sent_at).getTime() < RESEND_AFTER_SEC * 1000) return;

  const code = String(randomInt(100000, 1000000));
  await query(
    `insert into password_reset (user_id, code_hash, expires_at, attempts, sent_at)
     values ($1, $2, now() + make_interval(mins => $3), 0, now())
     on conflict (user_id) do update set code_hash = $2, expires_at = excluded.expires_at, attempts = 0, sent_at = now()`,
    [u.id, hashCode(u.id, code), CODE_TTL_MIN],
  );
  await sendSms(phone, template().replace("{otp}", code));
}

export type ResetResult = { ok: true } | { ok: false; error: string };

/** Checks the code for this mobile number and, if right, sets the new password (and uses the code up). */
export async function resetPassword(phone: string, code: string, newPassword: string): Promise<ResetResult> {
  const bad: ResetResult = { ok: false, error: "That code is wrong or has expired. Ask for a new one." };
  const u = await one<{ id: string; code_hash: string; attempts: number; expired: boolean }>(
    `select u.id, r.code_hash, r.attempts, r.expires_at < now() as expired
       from app_user u join password_reset r on r.user_id = u.id
      where u.mobile = $1 and u.is_active`,
    [phone],
  );
  if (!u || u.expired || u.attempts >= MAX_ATTEMPTS) return bad;

  const given = Buffer.from(hashCode(u.id, code));
  const want = Buffer.from(u.code_hash);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    await query(`update password_reset set attempts = attempts + 1 where user_id = $1`, [u.id]);
    return bad;
  }
  await query(`update app_user set password_hash = $2 where id = $1`, [u.id, await hashPassword(newPassword)]);
  await query(`delete from password_reset where user_id = $1`, [u.id]);
  return { ok: true };
}
