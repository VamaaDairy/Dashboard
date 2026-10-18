import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { setRiderLocation } from "@/lib/shop/orders";
import { riderFromRequest } from "@/lib/shop/rider";

export const dynamic = "force-dynamic";

/** The rider's phone reports where it is every few seconds while on a delivery. Body: { lat, lng } */
export async function POST(req: NextRequest) {
  if (tooMany(req, "rider-loc", 40)) return fail(429, "Too many requests.");
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  const b = (await readJson(req, 500)) as { lat?: unknown; lng?: unknown } | null;
  const lat = Number(b?.lat), lng = Number(b?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail(400, "lat and lng are needed.");
  await setRiderLocation(rider.id, lat, lng);
  return NextResponse.json({ ok: true });
}
