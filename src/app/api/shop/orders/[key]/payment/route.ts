import { NextResponse, type NextRequest } from "next/server";
import { fail, orderJson, tooMany } from "@/lib/shop/api";
import { getOrderByKey } from "@/lib/shop/orders";
import { checkPayment } from "@/lib/payments/easebuzz";

export const dynamic = "force-dynamic";

/**
 * After the Easebuzz checkout closes: our server asks Easebuzz how the payment went (never the phone's word)
 * and returns the order - paid and placed, or still awaiting payment.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  if (tooMany(req, "order-pay-check", 30)) return fail(429, "Too many requests. Please wait a minute.");
  const { key } = await ctx.params;
  const r = await checkPayment(key);
  if (!r.ok) return fail(r.status, r.error);
  const order = await getOrderByKey(key);
  if (!order) return fail(404, "Order not found.");
  return NextResponse.json(orderJson(order));
}
