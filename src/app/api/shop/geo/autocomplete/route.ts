import { NextResponse, type NextRequest } from "next/server";
import { fail, tooMany } from "@/lib/shop/api";
import { autocomplete, placeLatLng } from "@/lib/shop/ola";

export const dynamic = "force-dynamic";

/** Address search as the customer types: ?q=…&lat=…&lng=… (lat/lng bias results to where they are). */
export async function GET(req: NextRequest) {
  if (tooMany(req, "geo", 90)) return fail(429, "Too many requests. Please wait a minute.");
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 3) return NextResponse.json({ suggestions: [] });
  const lat = Number(sp.get("lat")), lng = Number(sp.get("lng"));
  const near = sp.has("lat") && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  const list = await autocomplete(q, near);
  // a pick needs coordinates; fill the first few that came without
  await Promise.all(list.slice(0, 5).map(async (s) => {
    if (s.lat === null && s.id) {
      const p = await placeLatLng(s.id);
      if (p) { s.lat = p.lat; s.lng = p.lng; }
    }
  }));
  return NextResponse.json({ suggestions: list.filter((s) => s.lat !== null) });
}
