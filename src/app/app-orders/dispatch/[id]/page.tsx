import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RouteMap } from "@/components/shop/RouteMap";
import { AMBER, GREEN, GREY, NAVY, type MapMarker } from "@/components/shop/route-colors";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { dispatchOrders, getTrip, transporters, tripTrack } from "@/lib/dispatch";
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
  const noPin = t.stops.filter((s) => s.lat === null).length;

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
          <RouteMap track={track.segments} markers={markers} live={t.status === "on_the_way"} height="420px" plain />
          {noPin ? <div className="border-t border-border px-4 py-2 text-[12px] text-amber-700 dark:text-amber-400">{noPin} {noPin === 1 ? "stop has" : "stops have"} no map pin; set it on the customer in Customer Masters.</div> : null}
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
                      <span className={s.status === "delivered" ? "font-medium text-emerald-700 dark:text-emerald-400" : s.status === "not_delivered" ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
                        {s.status === "delivered" ? "Delivered" : s.status === "not_delivered" ? "Not delivered" : t.status === "on_the_way" ? "On the way" : "Waiting"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{s.deliveredAt ? at(s.deliveredAt) : "-"}</td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                      {s.receivedBy ? <div>Received by {s.receivedBy}</div> : null}
                      {s.note ? <div>{s.note}</div> : null}
                      {s.gapM !== null ? <div className={s.gapM > 300 ? "text-amber-700 dark:text-amber-400" : ""}>{metres(s.gapM)} from the pin</div> : null}
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
