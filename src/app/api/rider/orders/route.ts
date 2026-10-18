import { NextResponse, type NextRequest } from "next/server";
import { fail, orderJson } from "@/lib/shop/api";
import { riderOrders } from "@/lib/shop/orders";
import { riderFromRequest } from "@/lib/shop/rider";

export const dynamic = "force-dynamic";

/** The signed-in rider's orders still to deliver. */
export async function GET(req: NextRequest) {
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  const orders = await riderOrders(rider.id);
  // the rider types the code the customer reads out; the app never gets to see it
  return NextResponse.json({ orders: orders.map((o) => ({ ...orderJson(o), id: o.id, deliveryOtp: undefined })) });
}
