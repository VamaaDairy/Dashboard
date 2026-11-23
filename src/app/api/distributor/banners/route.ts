import type { NextRequest } from "next/server";
import { fail, jsonWithEtag } from "@/lib/shop/api";
import { appChannelOf, distFromRequest } from "@/lib/distributor";
import { audiencesFor } from "@/lib/distributor/offers";
import { liveBanners } from "@/lib/shop/banners";

export const dynamic = "force-dynamic";

/** The Gaia Distributors app's home carousel: banners for this login's kind (distributors / retailers) and for both. */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req, "any");
  if (!login) return fail(401, "Please sign in again.");
  return jsonWithEtag(req, { banners: await liveBanners(audiencesFor(appChannelOf(login))) }, 0, "private");
}
