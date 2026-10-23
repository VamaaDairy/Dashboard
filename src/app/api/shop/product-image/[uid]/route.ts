import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { productImage } from "@/lib/shop/catalog";

export const dynamic = "force-dynamic";

/** A stored product photo. The URL carries a version (?v=), so it can be cached for a long time. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ uid: string }> }) {
  const img = await productImage((await ctx.params).uid);
  if (!img) return fail(404, "Not found.");
  return new NextResponse(new Uint8Array(img.bytes), {
    headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
