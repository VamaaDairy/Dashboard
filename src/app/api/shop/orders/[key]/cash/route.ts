import { NextResponse, type NextRequest } from "next/server";
import { fail, orderJson, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { getOrderByKey } from "@/lib/shop/orders";
import { switchToCash } from "@/lib/payments/easebuzz";

export const dynamic = "force-dynamic";

/** The customer pays in cash after all: an order awaiting online payment is placed as cash on delivery. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  if (tooMany(req, "order-cash", 10)) return fail(429, "Too many requests. Please wait a minute.");
  const customer = await customerFromRequest(req);
  if (!customer) return fail(401, "Please sign in again.");
  const { key } = await ctx.params;
  const r = await switchToCash(key, customer.id);
  if (!r.ok) return fail(r.status, r.error);
  const order = await getOrderByKey(key);
  return NextResponse.json(orderJson(order!));
}
