import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { bannerImage } from "@/lib/shop/banners";

export const dynamic = "force-dynamic";

/** An uploaded poster. The URL carries a version, so it can be cached for a long time. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return fail(404, "Not found.");
  const img = await bannerImage(id);
  if (!img) return fail(404, "Not found.");
  return new NextResponse(new Uint8Array(img.bytes), {
    headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
