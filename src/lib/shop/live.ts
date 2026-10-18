"use server";

import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";

export interface LiveRider { id: number; name: string; phone: string; lat: number; lng: number; seenSecondsAgo: number; open: number }
export interface LiveOrder { id: number; orderNo: string; name: string; address: string; lat: number; lng: number; status: string; rider: string | null }
export interface Live { riders: LiveRider[]; orders: LiveOrder[] }

/** Every active rider with a recent position, and every undelivered order that has a map pin. Polled by the live map. */
export async function liveSnapshot(): Promise<Live | null> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "shop"), "view")) return null;
  const riders = await query<LiveRider>(
    `select r.id, r.name, r.phone, r.lat, r.lng, extract(epoch from now() - r.location_at)::int as "seenSecondsAgo",
       (select count(*)::int from shop_order o where o.rider_id = r.id and o.status in ('confirmed', 'out_for_delivery')) as open
     from shop_rider r where r.active and r.lat is not null and r.location_at > now() - interval '30 minutes'`,
  );
  const orders = await query<LiveOrder>(
    `select o.id, o.order_no as "orderNo", o.name, o.address, o.lat, o.lng, o.status, r.name as rider
     from shop_order o left join shop_rider r on r.id = o.rider_id
     where o.lat is not null and o.status in ('placed', 'confirmed', 'out_for_delivery') order by o.created_at`,
  );
  return { riders, orders };
}
