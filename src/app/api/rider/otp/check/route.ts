import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { checkOtp, OTP_WRONG } from "@/lib/shop/otp";

export const dynamic = "force-dynamic";

/**
 * Confirms a delivery partner's SMS code before the app asks for a PIN; the sign-up or Forgot PIN step uses it up.
 * Body: { phone, otp, purpose?: "signup" | "reset" }.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "rider-otp-check", 10)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1000)) as { phone?: unknown; otp?: unknown; purpose?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const otp = String(b?.otp ?? "");
  if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{6}$/.test(otp)) return fail(400, "Enter the 6-digit code from the SMS.");
  if (!(await checkOtp(phone, b?.purpose === "reset" ? "reset" : "signup", otp))) return fail(400, OTP_WRONG);
  return NextResponse.json({ ok: true });
}
