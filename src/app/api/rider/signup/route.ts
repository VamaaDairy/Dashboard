import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { consumeOtp, OTP_WRONG } from "@/lib/shop/otp";
import { riderSignup } from "@/lib/shop/rider";

export const dynamic = "force-dynamic";

/** A new delivery boy or transporter creates their account and is signed in; the app keeps the returned token.
 *  Body: { name, phone, pin, otp, kind, vehicleNo? }; otp is the code texted by /rider/otp. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "rider-signup", 8)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 2000)) as { name?: unknown; phone?: unknown; pin?: unknown; otp?: unknown; kind?: unknown; vehicleNo?: unknown } | null;
  const name = String(b?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const pin = String(b?.pin ?? "");
  const otp = String(b?.otp ?? "");
  if (name.length < 2) return fail(400, "Enter your name.");
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (!/^\d{4,8}$/.test(pin)) return fail(400, "The PIN must be 4 to 8 digits.");
  if (b?.kind !== "delivery" && b?.kind !== "transporter") return fail(400, "Choose Delivery Boy or Transporter.");
  const vehicleNo = b.kind === "transporter" ? String(b?.vehicleNo ?? "").trim().toUpperCase().replace(/\s+/g, " ").slice(0, 20) || null : null;

  const taken = "This number already has an account. Please sign in.";
  if (await one(`select 1 from shop_rider where phone = $1`, [phone])) return fail(409, taken);
  if (!(await consumeOtp(phone, "signup", otp))) return fail(400, OTP_WRONG);

  const r = await riderSignup(name, phone, pin, b.kind, vehicleNo);
  if (!r) return fail(409, taken);
  const { id, name: n, phone: mobile, kind, vehicle_no } = r.rider;
  return NextResponse.json({ token: r.token, rider: { id, name: n, phone: mobile, kind: kind ?? "delivery", vehicleNo: vehicle_no ?? null } });
}
