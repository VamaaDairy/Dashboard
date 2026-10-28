import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { one, query } from "@/lib/db";
import { sendSms } from "@/lib/sms";

export type OtpPurpose = "signup" | "reset";

const CODE_TTL_MIN = 10;
const RESEND_AFTER_SEC = 30;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

// the code is only 6 digits, so it is keyed to the server secret: a leaked table cannot be brute-forced offline
const hashCode = (phone: string, purpose: OtpPurpose, code: string) =>
  createHmac("sha256", process.env.JWT_SECRET || "dev-secret-change-me").update(`${phone}:${purpose}:${code}`).digest("hex");

/** The text of the DLT-approved template; {otp} is where the code goes. */
const template = () => process.env.SMS_OTP_TEXT ?? "Your One Time Password (OTP) is {otp} Please enter this in the App to complete the verification. Regards Team Gaia Fresh";

export type SendResult = { ok: true } | { ok: false; status: number; error: string };

/** Texts a fresh code to this number (replacing any earlier one). Throttled per number. */
export async function sendOtp(phone: string, purpose: OtpPurpose): Promise<SendResult> {
  const prev = await one<{ wait: number; in_window: number; window_open: boolean }>(
    `select extract(epoch from now() - sent_at)::int as wait, sent_in_window as in_window,
            window_start > now() - interval '1 hour' as window_open
       from shop_customer_otp where phone = $1`,
    [phone],
  );
  if (prev && prev.wait < RESEND_AFTER_SEC) return { ok: false, status: 429, error: `Please wait ${RESEND_AFTER_SEC - prev.wait} seconds before asking for another code.` };
  if (prev?.window_open && prev.in_window >= MAX_PER_HOUR) return { ok: false, status: 429, error: "Too many codes requested. Please try again in an hour." };

  const code = String(randomInt(100000, 1000000));
  await query(
    `insert into shop_customer_otp (phone, purpose, code_hash, expires_at)
     values ($1, $2, $3, now() + make_interval(mins => $4))
     on conflict (phone) do update set
       purpose = $2, code_hash = $3, expires_at = excluded.expires_at, attempts = 0, sent_at = now(),
       window_start = case when shop_customer_otp.window_start > now() - interval '1 hour' then shop_customer_otp.window_start else now() end,
       sent_in_window = case when shop_customer_otp.window_start > now() - interval '1 hour' then shop_customer_otp.sent_in_window + 1 else 1 end`,
    [phone, purpose, hashCode(phone, purpose, code), CODE_TTL_MIN],
  );
  try {
    await sendSms(phone, template().replace("{otp}", code));
  } catch (e) {
    console.error("OTP SMS failed:", e);
    // TEMPORARY (debugging): the gateway's code and message are shown in the app; remove once SMS delivery works
    return { ok: false, status: 502, error: `We could not send the SMS right now. Please try again. [${e instanceof Error ? e.message : String(e)}]` };
  }
  return { ok: true };
}

/** True when `code` is the live code for this number and purpose; the code is used up. */
export async function consumeOtp(phone: string, purpose: OtpPurpose, code: string): Promise<boolean> {
  const r = await one<{ code_hash: string; attempts: number; expired: boolean; purpose: OtpPurpose }>(
    `select code_hash, attempts, purpose, expires_at < now() as expired from shop_customer_otp where phone = $1`,
    [phone],
  );
  if (!r || r.purpose !== purpose || r.expired || r.attempts >= MAX_ATTEMPTS) return false;
  const given = Buffer.from(hashCode(phone, purpose, code));
  const want = Buffer.from(r.code_hash);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    await query(`update shop_customer_otp set attempts = attempts + 1 where phone = $1`, [phone]);
    return false;
  }
  // keep the row (it carries the hourly send count) but make the code unusable
  await query(`update shop_customer_otp set expires_at = now() where phone = $1`, [phone]);
  return true;
}

export const OTP_WRONG = "That code is wrong or has expired. Ask for a new one.";
