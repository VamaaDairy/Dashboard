import type { NextRequest } from "next/server";
import { jsonWithEtag } from "@/lib/shop/api";
import { liveBanners } from "@/lib/shop/banners";

export const dynamic = "force-dynamic";

/** The home-screen carousel: posters and product spotlights, highest priority first. */
export async function GET(req: NextRequest) {
  return jsonWithEtag(req, { banners: await liveBanners() });
}
