import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { riderFromRequest } from "@/lib/shop/rider";
import { finishStop, position } from "@/lib/dispatch";

export const dynamic = "force-dynamic";

/**
 * One stop of the transporter's trip is done. Body: { delivered: true, code?, receivedBy?, lat?, lng? } or
 * { delivered: false, note (why), lat?, lng? }. Delivered needs proof, whichever the transporter chooses: the buyer's
 * 4-digit delivery code (from the Gaia Distributors app), or a photo sent first to /stops/<id>/photo. The time is the
 * server's; the buyer's phone is told.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (tooMany(req, "stop", 60)) return fail(429, "Too many requests.");
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return fail(404, "Stop not found.");
  const b = (await readJson(req, 2000)) as { delivered?: unknown; receivedBy?: unknown; note?: unknown; code?: unknown } | null;
  if (!b || typeof b.delivered !== "boolean") return fail(400, "Say whether it was delivered.");
  const r = await finishStop(rider.id, id, {
    delivered: b.delivered,
    receivedBy: typeof b.receivedBy === "string" ? b.receivedBy : null,
    note: typeof b.note === "string" ? b.note : null,
    code: typeof b.code === "string" || typeof b.code === "number" ? String(b.code) : null,
    // the Delivery app before proof (1.0.9 and older) sends no "code" key at all
    legacy: !("code" in b),
    ...position(b),
  });
  return r.ok ? NextResponse.json({ ok: true }) : fail(409, r.error);
}
