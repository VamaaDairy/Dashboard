import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { sendEmployeeOtp } from "@/lib/employee";

export const dynamic = "force-dynamic";

/** Texts a 6-digit code to the mobile number. Body: { phone }. The code is never returned, only sent by SMS. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "emp-otp", 6)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1000)) as { phone?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  const r = await sendEmployeeOtp(phone);
  return r.ok ? NextResponse.json({ sent: true, resendAfter: 30 }) : fail(429, r.error);
}
