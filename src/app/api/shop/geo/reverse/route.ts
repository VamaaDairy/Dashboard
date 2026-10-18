import { NextResponse, type NextRequest } from "next/server";
import { fail, tooMany } from "@/lib/shop/api";
import { reverse } from "@/lib/shop/ola";

export const dynamic = "force-dynamic";

/** The street address for a map pin: ?lat=…&lng=… */
export async function GET(req: NextRequest) {
  if (tooMany(req, "geo", 90)) return fail(429, "Too many requests. Please wait a minute.");
  const lat = Number(req.nextUrl.searchParams.get("lat")), lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail(400, "lat and lng are needed.");
  const r = await reverse(lat, lng);
  return NextResponse.json({ address: r?.address ?? null, pincode: r?.pincode ?? null });
}
