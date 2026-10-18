import { NextResponse } from "next/server";
import { liveBanners } from "@/lib/shop/banners";

export const dynamic = "force-dynamic";

/** The home-screen carousel: posters and product spotlights, highest priority first. */
export async function GET() {
  return NextResponse.json({ banners: await liveBanners() }, { headers: { "Cache-Control": "public, max-age=60" } });
}
