import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { sfLogin } from "@/lib/salesforce";

export const dynamic = "force-dynamic";

/** A sales officer signs in with phone + PIN. Body: { phone, pin }. Returns { token, login }. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "sf-login", 8)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 2000)) as { phone?: unknown; pin?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const pin = String(b?.pin ?? "");
  if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{4,8}$/.test(pin)) return fail(400, "Enter your mobile number and PIN.");
  const r = await sfLogin(phone, pin);
  if (!r) return fail(401, "Wrong number or PIN.");
  if (r === "inactive") return fail(403, "This account is inactive. Please contact Gaia to get it switched on.");
  return NextResponse.json({ token: r.token, login: { kind: r.login.kind, name: r.login.name, phone: r.login.phone } });
}
