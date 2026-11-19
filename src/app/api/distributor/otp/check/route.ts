import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { checkEmployeeOtp } from "@/lib/employee";

export const dynamic = "force-dynamic";

/**
 * Confirms the SMS code (Create account or Forgot PIN) before the app asks for a PIN; the step that sets the PIN uses
 * it up. Body: { phone, code }.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "dist-otp-check", 10)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1000)) as { phone?: unknown; code?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const code = String(b?.code ?? "");
  if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{6}$/.test(code)) return fail(400, "Enter the 6-digit code from the SMS.");
  if (!(await checkEmployeeOtp(phone, code))) return fail(400, "That code is wrong or has expired. Ask for a new one.");
  return NextResponse.json({ ok: true });
}
