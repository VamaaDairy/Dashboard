import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { empFromRequest } from "@/lib/employee";
import { teamOf } from "@/lib/employee/team";

export const dynamic = "force-dynamic";

/**
 * Gaia Salesforce app, My team: everyone under the signed-in employee in the reporting line, every level down, with
 * today's attendance, sales day, last position, visits and orders, and orders / revenue / visits over ?days= (default 7).
 */
export async function GET(req: NextRequest) {
  const me = await empFromRequest(req);
  if (!me) return fail(401, "Please sign in again.");
  return NextResponse.json({ members: await teamOf(me.staffUid, Number(req.nextUrl.searchParams.get("days") ?? 7)) });
}
