import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { customerLogin } from "@/lib/shop/customer";

export const dynamic = "force-dynamic";

/**
 * Customer signs in with mobile number + 5-digit PIN; the app keeps the returned token.
 * Body: { phone, pin, name? } - `name` is only needed the first time, when the account is created.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "customer-login", 10)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 2000)) as { phone?: unknown; pin?: unknown; name?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const pin = String(b?.pin ?? "");
  const name = String(b?.name ?? "").trim();
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (!/^\d{5}$/.test(pin)) return fail(400, "The PIN is 5 digits.");

  const r = await customerLogin(phone, pin, name);
  if (!r.ok) return fail(r.status, r.error);
  return NextResponse.json({ token: r.token, created: r.created, customer: { name: r.customer.name, phone: r.customer.phone } });
}
