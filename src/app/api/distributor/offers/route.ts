import type { NextRequest } from "next/server";
import { fail, jsonWithEtag } from "@/lib/shop/api";
import { appChannelOf, distFromRequest } from "@/lib/distributor";
import { audiencesFor } from "@/lib/distributor/offers";
import { appOffers } from "@/lib/shop/offers";

export const dynamic = "force-dynamic";

/** The partner offers running now for this login's kind (distributors / retailers) and both - for the app's offers strip. */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req, "any");
  if (!login) return fail(401, "Please sign in again.");
  return jsonWithEtag(req, { offers: await appOffers(audiencesFor(appChannelOf(login))) }, 0, "private");
}
