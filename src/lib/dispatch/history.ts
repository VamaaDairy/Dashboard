import "server-only";
import { query } from "@/lib/db";
import { olaEnabled } from "@/lib/shop/ola";
import { pingsBetween, toTrack } from "@/lib/shop/track";
import { tripDeviation } from "./deviation";
import { getTrip, tripRoadPath, type TripStatus } from "./index";

/** One trip in the Trips list and the reports. */
export interface TripRow {
  id: number;
  date: string;
  route: string;
  status: TripStatus;
  transporterId: number | null;
  transporter: string | null;
  vehicleNo: string | null;
  stops: number;
  delivered: number;
  notDelivered: number;
  /** closed by End trip without the truck getting there */
  notVisited: number;
  value: number;
  deliveredValue: number;
  startedAt: string | null;
  endedAt: string | null;
  minutes: number | null;
  /** worked out once the trip has ended (null until then) */
  drivenM: number | null;
  plannedM: number | null;
  overPlanM: number | null;
  offRoadM: number | null;
}

export interface TripFilter { from: string; to: string; status?: TripStatus | null; transporterId?: number | null; route?: string | null; q?: string | null }

/**
 * Works out the distances of ended trips that do not have them yet (a few at a time, so a page never waits long): km
 * driven from the GPS, the planned road (Ola), km over it and off it. A trip whose road plan could not be had by road
 * keeps numbers_at empty and is tried again next time.
 */
export async function ensureTripNumbers(from: string, to: string, max = 10): Promise<void> {
  const ids = await query<{ id: number }>(
    `select id from dist_trip where status = 'completed' and numbers_at is null and trip_date between $1 and $2 order by trip_date desc, id desc limit $3`,
    [from, to, max],
  );
  for (const { id } of ids) {
    const t = await getTrip(id);
    if (!t) continue;
    const [road, pings] = await Promise.all([
      tripRoadPath(t),
      t.transporter && t.startedAt ? pingsBetween(t.transporter.id, t.startedAt, t.endedAt ?? new Date()) : Promise.resolve([]),
    ]);
    const dev = t.startedAt ? tripDeviation(t.stops, road, pings) : null;
    const settled = road.road || !olaEnabled() || !t.stops.some((s) => s.lat !== null);
    await query(
      `update dist_trip set driven_m = $2, planned_m = $3, over_plan_m = $4, off_road_m = $5, numbers_at = case when $6::boolean then now() else null end where id = $1`,
      [id, toTrack(pings).metres, road.road ? Math.round(road.metres) : null, dev?.overPlanM ?? null, dev?.checked ? dev.offM : null, settled],
    );
  }
}

/** Trips over a period, newest first, with their stops counted and their distances (filling in any missing ones first). */
export async function tripsBetween(f: TripFilter): Promise<TripRow[]> {
  await ensureTripNumbers(f.from, f.to);
  const q = f.q?.trim() || null;
  const rows = await query<Omit<TripRow, "minutes">>(
    `select t.id, t.trip_date::text as date, t.route_name as route, t.status, t.transporter_id as "transporterId", r.name as transporter,
            t.vehicle_no as "vehicleNo",
            count(s.id)::int as stops,
            (count(*) filter (where s.status = 'delivered'))::int as delivered,
            (count(*) filter (where s.status = 'not_delivered' and coalesce(s.note, '') <> 'Not visited'))::int as "notDelivered",
            (count(*) filter (where s.status = 'not_delivered' and s.note = 'Not visited'))::int as "notVisited",
            coalesce(sum(b.total_cost), 0)::float as value,
            coalesce(sum(b.total_cost) filter (where s.status = 'delivered'), 0)::float as "deliveredValue",
            t.started_at as "startedAt", t.ended_at as "endedAt",
            t.driven_m as "drivenM", t.planned_m as "plannedM", t.over_plan_m as "overPlanM", t.off_road_m as "offRoadM"
       from dist_trip t
       left join shop_rider r on r.id = t.transporter_id
       left join dist_trip_stop s on s.trip_id = t.id
       left join fp_booking_order b on b.uid = s.order_uid
      where t.trip_date between $1 and $2
        and ($3::text is null or t.status = $3)
        and ($4::int is null or t.transporter_id = $4)
        and ($5::text is null or t.route_name = $5)
        and ($6::text is null or t.route_name ilike '%' || $6 || '%' or r.name ilike '%' || $6 || '%' or t.vehicle_no ilike '%' || $6 || '%'
             or t.id::text = $6
             or exists (select 1 from dist_trip_stop x join fp_booking_order bx on bx.uid = x.order_uid join fp_firm fx on fx.uid = bx.from_firm_uid
                         where x.trip_id = t.id and (fx.name ilike '%' || $6 || '%' or bx.order_id::text = $6)))
      group by t.id, r.name
      order by t.trip_date desc, t.id desc
      limit 2000`,
    [f.from, f.to, f.status ?? null, f.transporterId ?? null, f.route ?? null, q],
  );
  return rows.map((r) => {
    const startedAt = r.startedAt ? new Date(r.startedAt).toISOString() : null;
    const endedAt = r.endedAt ? new Date(r.endedAt).toISOString() : null;
    return {
      ...r,
      value: Math.round(r.value),
      deliveredValue: Math.round(r.deliveredValue),
      startedAt,
      endedAt,
      minutes: startedAt && endedAt ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000) : null,
    };
  });
}

/** Who and which routes the filters can pick from: the transporters and the route names of trips in the period. */
export async function tripChoices(from: string, to: string): Promise<{ transporters: Array<{ id: number; name: string }>; routes: string[] }> {
  const [transporters, routes] = await Promise.all([
    query<{ id: number; name: string }>(`select id, name from shop_rider where kind = 'transporter' order by active desc, name`),
    query<{ route: string }>(`select distinct route_name as route from dist_trip where trip_date between $1 and $2 order by 1`, [from, to]),
  ]);
  return { transporters, routes: routes.map((r) => r.route) };
}
