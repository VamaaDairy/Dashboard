"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Truck } from "lucide-react";
import { DispatchMap, type MapLine, type MapPin } from "@/components/shop/DispatchMap";
import { AMBER, GREEN, GREY, NAVY, TRIP_COLOURS } from "@/components/shop/route-colors";
import type { LiveDispatch, LiveTrip } from "@/lib/dispatch/live";
import type { LngLat } from "@/lib/shop/track";
import { cn } from "@/lib/utils";
import { TripStatusPill } from "../board";
import { DayStepper, ScreenBox } from "../screen";

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }) : "");
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
 * The control tower: the day's trips on one full-screen map (each its own colour: the planned road faint, the road
 * driven solid, off-road stretches amber, a dashed line from the truck to its next stop) and a card per trip with what
 * needs a look. Asks for fresh data every 15 s.
 */
export function LiveBoard({ date, initial }: { date: string; initial: LiveDispatch }) {
  const [data, setData] = useState(initial);
  const [pick, setPick] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ key: string; points: LngLat[] } | null>(null);
  const [stale, setStale] = useState(false);

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

  const choose = (id: number | null) => {
    setPick(id);
    const t = data.trips.find((x) => x.id === id);
    const pts = t ? pointsOf(t) : data.trips.flatMap(pointsOf);
    setFocus({ key: `${id ?? "all"}-${Date.now()}`, points: pts });
  };

  const { lines, pins } = useMemo(() => {
    const lines: MapLine[] = [];
    const pins: MapPin[] = [{ id: "plant", lat: data.plant.lat, lng: data.plant.lng, kind: "pill", color: NAVY, label: "Plant", popup: data.plant.name }];
    for (const t of data.trips) {
      const c = colour.get(t.id)!;
      const dim = pick !== null && pick !== t.id;
      const o = dim ? 0.25 : 1;
      lines.push({ id: `plan-${t.id}`, paths: [t.planned], color: c, width: 4, opacity: 0.35 * o });
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
          popup: `${t.route}, stop ${s.seq}\n${s.buyer} · #${s.orderId}\n${s.status === "delivered" ? `Delivered ${clock(s.deliveredAt)}` : s.status === "not_delivered" ? `Not delivered ${clock(s.deliveredAt)}` : "Still to do"}`,
        });
      }
      if (t.truck) {
        pins.push({
          id: `truck-${t.id}`, lat: t.truck.lat, lng: t.truck.lng, kind: "pill", top: true, dim, color: t.truck.seenSecs > 300 ? GREY : c,
          label: `${t.transporter?.name.split(" ")[0] ?? "Truck"}${t.vehicleNo ? ` · ${t.vehicleNo}` : ""}`,
          popup: `${t.transporter ? `${t.transporter.name} · ${t.transporter.phone}\n` : ""}${t.route} · GPS ${ago(t.truck.seenSecs)}`,
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
  const counters: Array<[string, string, boolean?]> = [
    ["On the road", String(by("on_the_way"))],
    ["Not started", String(by("planned"))],
    ["Completed", String(by("completed"))],
    ["Stops done", `${done}/${stops}`],
    ["Not delivered", String(notDelivered), notDelivered > 0],
    ["Need a look", String(alerts), alerts > 0],
  ];

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-3 md:px-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {counters.map(([l, v, warn]) => (
          <span key={l} className="text-muted-foreground">{l} <b className={cn("num text-foreground", warn && "text-amber-700")}>{v}</b></span>
        ))}
        <span className="ml-auto text-[12px] text-muted-foreground">{stale ? "Could not refresh, trying again" : `Updated ${clock(data.at)} · every 15 s`}</span>
        <DayStepper date={date} base="/app-orders/dispatch/live" />
      </div>

      <ScreenBox className="rounded-xl border border-border">
        <div className="grid h-full grid-rows-[3fr_2fr] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1">
          <div className="relative min-h-0">
            <DispatchMap lines={lines} pins={pins} focus={focus} onPin={onPin} />
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-background/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
              <span className="inline-flex items-center gap-1.5"><i className="h-1 w-5 rounded-full opacity-40" style={{ background: NAVY }} />Planned road</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-1 w-5 rounded-full" style={{ background: NAVY }} />Driven</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-1 w-5 rounded-full" style={{ background: AMBER }} />Off the planned road</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-5 border-t-2 border-dashed" style={{ borderColor: NAVY }} />To the next stop</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: GREEN }} />Delivered</span>
            </div>
          </div>
          <aside className="min-h-0 overflow-y-auto border-t border-border lg:border-t-0 lg:border-l">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[12px] text-muted-foreground">
              <span>{data.trips.length} {data.trips.length === 1 ? "trip" : "trips"}</span>
              {pick !== null ? <button type="button" onClick={() => choose(null)} className="font-medium text-primary hover:underline">Show all</button> : null}
            </div>
            {data.trips.length ? (
              data.trips.map((t) => <TripCard key={t.id} t={t} colour={colour.get(t.id)!} picked={pick === t.id} onPick={() => choose(pick === t.id ? null : t.id)} />)
            ) : (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                <Truck className="mx-auto mb-2 size-6" />No trips for this day.{" "}
                <Link href={`/app-orders/dispatch?date=${date}`} className="font-medium text-primary hover:underline">Plan them</Link>
              </div>
            )}
          </aside>
        </div>
      </ScreenBox>
    </div>
  );
}

function TripCard({ t, colour, picked, onPick }: { t: LiveTrip; colour: string; picked: boolean; onPick: () => void }) {
  const pct = t.stops.length ? (t.done / t.stops.length) * 100 : 0;
  return (
    <div className={cn("border-b border-border px-4 py-3", picked && "bg-muted/60")}>
      <button type="button" onClick={onPick} className="w-full text-left">
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: colour }} />
          <span className="min-w-0 truncate font-semibold">{t.route}</span>
          <TripStatusPill status={t.status} />
          <span className="ml-auto shrink-0 text-[12px] text-muted-foreground">Trip {t.id}</span>
        </div>
        <div className="mt-1 text-[13px] text-muted-foreground">
          {t.transporter ? t.transporter.name : "No transporter yet"}{t.vehicleNo ? ` · ${t.vehicleNo}` : ""}{t.date ? ` · for ${t.date}` : ""}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colour }} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
          <span>{t.delivered}/{t.stops.length} delivered{t.notDelivered ? `, ${t.notDelivered} not` : ""}</span>
          <span>{inr(t.deliveredValue)} of {inr(t.total)}</span>
          {t.drivenM ? <span>{km(t.drivenM)} driven</span> : null}
          {t.plannedRoad && t.plannedM ? <span>plan {km(t.plannedM)}</span> : null}
          {t.startedAt ? <span>left {clock(t.startedAt)}</span> : null}
          {t.endedAt ? <span>back {clock(t.endedAt)}</span> : null}
        </div>
        {t.next ? (
          <div className="mt-1.5 text-[13px]">
            Next: <span className="font-medium">{t.next.seq}. {t.next.buyer}</span>
            {t.next.away ? <span className="text-muted-foreground"> · {km(t.next.away.metres)}{t.next.away.road ? " by road" : " away"}</span> : null}
          </div>
        ) : null}
        {t.truck ? <div className="text-[12px] text-muted-foreground">GPS {ago(t.truck.seenSecs)}</div> : null}
        {t.alerts.map((a) => (
          <div key={`${a.kind}-${a.text}`} className="mt-1 flex items-start gap-1.5 text-[12px] font-medium text-amber-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{a.text}
          </div>
        ))}
      </button>
      <div className="mt-2 flex gap-4 text-[12px]">
        <Link href={`/app-orders/dispatch/${t.id}`} className="font-medium text-primary hover:underline">Open trip</Link>
        {t.transporter?.phone ? <a href={`tel:${t.transporter.phone}`} className="text-muted-foreground hover:text-foreground">Call {t.transporter.name.split(" ")[0]}</a> : null}
      </div>
    </div>
  );
}
