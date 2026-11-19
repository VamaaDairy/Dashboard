import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { distFromRequest } from "@/lib/distributor";
import { networkOf } from "@/lib/distributor/network";

export const dynamic = "force-dynamic";

/**
 * The signed-in partner's network (Gaia Distributors app, Account > My network): the customers under it in the
 * hierarchy - a super stockist's distributors and their retailers, a distributor's retailers - each with its orders,
 * value, last order and requirements over ?days= (default 30), per-level totals and the top products.
 */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (!login.firmUid) return fail(403, "Only a distributor or retailer has a network.");
  const n = await networkOf(login.firmUid, Number(req.nextUrl.searchParams.get("days") ?? 30));
  return n ? NextResponse.json(n) : fail(404, "Your firm is not active.");
}
