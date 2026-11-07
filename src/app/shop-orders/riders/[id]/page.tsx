import Link from "next/link";
import { notFound } from "next/navigation";
import { Bike, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RouteMap } from "@/components/shop/RouteMap";
import { AMBER, GREEN, NAVY, type MapMarker } from "@/components/shop/route-colors";
import { riderDay, todayIST } from "@/lib/shop/track";

export const dynamic = "force-dynamic";

const clock = (s: string | null) => (s ? new Date(s).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "—");
const shift = (day: string, by: number) => new Date(Date.parse(`${day}T00:00:00Z`) + by * 86400_000).toISOString().slice(0, 10);
const long = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export default async function RiderDayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const [{ id }, { day: d }] = await Promise.all([params, searchParams]);
  const today = todayIST();
  const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && d <= today ? d : today;
  const r = Number.isInteger(Number(id)) ? await riderDay(Number(id), day) : null;
  if (!r) notFound();
  const { track } = r;

  const markers: MapMarker[] = [{ ...r.store, label: "House of Gaia", color: GREEN, popup: `${r.store.name}: pick-up` }];
  r.drops.forEach((s, i) => markers.push({ lng: s.lng, lat: s.lat, label: `${i + 1} · ${clock(s.at)}`, color: NAVY, popup: `${s.orderNo} · ${s.name}\nDelivered ${clock(s.at)}` }));
  r.open.forEach((s) => markers.push({ lng: s.lng, lat: s.lat, label: `To deliver ${s.orderNo.slice(-4)}`, color: AMBER, popup: `${s.orderNo} · ${s.name}` }));
  const last = track.segments.at(-1)?.at(-1);
  if (r.today && last) markers.push({ lng: last[0], lat: last[1], label: `🏍 ${r.rider.name.split(" ")[0]} · ${clock(track.to)}`, color: "#111827", popup: `Last position ${clock(track.to)}` });

  const events = [
    ...r.pickups.map((p) => ({ at: p.at, text: <>Picked up <span className="font-mono text-xs">{p.orderNo}</span> at House of Gaia</>, href: null as string | null })),
    ...r.drops.map((s, i) => ({ at: s.at!, text: <>Drop {i + 1}: delivered <span className="font-mono text-xs">{s.orderNo}</span> to {s.name}</>, href: `/shop-orders/track/${s.orderId}` })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const nav = "inline-flex h-8 items-center gap-1 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted";
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Bike}
          title={`${r.rider.name} · ${long(day)}`}
          subtitle={`${r.rider.kind === "transporter" ? `Transporter${r.rider.vehicleNo ? ` ${r.rider.vehicleNo}` : ""}` : "Delivery boy"} · ${r.rider.phone}. The route ridden while on duty that day, and every drop.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href={`/shop-orders/riders/${r.rider.id}?day=${shift(day, -1)}`} className={nav}><ChevronLeft className="h-4 w-4" />Previous day</Link>
              {day < today ? <Link href={`/shop-orders/riders/${r.rider.id}?day=${shift(day, 1)}`} className={nav}>Next day<ChevronRight className="h-4 w-4" /></Link> : null}
              <form className="flex gap-1">
                <input type="date" name="day" defaultValue={day} max={today} className="h-8 rounded-lg border border-input bg-background px-2 text-sm" />
                <button className={nav}>Go</button>
              </form>
              <Link href="/shop-orders/riders" className={nav}>Riders</Link>
              <Link href="/shop-orders/live" className={nav}>Live map</Link>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Deliveries" value={r.drops.length} sub={r.today && r.open.length ? `${r.open.length} still to deliver` : undefined} />
          <Stat label="Ridden (drawn route)" value={`${(track.metres / 1000).toFixed(1)} km`} sub={`${r.kmCounted.toFixed(1)} km counted live`} />
          <Stat label="On duty (first to last position)" value={track.points ? `${clock(track.from)} – ${clock(track.to)}` : "—"} sub={track.points ? `${track.points} positions` : undefined} />
          <Stat label="Pick-ups" value={r.pickups.length} sub={r.pickups[0] ? `first at ${clock(r.pickups[0].at)}` : undefined} />
        </div>
        {!track.points ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No route recorded on this day: the rider wasn&apos;t on duty, the phone was offline, or it was before tracking started.
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span><i className="mr-1 inline-block h-1.5 w-5 rounded" style={{ background: NAVY }} />Route ridden</span>
          <span>Dotted: no signal for a while (joined straight)</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: NAVY }} />Drop (number · time)</span>
          {r.today ? <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: AMBER }} />Still to deliver</span> : null}
          {r.today ? <span className="ml-auto">Today: updates every 20 s</span> : null}
        </div>
        <RouteMap track={track.segments} markers={markers} live={r.today} height="60vh" />
        <div className="rounded-lg border border-border">
          <div className="border-b border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-muted-foreground">The day, in order</div>
          {events.length ? events.map((e, i) =>
            e.href ? (
              <Link key={i} href={e.href} className="flex gap-3 border-t border-border px-3 py-2 text-sm first:border-t-0 hover:bg-muted/40">
                <span className="w-12 shrink-0 text-muted-foreground">{clock(e.at)}</span><span>{e.text}</span><span className="ml-auto text-xs text-primary">Route →</span>
              </Link>
            ) : (
              <div key={i} className="flex gap-3 border-t border-border px-3 py-2 text-sm first:border-t-0">
                <span className="w-12 shrink-0 text-muted-foreground">{clock(e.at)}</span><span>{e.text}</span>
              </div>
            ),
          ) : <div className="px-3 py-6 text-center text-sm text-muted-foreground">No pick-ups or deliveries on this day.</div>}
        </div>
      </div>
    </div>
  );
}
