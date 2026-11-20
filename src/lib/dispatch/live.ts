import "server-only";
import { haversine } from "@/lib/shop/route-plan";
import { pingsBetween, toTrack, type LngLat, type Ping } from "@/lib/shop/track";
import { distanceToPath, OFF_ROAD_M, tripDeviation } from "./deviation";
import { liveTrips, plant, tripRoadPath, truckAway, type StopStatus, type Trip, type TripStatus } from "./index";

/** One trip as the Live view shows it: the plan, the drive so far, where the truck is and what needs a look. */
export interface LiveTrip {
  id: number;
  date: string;
  route: string;
  status: TripStatus;
  vehicleNo: string | null;
  transporter: { name: string; phone: string } | null;
  /** the truck while the trip is on the road (its phone's last position) */
  truck: { lat: number; lng: number; at: string; seenSecs: number } | null;
  startedAt: string | null;
  endedAt: string | null;
  stops: Array<{ id: number; seq: number; orderId: number; buyer: string; lat: number | null; lng: number | null; status: StopStatus; deliveredAt: string | null; total: number }>;
  /** the stop the truck is heading for, and how far it is (by road when Ola could say) */
  next: { seq: number; buyer: string; lat: number | null; lng: number | null; away: { metres: number; road: boolean } | null } | null;
  planned: LngLat[];
  plannedRoad: boolean;
  plannedM: number;
  track: LngLat[][];
  drivenM: number;
  off: LngLat[][];
  alerts: Array<{ kind: "signal" | "off" | "still" | "order"; text: string }>;
  done: number;
  delivered: number;
  notDelivered: number;
  total: number;
  deliveredValue: number;
}

export interface LiveDispatch { date: string; at: string; plant: { name: string; lat: number; lng: number }; trips: LiveTrip[] }

const MIN = 60_000;
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/** A drawn line thinned to about `max` points (each stretch keeps its ends), so the view stays quick to send every 15 s. */
function thin(segs: LngLat[][], max = 900): LngLat[][] {
  const n = segs.reduce((s, x) => s + x.length, 0);
  if (n <= max) return segs;
  const k = Math.ceil(n / max);
  return segs.map((s) => s.filter((_, i) => i % k === 0 || i === s.length - 1));
}

async function liveTrip(t: Trip, now: number): Promise<LiveTrip> {
  const road = await tripRoadPath(t);
  const tr = t.transporter;
  const started = t.status !== "planned" && !!tr && !!t.startedAt;
  const pings: Ping[] = started ? await pingsBetween(tr!.id, t.startedAt!, t.endedAt ?? new Date(now)) : [];
  const track = toTrack(pings);
  const dev = started ? tripDeviation(t.stops, road, pings) : null;

  const seenAt = tr?.locationAt ? new Date(tr.locationAt).getTime() : null;
  const truck = t.status === "on_the_way" && tr && tr.lat != null && tr.lng != null && seenAt !== null
    ? { lat: tr.lat, lng: tr.lng, at: new Date(seenAt).toISOString(), seenSecs: Math.max(0, Math.round((now - seenAt) / 1000)) }
    : null;
  const nextStop = t.status === "on_the_way" ? (t.stops.find((s) => s.status === "pending") ?? null) : null;
  const away = truck && nextStop && nextStop.lat !== null && nextStop.lng !== null
    ? await truckAway(t.id, truck, { lat: nextStop.lat, lng: nextStop.lng })
    : null;

  const alerts: LiveTrip["alerts"] = [];
  if (t.status === "on_the_way") {
    if (!truck) alerts.push({ kind: "signal", text: "No GPS from the phone yet" });
    else if (truck.seenSecs > 5 * 60) alerts.push({ kind: "signal", text: `No GPS for ${Math.round(truck.seenSecs / 60)} min` });
    const last = pings[pings.length - 1];
    if (last && road.road && road.path.length > 1) {
      const d = distanceToPath(road.path, [last.lng, last.lat]);
      if (d > OFF_ROAD_M) alerts.push({ kind: "off", text: `Off the planned road now: ${km(d)} away` });
    }
    // standing still: every position of the last 20 min within 100 m of the latest one, and no stop done meanwhile
    if (last && t.startedAt && now - new Date(t.startedAt).getTime() >= 20 * MIN) {
      const recent = pings.filter((p) => now - new Date(p.at).getTime() <= 20 * MIN);
      const covered = recent.length > 1 && now - new Date(recent[0].at).getTime() >= 17 * MIN;
      const doneLately = t.stops.some((s) => s.deliveredAt && now - new Date(s.deliveredAt).getTime() <= 20 * MIN);
      if (covered && !doneLately && recent.every((p) => haversine(p, last) <= 100)) alerts.push({ kind: "still", text: "Standing still for over 20 min" });
    }
  }
  if (dev?.outOfOrder.length) alerts.push({ kind: "order", text: dev.outOfOrder.map((o) => `Stop ${o.seq} done after stop ${o.after}`).join(", ") });

  const delivered = t.stops.filter((s) => s.status === "delivered");
  return {
    id: t.id,
    date: t.date,
    route: t.route,
    status: t.status,
    vehicleNo: t.vehicleNo,
    transporter: tr ? { name: tr.name, phone: tr.phone } : null,
    truck,
    startedAt: t.startedAt,
    endedAt: t.endedAt,
    stops: t.stops.map((s) => ({ id: s.id, seq: s.seq, orderId: s.orderId, buyer: s.buyer, lat: s.lat, lng: s.lng, status: s.status, deliveredAt: s.deliveredAt, total: s.total })),
    next: nextStop ? { seq: nextStop.seq, buyer: nextStop.buyer, lat: nextStop.lat, lng: nextStop.lng, away } : null,
    planned: road.path,
    plannedRoad: road.road,
    plannedM: Math.round(road.metres),
    track: thin(track.segments),
    drivenM: track.metres,
    off: dev?.off ?? [],
    alerts,
    done: t.stops.filter((s) => s.status !== "pending").length,
    delivered: delivered.length,
    notDelivered: t.stops.filter((s) => s.status === "not_delivered").length,
    total: t.total,
    deliveredValue: Math.round(delivered.reduce((s, x) => s + x.total, 0)),
  };
}

/** Every trip of the day (and any still on the road from another day), for the Live view. */
export async function liveDispatch(date: string): Promise<LiveDispatch> {
  const now = Date.now();
  const trips = await liveTrips(date);
  return { date, at: new Date(now).toISOString(), plant: plant(), trips: await Promise.all(trips.map((t) => liveTrip(t, now))) };
}
