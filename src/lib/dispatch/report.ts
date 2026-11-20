import "server-only";
import { query } from "@/lib/db";
import { tripsBetween, type TripRow } from "./history";
import type { StopStatus } from "./index";

/** How the trips went over a period: the totals, and each chart's series ready to draw. */
export interface DispatchReport {
  from: string;
  to: string;
  totals: {
    trips: number; stops: number; delivered: number; notDelivered: number; notVisited: number; deliveredPct: number | null;
    value: number; deliveredValue: number; drivenM: number; offRoadM: number;
    avgStops: number | null; avgTripMin: number | null; avgStopMin: number | null;
  };
  days: string[];
  /** per day: [delivered, not delivered (or not visited)] */
  byDay: Record<string, number[]>;
  tripsPerDay: Record<string, number>;
  reasons: Array<{ label: string; value: number }>;
  byRoute: Array<{ route: string; delivered: number; notDone: number; value: number }>;
  /** delivered stops per route per day */
  routeDays: Array<{ route: string; cells: Record<string, number> }>;
  /** marked stops by the hour of the day (India time) */
  byHour: number[];
  byTransporter: Array<{ name: string; trips: number; stops: number; delivered: number; pct: number | null; drivenM: number; kmTrips: number; minPerStop: number | null; offRoadM: number; last: string }>;
}

type StopRow = { date: string; route: string; status: StopStatus; note: string | null; at: Date | null; value: number };

/** Every day from `from` to `to` (at most 400). */
function dayList(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); out.length < 400; d.setUTCDate(d.getUTCDate() + 1)) {
    const s = d.toISOString().slice(0, 10);
    if (s > to) break;
    out.push(s);
  }
  return out;
}

const NOT_VISITED = "Not visited";
const istHour = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).getUTCHours();

export async function dispatchReport(from: string, to: string): Promise<DispatchReport> {
  const [all, stops] = await Promise.all([
    tripsBetween({ from, to }),
    query<StopRow>(
      `select t.trip_date::text as date, t.route_name as route, s.status, s.note, s.delivered_at as at, coalesce(b.total_cost, 0)::float as value
         from dist_trip_stop s join dist_trip t on t.id = s.trip_id join fp_booking_order b on b.uid = s.order_uid
        where t.trip_date between $1 and $2 and t.status <> 'cancelled'`,
      [from, to],
    ),
  ]);
  const trips = all.filter((t) => t.status !== "cancelled");
  const done = (t: TripRow) => t.delivered + t.notDelivered + t.notVisited;
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const ended = trips.filter((t) => t.status === "completed" && t.minutes !== null);

  const delivered = sum(trips.map((t) => t.delivered));
  const notDelivered = sum(trips.map((t) => t.notDelivered));
  const notVisited = sum(trips.map((t) => t.notVisited));
  const marked = delivered + notDelivered + notVisited;
  const stopCount = sum(trips.map((t) => t.stops));

  const days = dayList(from, to);
  const byDay: Record<string, number[]> = {};
  const tripsPerDay: Record<string, number> = {};
  for (const d of days) { byDay[d] = [0, 0]; tripsPerDay[d] = 0; }
  for (const t of trips) tripsPerDay[t.date] = (tripsPerDay[t.date] ?? 0) + 1;

  const reasons = new Map<string, number>();
  const routes = new Map<string, { delivered: number; notDone: number; value: number; cells: Record<string, number> }>();
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const s of stops) {
    const r = routes.get(s.route) ?? { delivered: 0, notDone: 0, value: 0, cells: {} };
    routes.set(s.route, r);
    if (s.status === "delivered") {
      byDay[s.date] ??= [0, 0];
      byDay[s.date][0]++;
      r.delivered++;
      r.value += s.value;
      r.cells[s.date] = (r.cells[s.date] ?? 0) + 1;
    } else if (s.status === "not_delivered") {
      byDay[s.date] ??= [0, 0];
      byDay[s.date][1]++;
      r.notDone++;
      const why = s.note?.trim() || "No reason given";
      reasons.set(why, (reasons.get(why) ?? 0) + 1);
    }
    // when stops were marked: the truck's own working hours (End trip's "Not visited" are left out)
    if (s.status !== "pending" && s.at && s.note !== NOT_VISITED) byHour[istHour(new Date(s.at))]++;
  }

  const people = new Map<string, TripRow[]>();
  for (const t of trips) {
    const k = t.transporter ?? "No transporter";
    people.set(k, [...(people.get(k) ?? []), t]);
  }

  return {
    from,
    to,
    totals: {
      trips: trips.length,
      stops: stopCount,
      delivered,
      notDelivered,
      notVisited,
      deliveredPct: marked ? Math.round((delivered / marked) * 1000) / 10 : null,
      value: sum(trips.map((t) => t.value)),
      deliveredValue: sum(trips.map((t) => t.deliveredValue)),
      drivenM: sum(trips.map((t) => t.drivenM ?? 0)),
      offRoadM: sum(trips.map((t) => t.offRoadM ?? 0)),
      avgStops: trips.length ? Math.round((stopCount / trips.length) * 10) / 10 : null,
      avgTripMin: ended.length ? Math.round(sum(ended.map((t) => t.minutes!)) / ended.length) : null,
      avgStopMin: sum(ended.map(done)) ? Math.round(sum(ended.map((t) => t.minutes!)) / sum(ended.map(done))) : null,
    },
    days,
    byDay,
    tripsPerDay,
    reasons: [...reasons].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    byRoute: [...routes].map(([route, r]) => ({ route, delivered: r.delivered, notDone: r.notDone, value: Math.round(r.value) })).sort((a, b) => b.delivered + b.notDone - (a.delivered + a.notDone)),
    routeDays: [...routes].map(([route, r]) => ({ route, cells: r.cells })).sort((a, b) => a.route.localeCompare(b.route)),
    byHour,
    byTransporter: [...people].map(([name, ts]) => {
      const e = ts.filter((t) => t.status === "completed" && t.minutes !== null);
      const stopsDone = sum(e.map(done));
      const dlv = sum(ts.map((t) => t.delivered));
      const mk = sum(ts.map(done));
      const kmTrips = ts.filter((t) => t.drivenM !== null).length;
      return {
        name,
        trips: ts.length,
        stops: sum(ts.map((t) => t.stops)),
        delivered: dlv,
        pct: mk ? Math.round((dlv / mk) * 1000) / 10 : null,
        drivenM: sum(ts.map((t) => t.drivenM ?? 0)),
        kmTrips,
        minPerStop: stopsDone ? Math.round(sum(e.map((t) => t.minutes!)) / stopsDone) : null,
        offRoadM: sum(ts.map((t) => t.offRoadM ?? 0)),
        last: ts.map((t) => t.date).sort().at(-1)!,
      };
    }).sort((a, b) => b.trips - a.trips),
  };
}
