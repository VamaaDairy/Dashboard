import { NextRequest, NextResponse } from "next/server";
import { toCsv } from "@/lib/masters/csv";
import { readRequest } from "@/lib/masters/request";
import { exportMaster } from "@/lib/masters/repository";
import { MASTERS } from "@/lib/masters/schemas";

export const dynamic = "force-dynamic";

/**
 * CSV of a master screen with the same search / filters as the page. The proxy
 * has already checked the signed-in user can open /orders/<slug>.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const def = MASTERS[slug];
  if (!def) return new NextResponse("Not found", { status: 404 });

  const rows = await exportMaster(def, readRequest(def, Object.fromEntries(req.nextUrl.searchParams)));
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(def, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}_${stamp}.csv"`,
    },
  });
}
