"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Navigation, Phone, Signal } from "lucide-react";
import { DispatchMap, type MapLine, type MapPin } from "@/components/shop/DispatchMap";
import { AMBER, GREEN, GREY, NAVY, TRIP_COLOURS } from "@/components/shop/route-colors";
import type { LiveDispatch, LiveTrip } from "@/lib/dispatch/live";
import type { LngLat } from "@/lib/shop/track";
import { cn } from "@/lib/utils";
import { DayStepper, ScreenBox } from "../screen";
import { clock, EmptyState, floating, InlineStats, inr, km, Person, Plate, StatusBadge, StopBar } from "../ui";

const ago = (s: number) => (s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`);
const doneColour = (s: string) => (s === "delivered" ? GREEN : s === "not_delivered" ? AMBER : null);

/** Everything of one trip on the map, to fly to it. */
const pointsOf = (t: LiveTrip): LngLat[] => [
  ...t.planned,
  ...t.track.flat(),
  ...t.stops.flatMap((s) => (s.lat !== null && s.lng !== null ? [[s.lng, s.lat] as LngLat] : [])),
  ...(t.truck ? [[t.truck.lng, t.truck.lat] as LngLat] : []),
];

/**
 * The control tower: the day's trips on one full-width map (each its own colour: the planned road faint, the road
 * driven solid, off-road stretches amber, a dashed line from the truck to its next stop), with the trips in a panel
 * floating on the left. Asks for fresh data every 15 s.
 */
export function LiveBoard({ date, today, initial }: { date: string; today: string; initial: LiveDispatch }) {
  const [data, setData] = useState(initial);
  const [pick, setPick] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ key: string; points: LngLat[] } | null>(null);
  const [stale, setStale] = useState(false);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    let dead = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/dispatch/live?date=${date}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as LiveDispatch;
        if (!dead) { setData(d); setStale(false); }
      } catch {
        if (!dead) setStale(true);
      }
    };
    const t = setInterval(tick, 15_000);
    return () => { dead = true; clearInterval(t); };
  }, [date]);

  const colour = useMemo(() => new Map(data.trips.map((t, i) => [t.id, TRIP_COLOURS[i % TRIP_COLOURS.length]])), [data.trips]);
  // keep the fitted view clear of the floating panel on wide screens
  const fitPadding = useMemo(() => ({ top: 64, right: 72, bottom: 64, left: wide ? 420 : 48 }), [wide]);

  const choose = (id: number | null) => {
    setPick(id);
    const t = data.trips.find((x) => x.id === id);
    setFocus({ key: `${id ?? "all"}-${Date.now()}`, points: t ? pointsOf(t) : data.trips.flatMap(pointsOf) });
  };

  const { lines, pins } = useMemo(() => {
    const lines: MapLine[] = [];
    const pins: MapPin[] = [{ id: "plant", lat: data.plant.lat, lng: data.plant.lng, kind: "pill", color: NAVY, label: "Plant", popup: data.plant.name }];
    for (const t of data.trips) {
      const c = colour.get(t.id)!;
      const dim = pick !== null && pick !== t.id;
      const o = dim ? 0.22 : 1;
      lines.push({ id: `plan-${t.id}`, paths: [t.planned], color: c, width: 5, opacity: 0.28 * o });
      lines.push({ id: `drive-${t.id}`, paths: t.track, color: c, width: 4.5, opacity: o });
      if (t.off.length) lines.push({ id: `off-${t.id}`, paths: t.off, color: AMBER, width: 5, opacity: o });
      if (t.truck && t.next && t.next.lat !== null && t.next.lng !== null) {
        lines.push({ id: `next-${t.id}`, paths: [[[t.truck.lng, t.truck.lat], [t.next.lng, t.next.lat]]], color: c, width: 2.5, opacity: 0.9 * o, dashed: true });
      }
      for (const s of t.stops) {
        if (s.lat === null || s.lng === null) continue;
        const done = doneColour(s.status);
        pins.push({
          id: `s${s.id}`, lat: s.lat, lng: s.lng, kind: "num", label: String(s.seq), color: done ?? c, hollow: !done, dim,
          popup: `${t.route}, stop ${s.seq}: ${s.buyer} · #${s.orderId} · ${s.status === "delivered" ? `delivered ${clock(s.deliveredAt)}` : s.status === "not_delivered" ? `not delivered ${clock(s.deliveredAt)}` : "still to do"}`,
        });
      }
      if (t.truck) {
        pins.push({
          id: `truck-${t.id}`, lat: t.truck.lat, lng: t.truck.lng, kind: "pill", top: true, dim, color: t.truck.seenSecs > 300 ? GREY : c,
          label: `${t.transporter?.name.split(" ")[0] ?? "Truck"}${t.vehicleNo ? ` · ${t.vehicleNo}` : ""}`,
          popup: `${t.transporter ? `${t.transporter.name} · ${t.transporter.phone} · ` : ""}${t.route} · GPS ${ago(t.truck.seenSecs)}`,
        });
      }
    }
    return { lines, pins };
  }, [data, pick, colour]);

  const onPin = (id: string) => {
    const trip = id.startsWith("truck-") ? Number(id.slice(6)) : id.startsWith("s") ? data.trips.find((t) => t.stops.some((s) => `s${s.id}` === id))?.id : undefined;
    if (trip) choose(trip);
  };

  const by = (s: LiveTrip["status"]) => data.trips.filter((t) => t.status === s).length;
  const stops = data.trips.reduce((n, t) => n + t.stops.length, 0);
  const done = data.trips.reduce((n, t) => n + t.done, 0);
  const notDelivered = data.trips.reduce((n, t) => n + t.notDelivered, 0);
  const alerts = data.trips.reduce((n, t) => n + t.alerts.length, 0);

  const list = data.trips.length ? (
    <div className="divide-y divide-border">
      {data.trips.map((t) => <TripCard key={t.id} t={t} colour={colour.get(t.id)!} picked={pick === t.id} onPick={() => choose(pick === t.id ? null : t.id)} />)}
    </div>
  ) : (
    <EmptyState title="No trips for this day" hint="Trips appear here once they are planned." action={<Link href={`/app-orders/dispatch?date=${date}`} className="text-[13px] font-medium text-foreground underline-offset-4 hover:underline">Plan trips</Link>} />
  );

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <InlineStats items={[
          { label: "On the road", value: by("on_the_way") },
          { label: "Not started", value: by("planned") },
          { label: "Completed", value: by("completed") },
          { label: "Stops done", value: `${done}/${stops}` },
          { label: "Not delivered", value: notDelivered, warn: notDelivered > 0 },
          { label: "Need a look", value: alerts, warn: alerts > 0 },
        ]} />
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-tertiary-foreground">
            <span className="relative flex size-2">
              {!stale ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/50" /> : null}
              <span className={cn("relative inline-flex size-2 rounded-full", stale ? "bg-amber-500" : "bg-emerald-500")} />
            </span>
            {stale ? "Reconnecting…" : `Live · ${clock(data.at)}`}
          </span>
          <DayStepper date={date} base="/app-orders/dispatch/live" today={today} />
        </div>
      </div>

      <ScreenBox className="rounded-xl border border-border" button="top-right">
        <DispatchMap lines={lines} pins={pins} focus={focus} onPin={onPin} controls="bottom-right" fitPadding={fitPadding} />
        {/* the trips, floating over the map on wide screens */}
        <aside className={cn(floating, "absolute top-3 bottom-3 left-3 z-10 hidden w-[384px] flex-col overflow-hidden lg:flex")}>
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-[13px] font-semibold">Trips <span className="font-normal tabular-nums text-tertiary-foreground">{data.trips.length}</span></span>
            {pick !== null ? <button type="button" onClick={() => choose(null)} className="text-[12px] text-tertiary-foreground hover:text-foreground">Show all</button> : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        </aside>
        <div className={cn(floating, "pointer-events-none absolute bottom-3 z-10 hidden flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-[11px] text-tertiary-foreground sm:flex", wide ? "left-[408px]" : "left-3")}>
          <span className="inline-flex items-center gap-1.5"><i className="h-1 w-5 rounded-full opacity-35" style={{ background: NAVY }} />Planned road</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-1 w-5 rounded-full" style={{ background: NAVY }} />Driven</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-1 w-5 rounded-full" style={{ background: AMBER }} />Off the plan</span>
          <span className="inline-flex items-center gap-1.5"><i className="w-5 border-t-2 border-dashed" style={{ borderColor: NAVY }} />To the next stop</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: GREEN }} />Delivered</span>
        </div>
      </ScreenBox>

      {/* on narrow screens the trips come under the map */}
      <section className="lg:hidden">{list}</section>
    </div>
  );
}

