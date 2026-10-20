import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { levelFor, atLeast } from "@/lib/access";
import { grnImage } from "@/lib/grn/data";

export const dynamic = "force-dynamic";

/** A GRN photo. The proxy skips /api, so the sign-in and the GRN access are checked here. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "grn"), "view")) return new NextResponse("Not allowed", { status: 403 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse("Not found", { status: 404 });
  const img = await grnImage(id);
  if (!img) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(img.bytes), {
    headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=86400" },
  });
}
