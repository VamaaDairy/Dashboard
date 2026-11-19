import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { sendEmployeeOtp } from "@/lib/employee";
import { hasDistLogin } from "@/lib/distributor";
import { selfSignupNotice } from "@/lib/distributor/requests";

export const dynamic = "force-dynamic";

/**
 * Forgot PIN (or the first PIN of a sign-in the office made), step 1: texts a 6-digit code to the number.
 * Body: { phone }. The number must have an active distributor / retailer sign-in.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "dist-pin-otp", 5)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1000)) as { phone?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (!(await hasDistLogin(phone))) {
    // asked for an account in the app and not approved yet (or turned down): say so
    const notice = await selfSignupNotice(phone);
    return fail(notice ? 403 : 404, notice ?? "No account with this number. Create one, or ask Gaia to add you.");
  }
  const r = await sendEmployeeOtp(phone);
  return r.ok ? NextResponse.json({ sent: true, resendAfter: 30 }) : fail(429, r.error);
}
