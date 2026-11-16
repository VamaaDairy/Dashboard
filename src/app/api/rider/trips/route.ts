import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { riderFromRequest } from "@/lib/shop/rider";
import { transporterTrips } from "@/lib/dispatch";

export const dynamic = "force-dynamic";

/**
 * A transporter's trips (Dashboard: App orders > Dispatch): the one on the road first, then the planned ones, then
 * the last week's finished ones. Each trip has its stops in delivery order with the buyer's address, phone, map pin,
 * what is on the order, and the stop's outcome.
 */
export async function GET(req: NextRequest) {
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  if (rider.kind !== "transporter") return NextResponse.json({ trips: [] });
  return NextResponse.json({ trips: await transporterTrips(rider.id) });
}
