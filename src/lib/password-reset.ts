import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { one, query } from "@/lib/db";
import { hashPassword } from "@/lib/users";
import { sendMail } from "@/lib/mailer";

const CODE_TTL_MIN = 10;
const RESEND_AFTER_SEC = 60;
const MAX_ATTEMPTS = 5;

export const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
export const validEmail = (v: string) => v.length <= 254 && /^\S+@\S+\.\S+$/.test(v);

// the code is only 6 digits, so it is keyed to the server secret: a leaked table cannot be brute-forced offline
const hashCode = (userId: string, code: string) =>
  createHmac("sha256", process.env.JWT_SECRET || "dev-secret-change-me").update(`${userId}:${code}`).digest("hex");

/**
 * Emails a reset code to the account whose recovery email this is. Silent when there is no such account
 * (or one was sent a moment ago), so the answer never reveals which emails are registered.
 */
export async function sendResetCode(email: string): Promise<void> {
  const u = await one<{ id: string; name: string; sent_at: Date | null }>(
    `select u.id, u.name, r.sent_at from app_user u left join password_reset r on r.user_id = u.id
      where lower(u.recovery_email) = $1 and u.is_active`,
    [email],
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
  await sendMail(
    email,
    `Your Gaia password reset code: ${code}`,
    `Hi ${u.name},\n\nYour password reset code is ${code}. It works for ${CODE_TTL_MIN} minutes.\n\nIf you did not ask for this, ignore this email - your password has not changed.`,
    `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px">
      <p>Hi ${u.name.replace(/[<>&]/g, "")},</p>
      <p>Your password reset code is</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:12px 0">${code}</p>
      <p style="color:#555">It works for ${CODE_TTL_MIN} minutes. If you did not ask for this, ignore this email - your password has not changed.</p>
    </div>`,
  );
}

export type ResetResult = { ok: true } | { ok: false; error: string };

/** Checks the code for this recovery email and, if right, sets the new password (and uses the code up). */
export async function resetPassword(email: string, code: string, newPassword: string): Promise<ResetResult> {
  const bad: ResetResult = { ok: false, error: "That code is wrong or has expired. Ask for a new one." };
  const u = await one<{ id: string; code_hash: string; attempts: number; expired: boolean }>(
    `select u.id, r.code_hash, r.attempts, r.expires_at < now() as expired
       from app_user u join password_reset r on r.user_id = u.id
      where lower(u.recovery_email) = $1 and u.is_active`,
    [email],
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
