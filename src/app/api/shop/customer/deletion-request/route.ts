import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { requestDeletion } from "@/lib/shop/deletion";

export const dynamic = "force-dynamic";

/** A customer asks for their account to be deleted (from /delete-account). Body: { phone, pin, reason? }. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "customer-deletion", 10)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 2000)) as { phone?: unknown; pin?: unknown; reason?: unknown } | null;
  const phone = String(b?.phone ?? "").replace(/\D/g, "").slice(-10);
  const pin = String(b?.pin ?? "");
  const reason = String(b?.reason ?? "").trim();
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (!/^\d{5}$/.test(pin)) return fail(400, "The PIN is 5 digits.");

  const r = await requestDeletion(phone, pin, reason);
  if (!r.ok) return fail(r.status, r.error);
  return NextResponse.json({ ok: true, already: r.already });
}
