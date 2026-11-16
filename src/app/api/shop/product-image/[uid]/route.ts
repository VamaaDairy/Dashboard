import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { productImage } from "@/lib/shop/catalog";
import { imageCache } from "@/lib/api/hot-cache";

export const dynamic = "force-dynamic";

/**
 * A stored product photo. The URL carries a version (?v=), so it can be cached for a long time - by the phone and the
 * browser, and for a few minutes in this server's memory so a busy menu does not read the same photo from the database
 * again and again.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ uid: string }> }) {
  const uid = (await ctx.params).uid;
  const img = await imageCache.get(`p:${uid}:${req.nextUrl.searchParams.get("v") ?? ""}`, () => productImage(uid));
  if (!img) return fail(404, "Not found.");
  return new NextResponse(new Uint8Array(img.bytes), {
    headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
