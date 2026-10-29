import { NextResponse, type NextRequest } from "next/server";
import { fail, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { startPayment } from "@/lib/payments/easebuzz";

export const dynamic = "force-dynamic";

/**
 * Starts (or retries) the Easebuzz payment of the signed-in customer's order that is awaiting payment.
 * Returns { accessKey, mode } - the app opens the Easebuzz checkout with them.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  if (tooMany(req, "order-pay", 10)) return fail(429, "Too many requests. Please wait a minute.");
  const customer = await customerFromRequest(req);
  if (!customer) return fail(401, "Please sign in again to pay.");
  const { key } = await ctx.params;
  const r = await startPayment(key, customer.id);
  if (!r.ok) return fail(r.status, r.error);
  return NextResponse.json({ accessKey: r.accessKey, mode: r.mode });
}
