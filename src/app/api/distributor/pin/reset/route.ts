import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { consumeOtp } from "@/lib/employee";
import { pinCleared } from "@/lib/pin-guard";
import { distResetPin } from "@/lib/distributor";

export const dynamic = "force-dynamic";

/**
 * Forgot PIN, step 2: the SMS code proves the number, the new PIN is set and this phone is signed in (other phones are
 * signed out). Body: { phone, code, pin, kind?: "distributor" | "retailer" }. Answers like /distributor/login.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "dist-pin-reset", 8)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1000)) as { phone?: unknown; code?: unknown; pin?: unknown; kind?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const code = String(b?.code ?? "");
  const pin = String(b?.pin ?? "");
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (!/^\d{4,8}$/.test(pin)) return fail(400, "The PIN must be 4 to 8 digits.");
  if (!(await consumeOtp(phone, code))) return fail(400, "That code is wrong or has expired. Ask for a new one.");
  const kind = b?.kind === "distributor" || b?.kind === "retailer" ? b.kind : undefined;
  const r = await distResetPin(phone, pin, kind);
  if (!r) return fail(404, "No account with this number.");
  await pinCleared("dist", phone);
  if (r === "inactive") return fail(403, "Your PIN is set, but this account is inactive. Please contact Gaia to get it switched on.");
  return NextResponse.json({ token: r.token, login: { kind: r.login.kind, name: r.login.name, phone: r.login.phone } });
}
