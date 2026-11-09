import type { NextRequest } from "next/server";
import { jsonWithEtag } from "@/lib/shop/api";
import { appOffers } from "@/lib/shop/offers";

export const dynamic = "force-dynamic";

/** The offers running now, for the app's badges and offers strip (Dashboard: Marketing > Offers). */
export async function GET(req: NextRequest) {
  return jsonWithEtag(req, { offers: await appOffers() });
}
