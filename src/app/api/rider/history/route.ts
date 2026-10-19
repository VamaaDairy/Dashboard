import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { fail } from "@/lib/shop/api";
import { riderFromRequest } from "@/lib/shop/rider";

export const dynamic = "force-dynamic";

interface Row { day: string; order_no: string; name: string; address: string; total: number; delivered_at: Date; items: number }

/**
 * The signed-in rider's finished work, newest day first (India time, last 60 days):
 * per day how many deliveries and how much cash was collected, with the orders themselves.
 */
export async function GET(req: NextRequest) {
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");

  const rows = await query<Row>(
    `select to_char(o.delivered_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as day,
            o.order_no, o.name, o.address, o.total, o.delivered_at,
            (select coalesce(sum(i.qty), 0)::int from shop_order_item i where i.order_id = o.id) as items
       from shop_order o
      where o.rider_id = $1 and o.status = 'delivered' and o.delivered_at > now() - interval '60 days'
      order by o.delivered_at desc
      limit 1000`,
    [rider.id],
  );

  const days = new Map<string, { day: string; count: number; cash: number; orders: unknown[] }>();
  for (const r of rows) {
    const d = days.get(r.day) ?? { day: r.day, count: 0, cash: 0, orders: [] };
    d.count++;
    d.cash = Math.round((d.cash + Number(r.total)) * 100) / 100;
    d.orders.push({ orderNo: r.order_no, name: r.name, address: r.address, total: Number(r.total), items: r.items, deliveredAt: new Date(r.delivered_at).toISOString() });
    days.set(r.day, d);
  }
  return NextResponse.json({ days: [...days.values()] });
}
