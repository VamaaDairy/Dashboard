import type { NextRequest } from "next/server";
import { fail, jsonWithEtag } from "@/lib/shop/api";
import { catalogFor } from "@/lib/distributor";
import { sfFromRequest } from "@/lib/salesforce";

export const dynamic = "force-dynamic";

/** The catalogue at a distributor's dealer price. ?firm=<uid> */
export async function GET(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const products = await catalogFor(login, req.nextUrl.searchParams.get("firm") ?? undefined);
  if (!products) return fail(400, "Choose the distributor first.");
  return jsonWithEtag(req, { products }, 0, "private");
}
