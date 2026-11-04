import { NextResponse, type NextRequest } from "next/server";
import { fail, orderJson } from "@/lib/shop/api";
import { riderOrders } from "@/lib/shop/orders";
import { riderFromRequest } from "@/lib/shop/rider";
import { planRider, store } from "@/lib/shop/route-plan";

export const dynamic = "force-dynamic";

/**
 * The signed-in rider's orders still to deliver, in the order to deliver them: `stop` is each one's
 * place in the shortest way round, `legM` the metres from the stop before.
 */
export async function GET(req: NextRequest) {
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  await planRider(rider.id).catch((e) => console.error("route plan", e)); // a failed plan still lists the orders
  const orders = await riderOrders(rider.id);
  // the rider types the code the customer reads out; the app never gets to see it
  return NextResponse.json({
    // where orders are collected, marked on the rider's maps
    store: store(),
    orders: orders.map((o) => ({
      ...orderJson(o),
      id: o.id,
      deliveryOtp: undefined,
      stop: o.delivery_seq,
      legM: o.delivery_leg_m,
      // UPI Autopay orders are charged to the customer's bank after delivery: nothing to collect at the door
      // (the rider app treats anything not 'paid' as cash)
      ...(o.payment_method === "autopay" ? { paymentStatus: "paid" } : {}),
    })),
  });
}
