import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { sendOtp } from "@/lib/shop/otp";

export const dynamic = "force-dynamic";

/**
 * Texts a 6-digit code to a delivery partner's number. Body: { phone, purpose?: "signup" | "reset" } - "signup" (the
 * default; the number must be new) or "reset" for Forgot PIN (the number must have an active account).
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "rider-otp", 5)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1000)) as { phone?: unknown; purpose?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  const purpose = b?.purpose === "reset" ? "reset" : "signup";
  const acct = await one<{ active: boolean }>(`select active from shop_rider where phone = $1`, [phone]);
  if (purpose === "signup" && acct) return fail(409, "This number already has an account. Please sign in.");
  if (purpose === "reset" && !acct) return fail(404, "No partner account with this number. Create one to continue.");
  if (purpose === "reset" && !acct!.active) return fail(403, "This account is switched off. Please contact the Gaia office.");

  const r = await sendOtp(phone, purpose);
  if (!r.ok) return fail(r.status, r.error);
  return NextResponse.json({ sent: true, resendAfter: 30 });
}
