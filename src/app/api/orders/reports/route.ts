import { NextRequest, NextResponse } from "next/server";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { reportCsv } from "@/lib/orders/insights";

export const dynamic = "force-dynamic";

/** GET /api/orders/reports?key=orders - a report as CSV. /api/* skips the proxy, so sign-in and access are checked here. */
export async function GET(req: NextRequest) {
  const user = await userFromToken(req.cookies.get("session")?.value);
  if (!user) return NextResponse.json({ success: false, error: "Sign in first." }, { status: 401 });
  if (!atLeast(levelFor(user, "orders.reports"), "view")) {
    return NextResponse.json({ success: false, error: "No access." }, { status: 403 });
  }
  const out = await reportCsv(req.nextUrl.searchParams.get("key") ?? "");
  if (!out) return NextResponse.json({ success: false, error: "Unknown report." }, { status: 404 });
  return new NextResponse(out.csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${out.name}"` },
  });
}
