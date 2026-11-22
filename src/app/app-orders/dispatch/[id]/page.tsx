import { PhotoStrip } from "@/components/photos/PhotoStrip";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { dispatchOrders, getTrip, transporters, tripDeviation, tripRoadPath, tripTrack, type Trip } from "@/lib/dispatch";
import { tripTimeline } from "@/lib/dispatch/timeline";
import { cn } from "@/lib/utils";
import { TripStatusPill } from "../board";
import { Refresh } from "../screen";
import { TripEditor } from "./editor";
import { TripView } from "./view";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const at = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "-";
const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
/** No GPS from the truck for over 5 min (or never). */
const lostSince = (iso: string | null) => !iso || Date.now() - new Date(iso).getTime() > 5 * 60_000;

/**
 * One trip on the whole screen: the map (planned road, the road driven, stretches off the plan, stops by outcome, the
 * truck, and a replay of the drive) beside its stops, its timeline and how it went against the plan.
 */
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const t = await getTrip(id);
  if (!t) notFound();
  const [track, road, me, trucks, day] = await Promise.all([
    tripTrack(t), tripRoadPath(t), userFromToken((await cookies()).get("session")?.value), transporters(),
    t.status === "planned" ? dispatchOrders(t.date) : Promise.resolve([]),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "apporders"), "edit");
  const dev = t.startedAt ? tripDeviation(t.stops, road, track.pings) : null;
  const lateAfter = new Map(dev?.outOfOrder.map((o) => [o.seq, o.after]) ?? []);
  const tr = t.transporter;
  const live = t.status === "on_the_way";
  const facts = [
    tr ? `${tr.name} · ${tr.phone}` : "No transporter yet",
    t.vehicleNo,
    t.startedAt ? `left ${at(t.startedAt)}` : null,
    t.endedAt ? `back ${at(t.endedAt)}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-3 md:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={`/app-orders/dispatch?date=${t.date}`} className="text-sm text-muted-foreground hover:text-foreground">← {t.date}</Link>
        <h1 className="text-lg font-semibold">{t.route} · Trip {t.id}</h1>
        <TripStatusPill status={t.status} />
        <span className="text-sm text-muted-foreground">{t.stops.length} stops · {inr(t.total)} · {facts.join(" · ")}</span>
        {live ? <Link href={`/app-orders/dispatch/live?date=${t.date}`} className="ml-auto text-sm font-medium text-primary hover:underline">Live view</Link> : null}
      </div>
      <TripView
        plant={t.origin}
        startedAt={t.startedAt}
        endedAt={t.endedAt}
        stops={t.stops.map((s) => ({ id: s.id, seq: s.seq, orderId: s.orderId, buyer: s.buyer, lat: s.lat, lng: s.lng, status: s.status, deliveredAt: s.deliveredAt, note: s.note }))}
        truck={live && tr && tr.lat != null && tr.lng != null ? { lat: tr.lat, lng: tr.lng, name: tr.name, seenAt: tr.locationAt, lost: lostSince(tr.locationAt) } : null}
        planned={road.path}
        plannedRoad={road.road}
        plannedM={Math.round(road.metres)}
        drivenM={track.metres}
        pings={track.pings.map((p) => [p.lng, p.lat, new Date(p.at).getTime()] as [number, number, number])}
        dev={dev}
        timeline={tripTimeline(t, track.pings)}
        noPin={t.stops.filter((s) => s.lat === null).length}
        stopsPanel={canEdit && t.status === "planned"
          ? <div className="p-3"><TripEditor trip={t} transporters={trucks.filter((x) => x.active)} more={day.filter((o) => o.tripId === null)} /></div>
          : <StopsList t={t} lateAfter={lateAfter} />}
      />
      {live ? <Refresh seconds={20} /> : null}
    </div>
  );
}

/** Each stop: who, where, what goes there, and what happened (with the drop photo). */
function StopsList({ t, lateAfter }: { t: Trip; lateAfter: Map<number, number> }) {
  return (
    <ul className="divide-y divide-border">
      {t.stops.map((s) => (
        <li key={s.id} className="flex gap-3 px-4 py-3">
          <span className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
            s.status === "delivered" ? "bg-primary text-primary-foreground" : s.status === "not_delivered" ? "bg-amber-600 text-white" : "border border-border text-muted-foreground",
          )}>{s.seq}</span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 truncate font-medium">{s.buyer}</span>
              <span className="num ml-auto shrink-0 text-sm">{inr(s.total)}</span>
            </div>
            <div className="text-[12px] text-muted-foreground">{s.address ?? ""}{s.phone ? ` · ${s.phone}` : ""}</div>
            <div className="text-[12px]">
              <Link href={`/app-orders/distributors/${s.orderUid}`} className="hover:underline">#{s.orderId}</Link>
              <span className="text-muted-foreground"> · {s.lines.map((l) => `${l.qty} ${l.name}`).join(", ") || `${s.items} items · ${s.qty} pcs`}</span>
            </div>
            <div className={cn("text-[12px] font-medium", s.status === "delivered" ? "text-primary" : s.status === "not_delivered" ? "text-amber-700" : "text-muted-foreground")}>
              {s.status === "delivered" ? `Delivered ${at(s.deliveredAt)}` : s.status === "not_delivered" ? `Not delivered ${at(s.deliveredAt)}` : t.status === "on_the_way" ? "Still to do" : "Waiting"}
            </div>
            {lateAfter.has(s.seq) ? <div className="text-[12px] text-amber-700">Done after stop {lateAfter.get(s.seq)}</div> : null}
            {s.status === "delivered" ? (
              <div className={cn("text-[12px]", s.proof ? "text-muted-foreground" : "text-amber-700")}>
                {s.proof === "code+photo" ? "Proof: delivery code + photo" : s.proof === "code" ? "Proof: delivery code" : s.proof === "photo" ? "Proof: photo" : "No proof (older app)"}
              </div>
            ) : null}
            {s.receivedBy ? <div className="text-[12px] text-muted-foreground">Received by {s.receivedBy}</div> : null}
            {s.note ? <div className="text-[12px] text-muted-foreground">{s.note}</div> : null}
            {s.gapM !== null ? <div className={cn("text-[12px]", s.gapM > 300 ? "text-amber-700" : "text-muted-foreground")}>Marked {metres(s.gapM)} from the pin</div> : null}
            {s.lat === null ? <div className="text-[12px] text-amber-700">No map pin: set it on the customer in Customer Masters</div> : null}
            {/* the transporter's photo of the drop (proof when the code was not entered) */}
            <PhotoStrip kind="delivery_trade" refId={s.orderUid} />
          </div>
        </li>
      ))}
    </ul>
  );
}
