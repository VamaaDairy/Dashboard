import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { riderFromRequest } from "@/lib/shop/rider";
import { requestPartnerDeletion } from "@/lib/shop/deletion";

export const dynamic = "force-dynamic";

/**
 * The signed-in delivery partner asks for their account to be deleted (Play requires this in-app). Body: { reason? }.
 * The request goes to Shop orders > Deletion requests; the account is switched off and signed out at once.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "rider-delete", 5)) return fail(429, "Too many requests. Please wait a minute.");
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  const b = ((await readJson(req, 2000)) ?? {}) as { reason?: unknown };
  const r = await requestPartnerDeletion(rider.id, typeof b.reason === "string" ? b.reason : "");
  return NextResponse.json({ ok: true, already: r.already });
}
