import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { riderPickup } from "@/lib/shop/orders";
import { riderFromRequest } from "@/lib/shop/rider";

export const dynamic = "force-dynamic";

/** Rider has the parcel and is heading to the customer. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !(await riderPickup(rider.id, id))) return fail(404, "This order is not on your list.");
  return NextResponse.json({ ok: true });
}
