import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { catalogFor, distFromRequest } from "@/lib/distributor";

export const dynamic = "force-dynamic";

/** The shop catalogue at this distributor's dealer price. ?firm=<uid> (optional for a distributor). */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const products = await catalogFor(login, req.nextUrl.searchParams.get("firm") ?? undefined);
  if (!products) return fail(400, "Choose the distributor first.");
  return NextResponse.json({ products });
}
