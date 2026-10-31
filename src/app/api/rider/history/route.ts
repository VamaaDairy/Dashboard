import { NextResponse, type NextRequest } from "next/server";
import { one, query } from "@/lib/db";
import { fail } from "@/lib/shop/api";
import { riderFromRequest } from "@/lib/shop/rider";

export const dynamic = "force-dynamic";

interface Row { day: string; order_no: string; name: string; address: string; total: number; delivered_at: Date; items: number; cod: boolean; pay: number; rating: number | null }

/**
 * The signed-in rider's finished work, newest day first (India time, last 60 days): per day how many
 * deliveries, how much cash was collected (cash-on-delivery orders only) and what they earned, with the
 * orders themselves. `rate` is what one delivery pays them now.
 */
export async function GET(req: NextRequest) {
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");

  const rows = await query<Row>(
    `select to_char(o.delivered_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as day,
            o.order_no, o.name, o.address, o.total, o.delivered_at,
            o.payment_method = 'cod' as cod, coalesce(o.rider_pay, 0) as pay, o.rider_rating as rating,
            (select coalesce(sum(i.qty), 0)::int from shop_order_item i where i.order_id = o.id) as items
       from shop_order o
      where o.rider_id = $1 and o.status = 'delivered' and o.delivered_at > now() - interval '60 days'
      order by o.delivered_at desc
      limit 1000`,
    [rider.id],
  );

  const round = (n: number) => Math.round(n * 100) / 100;
  const km = new Map(
    (await query<{ day: string; metres: number }>(
      `select to_char(day, 'YYYY-MM-DD') as day, metres from shop_rider_km where rider_id = $1 and day > (now() at time zone 'Asia/Kolkata')::date - 60`,
      [rider.id],
    )).map((r) => [r.day, Number(r.metres)]),
  );
  const days = new Map<string, { day: string; count: number; cash: number; pay: number; km: number; orders: unknown[] }>();
  // days ridden without a delivery still count their km
  for (const [day, metres] of km) days.set(day, { day, count: 0, cash: 0, pay: 0, km: round(metres / 1000), orders: [] });
  for (const r of rows) {
    const d = days.get(r.day) ?? { day: r.day, count: 0, cash: 0, pay: 0, km: round((km.get(r.day) ?? 0) / 1000), orders: [] };
    d.count++;
    if (r.cod) d.cash = round(d.cash + Number(r.total));
    d.pay = round(d.pay + Number(r.pay));
    d.orders.push({
      orderNo: r.order_no, name: r.name, address: r.address, total: Number(r.total), items: r.items,
      deliveredAt: new Date(r.delivered_at).toISOString(), cod: r.cod, pay: Number(r.pay), rating: r.rating,
    });
    days.set(r.day, d);
  }
  // what customers think of them, over all their rated deliveries
  const stars = await one<{ avg: number | null; count: number }>(
    `select round(avg(rider_rating)::numeric, 1)::float as avg, count(rider_rating)::int as count from shop_order where rider_id = $1 and rider_rating is not null`,
    [rider.id],
  );
  const list = [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
  return NextResponse.json({ rate: Number(rider.pay_per_delivery ?? 0), rating: stars?.avg ?? null, ratings: stars?.count ?? 0, days: list });
}
