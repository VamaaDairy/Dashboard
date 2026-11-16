import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { categoryIcon } from "@/lib/products/app-products";
import { imageCache } from "@/lib/api/hot-cache";

export const dynamic = "force-dynamic";

/**
 * A category's icon from Product Master: ?c=<category name>&v=<version>. Cached for long (and for a few minutes in
 * this server's memory): the version changes with the icon.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ channel: string }> }) {
  const name = req.nextUrl.searchParams.get("c") ?? "";
  const channel = (await ctx.params).channel;
  const img = name ? await imageCache.get(`c:${channel}:${name}:${req.nextUrl.searchParams.get("v") ?? ""}`, () => categoryIcon(channel, name)) : null;
  if (!img) return fail(404, "Not found.");
  return new NextResponse(new Uint8Array(img.bytes), {
    headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
