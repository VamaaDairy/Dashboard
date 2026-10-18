import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { fail, orderJson, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { getOrderByKey } from "@/lib/shop/orders";

export const dynamic = "force-dynamic";

/** The signed-in customer's orders: placed from their account or with their mobile number, newest first (up to 50). */
export async function GET(req: NextRequest) {
  if (tooMany(req, "customer-orders", 30)) return fail(429, "Too many requests. Please wait a minute.");
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");

  const found = await query<{ access_key: string }>(
    `select access_key from shop_order where customer_id = $1 or phone = $2 order by created_at desc limit 50`,
    [c.id, c.phone],
  );
  const orders = (await Promise.all(found.map((f) => getOrderByKey(f.access_key)))).filter((o) => o !== null);
  return NextResponse.json({ orders: orders.map((o) => orderJson(o!)) });
}
