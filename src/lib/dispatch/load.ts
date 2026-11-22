import "server-only";
import { query } from "@/lib/db";
import { packOf } from "@/lib/distributor/packs";
import type { TripStatus } from "./index";

/**
 * Load sheet (Dispatch > Load sheet, and the transporter's trip in the Gaia Delivery app): what goes on each vehicle -
 * every product of the orders on its trip, added up, in whole crates / boxes and loose pieces, and the day's total
 * across the trips. Counted from the order lines as they stand, so a change to an order before the truck leaves shows.
 */

export interface LoadLine {
  sku: string;
  name: string;
  /** total pieces */
  qty: number;
  /** the product's pack (CRT, BOX ...) and pieces in one; null when sold by the piece only */
  pack: { unit: string; per: number; base: string } | null;
  /** whole packs, and the pieces left over */
  packs: number;
  loose: number;
  /** how many of the trip's orders have it */
  orders: number;
}

export interface TripLoad {
  id: number;
  route: string;
  status: TripStatus;
  vehicleNo: string | null;
  transporter: string | null;
  stops: number;
  lines: LoadLine[];
}

type Row = { trip: number; sku: string; name: string; qty: number; orders: number; primary_unit: unknown; secondary_units: unknown };

function line(r: Omit<Row, "trip">): LoadLine {
  const pack = packOf(r.primary_unit, r.secondary_units);
  const packs = pack ? Math.floor(r.qty / pack.per) : 0;
  return { sku: r.sku, name: r.name, qty: r.qty, pack, packs, loose: pack ? r.qty - packs * pack.per : r.qty, orders: r.orders };
}

/** The products on each of [tripIds], biggest first. Stops already marked not delivered are left out. */
export async function loadsOf(tripIds: number[]): Promise<Map<number, LoadLine[]>> {
  const out = new Map<number, LoadLine[]>(tripIds.map((id) => [id, []]));
  if (!tripIds.length) return out;
  const rows = await query<Row>(
    `select s.trip_id as trip, p.sku_code as sku, p.sku_name as name, sum(i.quantity)::float as qty,
            count(distinct s.order_uid)::int as orders, p.primary_unit, p.secondary_units
       from dist_trip_stop s
       join fp_booking_order_item i on i.booking_order_uid = s.order_uid
       join fp_product p on p.uid = i.product_uid
      where s.trip_id = any($1::int[]) and s.status <> 'not_delivered'
      group by s.trip_id, p.sku_code, p.sku_name, p.primary_unit, p.secondary_units
      having sum(i.quantity) > 0
      order by s.trip_id, sum(i.quantity) desc, p.sku_name`,
    [tripIds],
  );
  for (const r of rows) out.get(r.trip)?.push(line(r));
  return out;
}

/** Every trip of [date] that is not cancelled, with its load. */
export async function loadSheet(date: string): Promise<TripLoad[]> {
  const trips = await query<Omit<TripLoad, "lines">>(
    `select t.id, t.route_name as route, t.status, t.vehicle_no as "vehicleNo", r.name as transporter,
            (select count(*)::int from dist_trip_stop s where s.trip_id = t.id) as stops
       from dist_trip t left join shop_rider r on r.id = t.transporter_id
      where t.trip_date = $1::date and t.status <> 'cancelled'
      order by t.route_name, t.id`,
    [date],
  );
  const loads = await loadsOf(trips.map((t) => t.id));
  return trips.map((t) => ({ ...t, lines: loads.get(t.id) ?? [] }));
}

/** The day's total across the trips, product by product. */
export function dayTotal(trips: TripLoad[]): LoadLine[] {
  const by = new Map<string, LoadLine>();
  for (const t of trips) {
    for (const l of t.lines) {
      const x = by.get(l.sku);
      if (!x) by.set(l.sku, { ...l });
      else {
        x.qty += l.qty;
        x.orders += l.orders;
      }
    }
  }
  return [...by.values()]
    .map((l) => {
      const packs = l.pack ? Math.floor(l.qty / l.pack.per) : 0;
      return { ...l, packs, loose: l.pack ? l.qty - packs * l.pack.per : l.qty };
    })
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
}
