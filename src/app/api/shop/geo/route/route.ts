import { NextResponse, type NextRequest } from "next/server";
import { fail, tooMany } from "@/lib/shop/api";
import { route } from "@/lib/shop/ola";

export const dynamic = "force-dynamic";

const pt = (s: string | null) => {
  const [a, b] = (s ?? "").split(",").map(Number);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
};

/** Driving route: ?from=lat,lng&to=lat,lng -> distance, time and the line to draw. */
export async function GET(req: NextRequest) {
  if (tooMany(req, "route", 60)) return fail(429, "Too many requests. Please wait a minute.");
  const from = pt(req.nextUrl.searchParams.get("from")), to = pt(req.nextUrl.searchParams.get("to"));
  if (!from || !to) return fail(400, "from and to are needed as lat,lng.");
  const r = await route(from, to);
  return NextResponse.json(r ?? { distanceM: null, durationS: null, points: [] });
}
