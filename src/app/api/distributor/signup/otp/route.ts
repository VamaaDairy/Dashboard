import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { sendEmployeeOtp } from "@/lib/employee";
import { selfSignupBlocked } from "@/lib/distributor/requests";

export const dynamic = "force-dynamic";

/**
 * Create account, step 1: texts a 6-digit code to the mobile number. Body: { phone }. Refused when the number already
 * signs in, is already with Gaia, or is already waiting for approval. The code is only sent by SMS, never returned.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "dist-signup-otp", 6)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1000)) as { phone?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  const blocked = await selfSignupBlocked(phone);
  if (blocked) return fail(409, blocked);
  const r = await sendEmployeeOtp(phone);
  return r.ok ? NextResponse.json({ sent: true, resendAfter: 30 }) : fail(429, r.error);
}
