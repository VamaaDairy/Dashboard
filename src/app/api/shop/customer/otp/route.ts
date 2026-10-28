import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { sendOtp } from "@/lib/shop/otp";

export const dynamic = "force-dynamic";

/**
 * Texts a 6-digit code to a mobile number. Body: { phone, purpose } - "signup" (number must be new)
 * or "reset" (number must have an account). The code is never returned, only sent by SMS.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "customer-otp", 5)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1000)) as { phone?: unknown; purpose?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (b?.purpose !== "signup" && b?.purpose !== "reset") return fail(400, "Unknown request.");

  const exists = !!(await one(`select 1 from shop_customer where phone = $1`, [phone]));
  if (b.purpose === "signup" && exists) return fail(409, "This number already has an account. Please sign in.");
  if (b.purpose === "reset" && !exists) return fail(404, "No account with this number yet. Create one to continue.");

  const r = await sendOtp(phone, b.purpose);
  if (!r.ok) return fail(r.status, r.error);
  return NextResponse.json({ sent: true, resendAfter: 30 });
}
