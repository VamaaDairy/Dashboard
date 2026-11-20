import { PhotoStrip } from "@/components/photos/PhotoStrip";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PLAN_SOLID, RouteMap } from "@/components/shop/RouteMap";
import type { LngLat } from "@/lib/shop/track";
import { AMBER, GREEN, GREY, NAVY, type MapMarker } from "@/components/shop/route-colors";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { OFF_ROAD_M, dispatchOrders, getTrip, transporters, tripDeviation, tripRoadPath, tripTrack } from "@/lib/dispatch";
import { TripStatusPill } from "../board";
import { TripEditor } from "./editor";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const at = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "-";
const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

/** One trip: its stops in order with what happened at each and when, and the truck's road on the map. */
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const t = await getTrip(id);
  if (!t) notFound();
  const [track, me, trucks, day] = await Promise.all([
    tripTrack(t), userFromToken((await cookies()).get("session")?.value), transporters(),
    t.status === "planned" ? dispatchOrders(t.date) : Promise.resolve([]),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "apporders"), "edit");

  const markers: MapMarker[] = t.stops.flatMap((s) => (s.lat !== null && s.lng !== null
    ? [{ lat: s.lat, lng: s.lng, label: `${s.seq}. ${s.buyer}`, color: s.status === "delivered" ? GREEN : s.status === "not_delivered" ? AMBER : GREY,
        popup: `#${s.orderId} · ${s.status.replace("_", " ")}${s.deliveredAt ? ` · ${at(s.deliveredAt)}` : ""}` }]
    : []));
  const tr = t.transporter;
  if (t.status === "on_the_way" && tr?.lat != null && tr?.lng != null) markers.push({ lat: tr.lat, lng: tr.lng, label: `${tr.name}${t.vehicleNo ? ` · ${t.vehicleNo}` : ""}`, color: NAVY });
  // the plant the truck sets out from, and the planned way round: plant, then the stops in their order
  markers.unshift({ lat: t.origin.lat, lng: t.origin.lng, label: "Plant", color: NAVY, popup: t.origin.name });
  // by road through the stops in their order (Ola Maps; straight lines when it can't say)
  const road = await tripRoadPath(t);
  const planned: LngLat[] = road.path;
  const noPin = t.stops.filter((s) => s.lat === null).length;
  // how the drive went against the plan: km to the last stop, stretches off the planned road, stops out of order
  const dev = t.startedAt ? tripDeviation(t.stops, road, track.pings) : null;
  const lateAfter = new Map(dev?.outOfOrder.map((o) => [o.seq, o.after]) ?? []);
  const facts: Array<[string, React.ReactNode]> = [];
  if (dev) {
    const amber = (s: string) => <span className="font-medium text-amber-700">{s}</span>;
    const plain = (s: string) => <span className="font-medium text-foreground">{s}</span>;
    if (dev.afterM !== null) {
      const o = dev.overPlanM;
      facts.push(["Driven to the last stop", <>{plain(metres(dev.roundM))}{o === null ? null : <> (plan {metres(Math.round(road.metres))}, {o > 0 ? amber(`${metres(o)} more`) : plain(o < 0 ? `${metres(-o)} less` : "as planned")})</>}</>]);
      if (dev.afterM > 0) facts.push(["After the last stop", plain(metres(dev.afterM))]);
    }
    if (dev.checked) {
      facts.push(["Off the planned road", dev.off.length
        ? amber(`${dev.off.length} ${dev.off.length === 1 ? "stretch" : "stretches"} · ${metres(dev.offM)} · up to ${metres(dev.maxOffM)} away`)
        : plain("none")]);
    }
    if (dev.visited > 1) {
      facts.push(["Stop order", dev.outOfOrder.length ? amber(dev.outOfOrder.map((o) => `stop ${o.seq} after stop ${o.after}`).join(", ")) : plain("as planned")]);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Truck}
          title={`${t.route} · Trip ${t.id}`}
          subtitle={<span className="inline-flex flex-wrap items-center gap-2"><TripStatusPill status={t.status} /> Delivery on {t.date} · {t.stops.length} stops · {inr(t.total)}</span>}
          actions={<Link href={`/app-orders/dispatch?date=${t.date}`} className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">All trips</Link>}
        />

        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["Transporter", tr ? `${tr.name} · ${tr.phone}` : "Not assigned"],
            ["Vehicle", t.vehicleNo ?? "-"],
            ["Left", at(t.startedAt)],
            [t.endedAt ? "Back" : "Distance so far", t.endedAt ? `${at(t.endedAt)} · ${metres(track.metres)}` : track.metres ? metres(track.metres) : "-"],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-[12px] text-muted-foreground">{l}</div>
              <div className="mt-0.5 truncate text-sm font-semibold">{v}</div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <RouteMap track={track.segments} off={dev?.off} planned={planned} solid markers={markers} live={t.status === "on_the_way"} height="420px" plain />
          {/* what the two lines are: the planned road route and the road the truck actually took (its phone's GPS) */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 py-2 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-2"><span className="h-1 w-6 rounded-full" style={{ background: PLAN_SOLID }} />Planned{road.road ? ` by road: ${metres(road.metres)}` : " (straight lines)"}</span>
            <span className="inline-flex items-center gap-2"><span className="h-1 w-6 rounded-full" style={{ background: NAVY }} />Driven{track.metres ? `: ${metres(track.metres)}` : t.startedAt ? "" : " (once the trip starts)"}</span>
            {dev?.off.length ? <span className="inline-flex items-center gap-2"><span className="h-1 w-6 rounded-full" style={{ background: AMBER }} />Off the planned road (over {OFF_ROAD_M} m)</span> : null}
          </div>
          {facts.length ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 py-2 text-[12px] text-muted-foreground">
              {facts.map(([l, v]) => <span key={l}>{l}: {v}</span>)}
            </div>
          ) : null}
          {noPin ? <div className="border-t border-border px-4 py-2 text-[12px] text-muted-foreground">{noPin} {noPin === 1 ? "stop has" : "stops have"} no map pin; set it on the customer in Customer Masters.</div> : null}
        </div>

        {canEdit && t.status === "planned" ? (
          <TripEditor trip={t} transporters={trucks.filter((x) => x.active)} more={day.filter((o) => o.tripId === null)} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[12px] text-muted-foreground">
                <tr>{["#", "Customer", "Order", "Value", "Outcome", "When", "Details"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {t.stops.map((s) => (
                  <tr key={s.id} className="border-t border-border align-top">
                    <td className="num px-3 py-2.5 text-muted-foreground">{s.seq}</td>
                    <td className="px-3 py-2.5"><div className="font-medium">{s.buyer}</div><div className="text-[12px] text-muted-foreground">{s.address ?? ""}{s.phone ? ` · ${s.phone}` : ""}</div></td>
                    <td className="px-3 py-2.5"><Link href={`/app-orders/distributors/${s.orderUid}`} className="hover:underline">#{s.orderId}</Link><div className="text-[12px] text-muted-foreground">{s.items} items · {s.qty} pcs</div></td>
                    <td className="num px-3 py-2.5">{inr(s.total)}</td>
                    <td className="px-3 py-2.5">
                      <span className={s.status === "delivered" ? "font-medium text-primary" : s.status === "not_delivered" ? "font-medium text-muted-foreground" : "text-muted-foreground"}>
                        {s.status === "delivered" ? "Delivered" : s.status === "not_delivered" ? "Not delivered" : t.status === "on_the_way" ? "On the way" : "Waiting"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{s.deliveredAt ? at(s.deliveredAt) : "-"}</td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                      {lateAfter.has(s.seq) ? <div className="text-amber-700">Done after stop {lateAfter.get(s.seq)}</div> : null}
                      {s.receivedBy ? <div>Received by {s.receivedBy}</div> : null}
                      {s.note ? <div>{s.note}</div> : null}
                      {/* the transporter's optional photo of the drop */}
                      <PhotoStrip kind="delivery_trade" refId={s.orderUid} />
                      {s.gapM !== null ? <div className={s.gapM > 300 ? "text-muted-foreground" : ""}>{metres(s.gapM)} from the pin</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
