import { NextResponse, type NextRequest } from "next/server";
import { fail, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { activeMandate, autopayView } from "@/lib/shop/autopay";
import { packState, raisePack } from "@/lib/shop/packs";

export const dynamic = "force-dynamic";

/**
 * "Try again" after a subscription pack could not be collected: raises the next pack now (it goes to the bank in the
 * evening run). Returns the autopay view.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "autopay-retry", 4)) return fail(429, "Too many attempts. Please wait a minute.");
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  if (!(await activeMandate(c.id))) return fail(409, "Set up autopay first.");
  const st = await packState(c.id);
  if (st.open) return fail(409, "A payment is already on its way.");
  if (!(await raisePack(c.id))) return fail(409, "You have no subscription to pay for.");
  return NextResponse.json(await autopayView(c.id));
}
