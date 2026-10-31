import { NextResponse, type NextRequest } from "next/server";
import { periodFrom } from "@/lib/dash/period";
import { csvOf, reportOf } from "@/lib/d2c/reports";

export const dynamic = "force-dynamic";

/** CSV of a D2C sales report for the same period as the page. The proxy has already checked access to /d2c/reports. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const def = reportOf((await ctx.params).kind);
  if (!def) return new NextResponse("Not found", { status: 404 });
  const { from, to } = periodFrom(Object.fromEntries(req.nextUrl.searchParams));
  return new NextResponse(csvOf(def.cols, await def.load(from, to)), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="d2c-${def.key}_${from}_${to}.csv"` },
  });
}
