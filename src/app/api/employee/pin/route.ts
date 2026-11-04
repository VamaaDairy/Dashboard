import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { lockedMessage, pinCleared, pinFailed, pinLockedFor } from "@/lib/pin-guard";
import { pinSignIn } from "@/lib/employee";

export const dynamic = "force-dynamic";

/** Sign in with mobile number and PIN. Body: { phone, pin, device? }. Returns what /verify does. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "emp-pin", 8)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 2000)) as { phone?: unknown; pin?: unknown; device?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const pin = String(b?.pin ?? "");
  if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{4,8}$/.test(pin)) return fail(400, "Enter your mobile number and PIN.");
  const locked = await pinLockedFor("emp", phone);
  if (locked) return fail(429, lockedMessage(locked));
  const r = await pinSignIn(phone, pin, typeof b?.device === "string" ? b.device : null);
  if (!r.ok) {
    await pinFailed("emp", phone);
    return fail(401, r.error);
  }
  await pinCleared("emp", phone);
  return NextResponse.json(r);
}
