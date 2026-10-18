import { NextResponse, type NextRequest } from "next/server";
import { fail, orderJson, readJson, tooMany } from "@/lib/shop/api";
import { getOrderByKey, placeOrder } from "@/lib/shop/orders";
import { parseOrderBody } from "@/lib/shop/validate";

export const dynamic = "force-dynamic";

/**
 * The app places an order. Body:
 *   { name, phone, address, pincode?, notes?, lines: [{ sku, qty }] }
 * Prices are always taken from the database, never from the app.
 * Returns 201 with the order (including `accessKey`, which the app keeps to look the order up again).
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "order", 10)) return fail(429, "Too many requests. Please wait a minute.");
  const body = await readJson(req);
  if (body === null) return fail(400, "Send a JSON body of at most 20 KB.");

  const parsed = parseOrderBody(body);
  if (!parsed.ok) return fail(400, parsed.error, parsed.fields);

  const r = await placeOrder(parsed.input);
  if (!r.ok) return fail(409, r.error);

  const order = await getOrderByKey(r.accessKey);
  return NextResponse.json(orderJson(order!), { status: 201 });
}
