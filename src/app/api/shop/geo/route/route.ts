import { NextResponse, type NextRequest } from "next/server";
import { fail, tooMany } from "@/lib/shop/api";
import { routeVia } from "@/lib/shop/ola";

export const dynamic = "force-dynamic";

const pt = (s: string | null) => {
  const [a, b] = (s ?? "").split(",").map(Number);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
};

/**
 * Driving route: ?from=lat,lng&to=lat,lng, and optionally &via=lat,lng|lat,lng for stops on the way (a
 * rider's whole route, in order, up to 10) -> distance, time, the line to draw, and each stretch's legs.
 */
export async function GET(req: NextRequest) {
  if (tooMany(req, "route", 60)) return fail(429, "Too many requests. Please wait a minute.");
  const from = pt(req.nextUrl.searchParams.get("from")), to = pt(req.nextUrl.searchParams.get("to"));
  if (!from || !to) return fail(400, "from and to are needed as lat,lng.");
  const raw = (req.nextUrl.searchParams.get("via") ?? "").split("|").filter(Boolean);
  const via = raw.map(pt);
  if (via.some((p) => !p) || via.length > 10) return fail(400, "via is up to 10 stops as lat,lng|lat,lng.");
  const r = await routeVia(from, via as { lat: number; lng: number }[], to);
  return NextResponse.json(r ?? { distanceM: null, durationS: null, points: [], steps: [], legs: [] });
}
