import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { checkIn, checkOut, dayStatus, isOutcome, sfFromRequest } from "@/lib/salesforce";

export const dynamic = "force-dynamic";

/** Check in at a store. Body: { firmUid, lat, lng, accuracy? } - refused when the phone is not at the store. */
export async function POST(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "sf-visit", 30)) return fail(429, "Too many requests. Please wait a minute.");
  const b = (await readJson(req, 2000)) as { firmUid?: unknown; lat?: unknown; lng?: unknown; accuracy?: unknown } | null;
  if (!b || typeof b.firmUid !== "string") return fail(400, "Invalid request.");
  const r = await checkIn(login, { firmUid: b.firmUid, lat: b.lat, lng: b.lng, accuracy: b.accuracy });
  if (!r.ok) return fail(400, r.error);
  return NextResponse.json({ visitId: r.visitId, distanceM: r.distanceM, verified: r.verified, ...(await dayStatus(login.staffUid)) }, { status: 201 });
}

/** Check out of the open visit. Body: { visitId, outcome: "order" | "no_order" | "shop_closed" | "follow_up", notes?, lat?, lng? } */
export async function PATCH(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const b = (await readJson(req, 3000)) as { visitId?: unknown; outcome?: unknown; notes?: unknown; lat?: unknown; lng?: unknown } | null;
  if (!b || !Number.isInteger(b.visitId) || !isOutcome(b.outcome)) return fail(400, "Pick how the visit went.");
  const r = await checkOut(login, {
    visitId: b.visitId as number, lat: b.lat, lng: b.lng, outcome: b.outcome, notes: typeof b.notes === "string" ? b.notes : null,
  });
  if (!r.ok) return fail(400, r.error);
  return NextResponse.json(await dayStatus(login.staffUid));
}
