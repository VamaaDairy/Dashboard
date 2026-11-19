import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { empFromRequest } from "@/lib/employee";
import { inTeam, memberDay } from "@/lib/employee/team";

export const dynamic = "force-dynamic";

/** One team member's day (?date=YYYY-MM-DD, default today): the route on the map, store visits and orders. Only someone under the signed-in employee. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ uid: string }> }) {
  const me = await empFromRequest(req);
  if (!me) return fail(401, "Please sign in again.");
  const uid = (await ctx.params).uid;
  if (!/^[0-9a-f-]{36}$/i.test(uid) || !(await inTeam(me.staffUid, uid))) return fail(404, "This person is not in your team.");
  return NextResponse.json(await memberDay(uid, req.nextUrl.searchParams.get("date")));
}
