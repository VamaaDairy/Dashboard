import "server-only";
import { query } from "@/lib/db";

/** How a route's trips went lately: trips, average stops, delivered share, average time and km. */
export interface RouteStats { routeId: number; trips: number; avgStops: number | null; delivered: number; done: number; avgMin: number | null; avgDrivenM: number | null }

/** Each route's trips over the last `days` days (cancelled ones left out). */
export async function routeStats(days = 30): Promise<RouteStats[]> {
  return query<RouteStats>(
    `with tr as (
       select t.id, t.route_id, t.status, t.driven_m,
              extract(epoch from (t.ended_at - t.started_at)) / 60 as mins,
              (select count(*) from dist_trip_stop s where s.trip_id = t.id)::int as stops,
              (select count(*) from dist_trip_stop s where s.trip_id = t.id and s.status = 'delivered')::int as delivered,
              (select count(*) from dist_trip_stop s where s.trip_id = t.id and s.status <> 'pending')::int as done
         from dist_trip t
        where t.route_id is not null and t.status <> 'cancelled' and t.trip_date >= (now() at time zone 'Asia/Kolkata')::date - $1::int
     )
     select route_id as "routeId", count(*)::int as trips, round(avg(stops), 1)::float as "avgStops",
            sum(delivered)::int as delivered, sum(done)::int as done,
            (round(avg(mins) filter (where status = 'completed')))::int as "avgMin",
            (round(avg(driven_m) filter (where driven_m is not null)))::int as "avgDrivenM"
       from tr group by route_id`,
    [days],
  );
}
