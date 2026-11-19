import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { consumeOtp, OTP_WRONG } from "@/lib/shop/otp";
import { pinCleared } from "@/lib/pin-guard";
import { riderResetPin } from "@/lib/shop/rider";

export const dynamic = "force-dynamic";

/**
 * Forgot PIN: the SMS code (from /rider/otp with purpose "reset") proves the number, the new PIN is set and this phone
 * is signed in; other phones are signed out. Body: { phone, otp, pin }. Answers like /rider/login.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "rider-reset", 8)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1000)) as { phone?: unknown; otp?: unknown; pin?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const otp = String(b?.otp ?? "");
  const pin = String(b?.pin ?? "");
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (!/^\d{4,8}$/.test(pin)) return fail(400, "The PIN must be 4 to 8 digits.");
  if (!(await consumeOtp(phone, "reset", otp))) return fail(400, OTP_WRONG);
  const r = await riderResetPin(phone, pin);
  if (!r) return fail(404, "No active partner account with this number.");
  await pinCleared("rider", phone);
  const { id, name, phone: mobile, kind, vehicle_no } = r.rider;
  return NextResponse.json({ token: r.token, rider: { id, name, phone: mobile, kind: kind ?? "delivery", vehicleNo: vehicle_no ?? null } });
}
