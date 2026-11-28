import { NextResponse, type NextRequest } from "next/server";
import { fail, tooMany } from "@/lib/shop/api";
import { distributorsNear } from "@/lib/distributor/requests";

export const dynamic = "force-dynamic";

/**
 * The distributors a retailer signing up can pick as the one that serves it: ?lat=&lng= (its shop) for the nearest
 * first, ?q= to search by name, city or area. Before sign-in, so only names and places, and rate-limited.
 */
export async function GET(req: NextRequest) {
  if (tooMany(req, "dist-signup-near", 30)) return fail(429, "Too many requests. Please wait a minute.");
  const sp = req.nextUrl.searchParams;
  const num = (k: string) => (sp.get(k) === null ? null : Number(sp.get(k)));
  const distributors = await distributorsNear({ lat: num("lat"), lng: num("lng"), q: sp.get("q") ?? "" });
  return NextResponse.json({ distributors });
}
