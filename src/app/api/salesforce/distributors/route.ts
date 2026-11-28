import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { sfFromRequest } from "@/lib/salesforce";
import { distributorsNear } from "@/lib/distributor/requests";

export const dynamic = "force-dynamic";

/** The distributors a retailer the officer adds can be served by: ?lat=&lng= for the nearest first, ?q= to search. */
export async function GET(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const sp = req.nextUrl.searchParams;
  const num = (k: string) => (sp.get(k) === null ? null : Number(sp.get(k)));
  return NextResponse.json({ distributors: await distributorsNear({ lat: num("lat"), lng: num("lng"), q: sp.get("q") ?? "" }) });
}
