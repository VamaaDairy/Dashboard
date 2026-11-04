import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { fail, orderJson, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { getOrderByKey, listCustomerOrdersBetween } from "@/lib/shop/orders";

export const dynamic = "force-dynamic";

const MAX_INVOICE_DAYS = 366;
const dayOf = (s: string | null) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s ? null : t;
};

/**
 * The signed-in customer's orders: placed from their account or with their mobile number, newest first (up to 50).
 * With ?from=YYYY-MM-DD&to=YYYY-MM-DD (for an invoice): every order in those dates, oldest first, and no cap.
 */
export async function GET(req: NextRequest) {
  if (tooMany(req, "customer-orders", 30)) return fail(429, "Too many requests. Please wait a minute.");
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");

  const params = req.nextUrl.searchParams;
  if (params.has("from") || params.has("to")) {
    const from = params.get("from"), to = params.get("to");
    const a = dayOf(from), b = dayOf(to);
    if (a === null || b === null || a > b) return fail(400, "Please choose valid dates.");
    if ((b - a) / 86_400_000 >= MAX_INVOICE_DAYS) return fail(400, "Please choose up to one year at a time.");
    const rows = await listCustomerOrdersBetween(c.id, c.phone, from!, to!);
    return NextResponse.json({ from, to, orders: rows.map((o) => ({ ...orderJson(o), billDay: o.bill_day })) });
  }

  const found = await query<{ access_key: string }>(
    `select access_key from shop_order where customer_id = $1 or phone = $2 order by created_at desc limit 50`,
    [c.id, c.phone],
  );
  const orders = (await Promise.all(found.map((f) => getOrderByKey(f.access_key)))).filter((o) => o !== null);
  return NextResponse.json({ orders: orders.map((o) => orderJson(o!)) });
}
