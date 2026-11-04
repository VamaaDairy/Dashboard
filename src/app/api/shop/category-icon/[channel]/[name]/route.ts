import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { categoryIcon } from "@/lib/products/app-products";

export const dynamic = "force-dynamic";

/** A category's icon by name in the path (older links; names with "&" need the ?c= route). The URL carries a version (?v=), so it can be cached for a long time. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ channel: string; name: string }> }) {
  const { channel, name } = await ctx.params;
  const img = await categoryIcon(channel, decodeURIComponent(name));
  if (!img) return fail(404, "Not found.");
  return new NextResponse(new Uint8Array(img.bytes), {
    headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
