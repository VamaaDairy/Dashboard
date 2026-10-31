import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson } from "@/lib/shop/api";
import { MAX_PINGS, savePings, sfFromRequest, type Ping } from "@/lib/salesforce";

export const dynamic = "force-dynamic";

/** The phone's location trail. Body: { pings: [{ lat, lng, accuracy?, speed?, battery?, at (ISO time) }] } - a batch, so fixes queued offline arrive together. */
export async function POST(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const b = (await readJson(req, 40_000)) as { pings?: unknown } | null;
  if (!b || !Array.isArray(b.pings)) return fail(400, "Invalid request.");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const pings: Ping[] = b.pings.slice(0, MAX_PINGS).flatMap((p) => {
    const o = p as Record<string, unknown>;
    return typeof o?.lat === "number" && typeof o?.lng === "number" && typeof o?.at === "string"
      ? [{ lat: o.lat, lng: o.lng, accuracy: num(o.accuracy), speed: num(o.speed), battery: num(o.battery), at: o.at }]
      : [];
  });
  return NextResponse.json({ saved: await savePings(login.staffUid, pings) });
}
