import type { NextRequest } from "next/server";
import { fail, jsonWithEtag } from "@/lib/shop/api";
import { catalogFor, distFromRequest } from "@/lib/distributor";

export const dynamic = "force-dynamic";

/** The shop catalogue at this distributor's dealer price. ?firm=<uid> (optional for a distributor). */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const products = await catalogFor(login, req.nextUrl.searchParams.get("firm") ?? undefined);
  if (!products) return fail(400, "Choose the distributor first.");
  // dealer prices are per login: private, and an app that already has this exact list gets a 304
  return jsonWithEtag(req, { products }, 0, "private");
}
