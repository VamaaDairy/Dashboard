import { NextResponse, type NextRequest } from "next/server";
import { fail, orderJson, tooMany } from "@/lib/shop/api";
import { getOrderByKey } from "@/lib/shop/orders";

export const dynamic = "force-dynamic";

/** One order by its secret access key - how the app shows live status. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  if (tooMany(req, "order-get", 60)) return fail(429, "Too many requests. Please wait a minute.");
  const { key } = await ctx.params;
  const order = await getOrderByKey(key);
  if (!order) return fail(404, "Order not found.");
  return NextResponse.json(orderJson(order));
}
