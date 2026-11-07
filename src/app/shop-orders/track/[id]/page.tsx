import Link from "next/link";
import { notFound } from "next/navigation";
import { Route as RouteIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RouteMap } from "@/components/shop/RouteMap";
import { AMBER, GREEN, GREY, NAVY, type MapMarker } from "@/components/shop/route-colors";
import { orderTrack, type Track } from "@/lib/shop/track";
import { STATUS_LABEL } from "@/lib/shop/pricing";

export const dynamic = "force-dynamic";

const time = (s: string | null) =>
  s ? new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const km = (m: number) => `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`;
const mins = (from: string | null, to: string | null) => {
  if (!from || !to) return "—";
  const m = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

const ridden = (t: Track | null) => (t && t.points ? `${km(t.metres)}` : "—");

export default async function OrderTrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = Number.isInteger(Number(id)) ? await orderTrack(Number(id)) : null;
  if (!t) notFound();
  const { order: o, rider, trip, leg, planned } = t;

  const markers: MapMarker[] = [{ ...t.store, label: "House of Gaia", color: GREEN, popup: `${t.store.name}: pick-up` }];
  t.drops.forEach((d, i) => markers.push({ lng: d.lng, lat: d.lat, label: `${i + 1}. ${d.orderNo.slice(-4)}`, color: GREY, popup: `${d.orderNo} · ${d.name}\nDelivered ${time(d.at)}` }));
  if (o.lat != null && o.lng != null) markers.push({ lng: o.lng, lat: o.lat, label: `This order ${o.orderNo.slice(-4)}`, color: AMBER, popup: `${o.orderNo} · ${o.name}\n${o.address}` });
  const last = trip?.segments.at(-1)?.at(-1);
  if (t.live && last) markers.push({ lng: last[0], lat: last[1], label: `🏍 ${rider?.name.split(" ")[0] ?? "Rider"}`, color: "#111827", popup: `Last position ${time(trip!.to)}` });

  const reason = !rider
    ? "This order has no rider yet."
    : !o.pickedUpAt
      ? "The rider hasn't picked this order up yet: the route starts at pick-up."
      : !trip?.points
        ? "No route was recorded for this trip: it was ridden before tracking started, or the rider's phone was off duty or offline."
        : null;
  const day = o.pickedUpAt ? new Date(new Date(o.pickedUpAt).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10) : null;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={RouteIcon}
          title={`Delivery route · ${o.orderNo}`}
          subtitle={`${o.name} · ${o.address}`}
          actions={
            <div className="flex gap-2">
              {rider && day ? <Link href={`/shop-orders/riders/${rider.id}?day=${day}`} className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">{rider.name}&apos;s day</Link> : null}
              <Link href="/shop-orders" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Orders</Link>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Rider" value={rider?.name ?? "Not assigned"} sub={rider?.phone} />
          <Stat label="Status" value={STATUS_LABEL[o.status] ?? o.status} sub={t.live ? "Live: updates every 20 s" : undefined} />
          <Stat label="Picked up" value={time(o.pickedUpAt)} sub={o.assignedAt ? `Assigned ${time(o.assignedAt)}` : undefined} />
          <Stat label="Delivered" value={o.deliveredAt ? time(o.deliveredAt) : t.live ? "On the way" : "—"} sub={o.pickedUpAt ? `${mins(o.pickedUpAt, o.deliveredAt ?? trip?.to ?? null)} after pick-up` : undefined} />
          <Stat label="This order's leg (ridden)" value={ridden(leg)} sub={t.legFrom ? `from ${t.legFrom.orderNo} · ${mins(leg?.from ?? null, leg?.to ?? null)}` : leg?.points ? `from pick-up · ${mins(leg.from, leg.to)}` : undefined} />
          <Stat label="Planned route" value={planned ? km(planned.metres) : "—"} sub={planned ? `about ${Math.round(planned.secs / 60)} min by road` : undefined} />
        </div>
        {reason ? <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{reason}</div> : null}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span><i className="mr-1 inline-block h-1.5 w-5 rounded" style={{ background: GREEN }} />This order&apos;s leg</span>
          <span><i className="mr-1 inline-block h-1.5 w-5 rounded" style={{ background: NAVY }} />Whole trip from pick-up{trip?.points ? ` (${km(trip.metres)})` : ""}</span>
          <span><i className="mr-1 inline-block h-0 w-5 border-t-2 border-dashed" style={{ borderColor: GREY }} />Planned road route</span>
          <span>Dotted navy: no signal for a while (joined straight)</span>
          {trip?.points ? <span className="ml-auto">{trip.points} positions · {time(trip.from)} to {time(trip.to)}</span> : null}
        </div>
        <RouteMap track={trip?.segments ?? []} highlight={leg?.segments ?? []} planned={planned?.path} markers={markers} live={t.live} />
        {t.drops.length ? (
          <div className="rounded-lg border border-border">
            <div className="border-b border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-muted-foreground">Delivered earlier on this trip</div>
            {t.drops.map((d, i) => (
              <Link key={d.orderId} href={`/shop-orders/track/${d.orderId}`} className="flex justify-between border-t border-border px-3 py-2 text-sm first:border-t-0 hover:bg-muted/40">
                <span>{i + 1}. <span className="font-mono text-xs">{d.orderNo}</span> · {d.name}</span>
                <span className="text-muted-foreground">{time(d.at)}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
