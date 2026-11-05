import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { sendOtp } from "@/lib/shop/otp";

export const dynamic = "force-dynamic";

/** Texts a 6-digit code to confirm the number of a new delivery partner. Body: { phone }. The number must be new. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "rider-otp", 5)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1000)) as { phone?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (await one(`select 1 from shop_rider where phone = $1`, [phone])) return fail(409, "This number already has an account. Please sign in.");

  const r = await sendOtp(phone, "signup");
  if (!r.ok) return fail(r.status, r.error);
  return NextResponse.json({ sent: true, resendAfter: 30 });
}
