import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { lockedMessage, pinCleared, pinFailed, pinLockedFor } from "@/lib/pin-guard";
import { riderLogin, type PartnerKind } from "@/lib/shop/rider";

export const dynamic = "force-dynamic";

/** A delivery boy or transporter signs in with phone + PIN; the app keeps the returned token.
 *  Body: { phone, pin, kind?: "delivery" | "transporter" } (no kind: older apps, any partner). */
export async function POST(req: NextRequest) {
  if (tooMany(req, "rider-login", 8)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 2000)) as { phone?: unknown; pin?: unknown; kind?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const pin = String(b?.pin ?? "");
  if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{4,8}$/.test(pin)) return fail(400, "Enter your mobile number and PIN.");
  const kind: PartnerKind | undefined = b?.kind === "transporter" ? "transporter" : b?.kind === "delivery" ? "delivery" : undefined;
  const locked = await pinLockedFor("rider", phone);
  if (locked) return fail(429, lockedMessage(locked));
  const r = await riderLogin(phone, pin, kind);
  if (!r) {
    await pinFailed("rider", phone);
    return fail(401, "Wrong number or PIN.");
  }
  await pinCleared("rider", phone);
  if (r === "wrong-kind") return fail(401, kind === "transporter" ? "This number is set up as a delivery boy. Choose Delivery Boy to sign in." : "This number is set up as a transporter. Choose Transporter to sign in.");
  const { id, name, phone: mobile, kind: k, vehicle_no } = r.rider;
  return NextResponse.json({ token: r.token, rider: { id, name, phone: mobile, kind: k ?? "delivery", vehicleNo: vehicle_no ?? null } });
}
