import { NextResponse, type NextRequest } from "next/server";
import { apiCaller, apiError, can, forbidden, unauthorised } from "@/lib/api/access";
import { getSession } from "@/lib/shop/delivery-session";

export const dynamic = "force-dynamic";

/** One delivery session with the rider's track between pickup and handover (the track is kept 90 days). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const caller = await apiCaller(req);
  if (!caller) return unauthorised();
  if (!can(caller, "shop", "view")) return forbidden();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return apiError(404, "No such delivery.");
  const s = await getSession(id);
  return s ? NextResponse.json(s) : apiError(404, "No such delivery.");
}
