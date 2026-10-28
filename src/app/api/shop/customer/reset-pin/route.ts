import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { customerJson, resetPin } from "@/lib/shop/customer";

export const dynamic = "force-dynamic";

/** Sets a new PIN after the SMS code is confirmed, and signs the customer in. Body: { phone, otp, pin }. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "customer-reset", 10)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1000)) as { phone?: unknown; otp?: unknown; pin?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const otp = String(b?.otp ?? "");
  const pin = String(b?.pin ?? "");
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (!/^\d{6}$/.test(otp)) return fail(400, "The code is 6 digits.");
  if (!/^\d{5}$/.test(pin)) return fail(400, "The PIN is 5 digits.");

  const r = await resetPin(phone, otp, pin);
  if (!r.ok) return fail(r.status, r.error);
  return NextResponse.json({ token: r.token, created: false, customer: customerJson(r.customer) });
}
