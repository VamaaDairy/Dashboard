import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { riderFromRequest } from "@/lib/shop/rider";
import { position, startTrip } from "@/lib/dispatch";

export const dynamic = "force-dynamic";

/** The transporter leaves with the trip: every order on it is dispatched. Body: { lat?, lng? } (where the phone is). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (tooMany(req, "trip", 30)) return fail(429, "Too many requests.");
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return fail(404, "Trip not found.");
  const r = await startTrip(rider.id, id, position(await readJson(req, 500)));
  return r.ok ? NextResponse.json({ ok: true }) : fail(409, r.error);
}
