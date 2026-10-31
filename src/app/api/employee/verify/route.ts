import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { verifyEmployee } from "@/lib/employee";

export const dynamic = "force-dynamic";

/**
 * Checks the code. Body: { phone, code, device?, signup?: { name, email?, department? } }.
 * Returns { status: "signed_in", token, employee } for an employee on file, or { status: "pending" } when the
 * number was new and an account request was sent to the office (only when `signup` is given).
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "emp-verify", 10)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 3000)) as { phone?: unknown; code?: unknown; device?: unknown; signup?: Record<string, unknown> | null } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const code = String(b?.code ?? "").replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(phone) || code.length !== 6) return fail(400, "Enter your mobile number and the 6-digit code.");
  const s = b?.signup && typeof b.signup === "object" ? b.signup : null;
  const r = await verifyEmployee(
    phone, code,
    s ? { name: String(s.name ?? ""), email: String(s.email ?? ""), department: String(s.department ?? "") } : null,
    typeof b?.device === "string" ? b.device : null,
  );
  if (!r.ok) return fail(401, r.error);
  return NextResponse.json(r);
}
