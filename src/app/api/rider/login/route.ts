import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { riderLogin } from "@/lib/shop/rider";

export const dynamic = "force-dynamic";

/** Rider signs in with phone + PIN; the app keeps the returned token. Body: { phone, pin } */
export async function POST(req: NextRequest) {
  if (tooMany(req, "rider-login", 8)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 2000)) as { phone?: unknown; pin?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const pin = String(b?.pin ?? "");
  if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{4,8}$/.test(pin)) return fail(400, "Enter your mobile number and PIN.");
  const r = await riderLogin(phone, pin);
  if (!r) return fail(401, "Wrong number or PIN.");
  return NextResponse.json({ token: r.token, rider: { id: r.rider.id, name: r.rider.name, phone: r.rider.phone } });
}