function TripCard({ t, colour, picked, onPick }: { t: LiveTrip; colour: string; picked: boolean; onPick: () => void }) {
  return (
    <div className={cn("relative transition-colors", picked ? "bg-muted/70" : "hover:bg-muted/40")}>
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: colour }} />
      <button type="button" onClick={onPick} className="block w-full px-4 pt-3 pb-2 text-left">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">{t.route}</span>
          <StatusBadge status={t.status} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Person name={t.transporter?.name} size={24} />
          <Plate no={t.vehicleNo} className="ml-auto" />
        </div>
        <StopBar stops={t.stops} className="mt-3" />
        <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[12px] text-tertiary-foreground tabular-nums">
          <span>{t.delivered}/{t.stops.length} delivered{t.notDelivered ? <span className="text-amber-700"> · {t.notDelivered} not</span> : null}</span>
          <span>{inr(t.deliveredValue)} <span className="opacity-70">of {inr(t.total)}</span></span>
        </div>
        {t.next ? (
          <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-foreground">
            <Navigation className="size-3.5 shrink-0 text-blue-600" />
            <span className="min-w-0 truncate">Next: <span className="font-medium">{t.next.seq}. {t.next.buyer}</span></span>
            {t.next.away ? <span className="ml-auto shrink-0 tabular-nums text-tertiary-foreground">{km(t.next.away.metres)}{t.next.away.road ? "" : " away"}</span> : null}
          </div>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-tertiary-foreground tabular-nums">
          {t.startedAt ? <span>Left {clock(t.startedAt)}{t.endedAt ? ` · back ${clock(t.endedAt)}` : ""}</span> : <span>For {t.date}</span>}
          {t.drivenM ? <span>{km(t.drivenM)} driven{t.plannedRoad && t.plannedM ? ` of ${km(t.plannedM)}` : ""}</span> : t.plannedRoad && t.plannedM ? <span>Plan {km(t.plannedM)}</span> : null}
          {t.truck ? <span className="inline-flex items-center gap-1"><Signal className="size-3" />{ago(t.truck.seenSecs)}</span> : null}
        </div>
        {t.alerts.length ? (
          <ul className="mt-2 space-y-1">
            {t.alerts.map((a) => (
              <li key={`${a.kind}-${a.text}`} className="flex items-start gap-1.5 text-[12px] font-medium text-amber-700">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{a.text}
              </li>
            ))}
          </ul>
        ) : null}
      </button>
      <div className="flex items-center gap-4 px-4 pb-3 text-[12px]">
        <Link href={`/app-orders/dispatch/${t.id}`} className="inline-flex items-center gap-0.5 font-medium text-foreground hover:underline underline-offset-4">Open trip<ArrowUpRight className="size-3.5" /></Link>
        {t.transporter?.phone ? (
          <a href={`tel:${t.transporter.phone}`} className="inline-flex items-center gap-1 text-tertiary-foreground hover:text-foreground"><Phone className="size-3" />Call {t.transporter.name.split(" ")[0]}</a>
        ) : null}
        <span className="ml-auto text-tertiary-foreground">Trip {t.id}</span>
      </div>
    </div>
  );
}
