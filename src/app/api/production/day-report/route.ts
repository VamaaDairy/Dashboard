import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { dayReportData } from "@/lib/production/day-report";

export const dynamic = "force-dynamic";

/**
 * One day's rows for the Day report PDF on Production > Daily batches: ?date=YYYY-MM-DD. A GET rather than a server
 * action, so people who can only view Production can print it too. The proxy skips /api, so sign-in and access are
 * checked here.
 */
export async function GET(req: NextRequest) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "production"), "view")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Give a date as YYYY-MM-DD" }, { status: 400 });
  return NextResponse.json(await dayReportData(date));
}
