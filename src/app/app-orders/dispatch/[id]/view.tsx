"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { DispatchMap, type MapLine, type MapPin } from "@/components/shop/DispatchMap";
import { AMBER, GREEN, GREY, NAVY } from "@/components/shop/route-colors";
import { PLAN_SOLID } from "@/components/shop/RouteMap";
import type { TripDeviation } from "@/lib/dispatch/deviation";
import type { TimelineRow } from "@/lib/dispatch/timeline";
import type { LngLat } from "@/lib/shop/track";
import { cn } from "@/lib/utils";
import { ScreenBox } from "../screen";

type Stop = { id: number; seq: number; orderId: number; buyer: string; lat: number | null; lng: number | null; status: "pending" | "delivered" | "not_delivered"; deliveredAt: string | null; note: string | null };
/** [lng, lat, time in ms] */
type Ping = [number, number, number];

// where the drawn road breaks, as the server draws it (src/lib/shop/track.ts: 3 min or 1 km between two positions)
const GAP_MS = 180_000;
const GAP_M = 1000;
const SPEEDS = [10, 30, 60, 120];

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const clock = (v: string | number | null) => (v === null ? "" : new Date(v).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }));
const clockS = (v: number) => new Date(v).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit" });
const ms = (v: string) => new Date(v).getTime();
const apart = (a: Ping, b: Ping) => Math.hypot((a[0] - b[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110_574);

export function TripView(p: {
  plant: { name: string; lat: number; lng: number };
  startedAt: string | null;
  endedAt: string | null;
  stops: Stop[];
  /** the truck now (a trip on the road); lost: no GPS from it for over 5 min */
  truck: { lat: number; lng: number; name: string; seenAt: string | null; lost: boolean } | null;
  planned: LngLat[];
  plannedRoad: boolean;
  plannedM: number;
  drivenM: number;
  pings: Ping[];
  dev: TripDeviation | null;
  timeline: TimelineRow[];
  noPin: number;
  /** the Stops tab, made on the server (it carries the drop photos), or the editor for a planned trip */
  stopsPanel: React.ReactNode;
}) {
  const { pings, dev } = p;
  const [tab, setTab] = useState<"stops" | "timeline" | "deviation">("stops");
  const [focus, setFocus] = useState<{ key: string; points: LngLat[] } | null>(null);
  const [replay, setReplay] = useState<{ t: number; playing: boolean } | null>(null);
  const [speed, setSpeed] = useState(60);
  const t0 = pings.length ? pings[0][2] : null;
  const t1 = pings.length ? pings[pings.length - 1][2] : null;

  // play: move the clock on four times a second
  useEffect(() => {
    if (!replay?.playing || t1 === null) return;
    const id = setInterval(() => setReplay((r) => {
      if (!r?.playing) return r;
      const t = Math.min(t1, r.t + speed * 250);
      return { t, playing: t < t1 };
    }), 250);
    return () => clearInterval(id);
  }, [replay?.playing, speed, t1]);

  // which stretch of road each position belongs to (a new one after a signal gap)
  const stretchOf = useMemo(() => {
    const out: number[] = [];
    let k = 0;
    pings.forEach((x, i) => {
      if (i > 0 && (x[2] - pings[i - 1][2] > GAP_MS || apart(pings[i - 1], x) > GAP_M)) k++;
      out.push(k);
    });
    return out;
  }, [pings]);

  const T = replay?.t ?? null;
  // the road driven up to the replay's time (all of it otherwise), and where the truck was then
  const driven = useMemo(() => {
    let last = pings.length - 1;
    if (T !== null) {
      let lo = 0, hi = pings.length - 1;
      last = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (pings[mid][2] <= T) { last = mid; lo = mid + 1; } else hi = mid - 1; }
    }
    const paths: LngLat[][] = [];
    for (let i = 0; i <= last; i++) (paths[stretchOf[i]] ??= []).push([pings[i][0], pings[i][1]]);
    let at: LngLat | null = last >= 0 ? [pings[last][0], pings[last][1]] : null;
    if (T !== null && last >= 0 && last < pings.length - 1 && stretchOf[last + 1] === stretchOf[last]) {
      const a = pings[last], b = pings[last + 1], f = (T - a[2]) / (b[2] - a[2]);
      at = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    return { paths: paths.filter(Boolean), at };
  }, [pings, stretchOf, T]);

  const lines: MapLine[] = useMemo(() => [
    { id: "plan", paths: [p.planned], color: PLAN_SOLID, width: 4.5, opacity: 0.95 },
    { id: "drive", paths: driven.paths, color: NAVY, width: 4.5 },
    { id: "off", paths: (dev?.stretches ?? []).filter((s) => T === null || ms(s.from) <= T).map((s) => s.path), color: AMBER, width: 5 },
  ], [p.planned, driven.paths, dev, T]);

  const pins: MapPin[] = useMemo(() => {
    const out: MapPin[] = [{ id: "plant", lat: p.plant.lat, lng: p.plant.lng, kind: "pill", color: NAVY, label: "Plant", popup: p.plant.name }];
    for (const s of p.stops) {
      if (s.lat === null || s.lng === null) continue;
      // in a replay a stop shows its outcome only from the moment it was marked
      const shown = T !== null && (!s.deliveredAt || ms(s.deliveredAt) > T) ? "pending" : s.status;
      out.push({
        id: `s${s.id}`, lat: s.lat, lng: s.lng, kind: "num", label: String(s.seq),
        color: shown === "delivered" ? GREEN : shown === "not_delivered" ? AMBER : NAVY, hollow: shown === "pending",
        popup: `Stop ${s.seq}: ${s.buyer} · #${s.orderId}\n${s.status === "pending" ? "Still to do" : `${s.status === "delivered" ? "Delivered" : "Not delivered"} ${clock(s.deliveredAt)}${s.note ? ` · ${s.note}` : ""}`}`,
      });
    }
    if (T !== null && driven.at) out.push({ id: "truck", lat: driven.at[1], lng: driven.at[0], kind: "pill", top: true, color: NAVY, label: `Truck ${clockS(T)}` });
    else if (T === null && p.truck) {
      out.push({ id: "truck", lat: p.truck.lat, lng: p.truck.lng, kind: "pill", top: true, color: p.truck.lost ? GREY : NAVY, label: p.truck.name.split(" ")[0],
        popup: `${p.truck.name}${p.truck.seenAt ? ` · GPS ${clock(p.truck.seenAt)}` : ""}` });
    }
    return out;
  }, [p.plant, p.stops, p.truck, T, driven.at]);

  const play = () => {
    if (t0 === null || t1 === null) return;
    if (!replay || replay.t >= t1) setReplay({ t: t0, playing: true });
    else setReplay({ ...replay, playing: !replay.playing });
  };
  const zoomTo = (points: LngLat[]) => points.length && setFocus({ key: `${Date.now()}`, points });

  const tabs = [
    { id: "stops" as const, label: "Stops", n: p.stops.length },
    { id: "timeline" as const, label: "Timeline", n: null },
    { id: "deviation" as const, label: "Deviation", n: dev ? dev.stretches.length + dev.outOfOrder.length : null },
  ];

  return (
    <ScreenBox className="rounded-xl border border-border">
      <div className="grid h-full grid-rows-[3fr_2fr] lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-1">
        <div className="relative min-h-0">
          <DispatchMap lines={lines} pins={pins} focus={focus} />
          {pings.length > 1 && t0 !== null && t1 !== null ? (
            <div className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-3 rounded-lg border border-border bg-background/95 px-3 py-2 shadow-sm">
              <button type="button" onClick={play} aria-label={replay?.playing ? "Pause" : "Replay the drive"} title={replay?.playing ? "Pause" : "Replay the drive"}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90">
                {replay?.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <input type="range" min={t0} max={t1} step={1000} value={T ?? t1} aria-label="Time in the drive"
                onChange={(e) => setReplay({ t: Number(e.target.value), playing: false })} className="min-w-0 flex-1 accent-[var(--primary)]" />
              <span className="num w-20 shrink-0 text-right text-[12px] text-muted-foreground">{T !== null ? clockS(T) : clock(t1)}</span>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Replay speed" className="h-8 shrink-0 rounded-lg border border-input bg-background px-1.5 text-[12px]">
                {SPEEDS.map((s) => <option key={s} value={s}>×{s}</option>)}
              </select>
              {replay ? (
                <button type="button" onClick={() => setReplay(null)} aria-label="Back to the whole drive" title="Back to the whole drive"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-input hover:bg-muted"><RotateCcw className="size-4" /></button>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="@container flex min-h-0 flex-col border-t border-border lg:border-t-0 lg:border-l">
          <div className="space-y-1.5 border-b border-border px-4 py-2.5 text-[12px] text-muted-foreground">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5"><i className="h-1 w-5 rounded-full" style={{ background: PLAN_SOLID }} />Planned{p.plannedRoad ? ` ${km(p.plannedM)} by road` : " (straight lines)"}</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-1 w-5 rounded-full" style={{ background: NAVY }} />Driven {p.drivenM ? km(p.drivenM) : p.startedAt ? "-" : "once it starts"}</span>
              {dev?.off.length ? <span className="inline-flex items-center gap-1.5"><i className="h-1 w-5 rounded-full" style={{ background: AMBER }} />Off the planned road</span> : null}
            </div>
            {p.noPin ? <div className="text-amber-700">{p.noPin} {p.noPin === 1 ? "stop has" : "stops have"} no map pin; set it on the customer in Customer Masters.</div> : null}
          </div>
          <div className="flex shrink-0 gap-5 border-b border-border px-4" role="tablist">
            {tabs.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
                className={cn("-mb-px border-b-2 py-2 text-[13px]", tab === x.id ? "border-foreground font-semibold text-foreground" : "border-transparent text-foreground/70 hover:text-foreground")}>
                {x.label}{x.n ? <span className="ml-1 text-muted-foreground">{x.n}</span> : null}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "stops" ? p.stopsPanel : null}
            {tab === "timeline" ? <Timeline rows={p.timeline} stops={p.stops} onStop={(s) => s.lat !== null && s.lng !== null && zoomTo([[s.lng, s.lat]])} /> : null}
            {tab === "deviation" ? <Deviation dev={dev} plannedM={p.plannedM} plannedRoad={p.plannedRoad} onZoom={zoomTo} /> : null}
          </div>
        </aside>
      </div>
    </ScreenBox>
  );
}

/** What happened, in time order: the start, each stop (minutes and km since the line before, arrival and wait), gaps, the end. */
function Timeline({ rows, stops, onStop }: { rows: TimelineRow[]; stops: Stop[]; onStop: (s: Stop) => void }) {
  if (!rows.length) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">The timeline starts when the transporter starts the trip.</p>;
  const dot = (r: TimelineRow) =>
    r.kind === "gap" ? "border border-dashed border-muted-foreground bg-background"
      : r.kind === "missed" || r.status === "not_delivered" ? "bg-amber-600"
        : r.kind === "stop" ? "bg-[#1E8E3E]" : "bg-[#2B3990]";
  return (
    <ol className="px-4 py-3">
      {rows.map((r, i) => {
        const stop = r.seq !== null ? stops.find((s) => s.seq === r.seq) : undefined;
        const body = (
          <>
            <div className="flex items-baseline gap-2">
              <span className={cn("font-medium", r.kind === "gap" && "font-normal text-muted-foreground")}>{r.title}</span>
              <span className="num ml-auto shrink-0 text-[12px] text-muted-foreground">{clock(r.at)}</span>
            </div>
            {r.detail ? <div className={cn("text-[12px]", r.status === "not_delivered" || r.kind === "missed" ? "text-amber-700" : "text-muted-foreground")}>{r.detail}</div> : null}
            {r.mins !== null || r.arrivedAt ? (
              <div className="text-[12px] text-muted-foreground">
                {[r.mins !== null && i > 0 ? `+${r.mins} min` : null, r.metres ? `${km(r.metres)} driven` : null,
                  r.arrivedAt ? `arrived ${clock(r.arrivedAt)}` : null, r.waitMins !== null ? `${r.waitMins} min at the stop` : null].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </>
        );
        return (
          <li key={`${r.kind}-${r.at}-${r.seq ?? i}`} className="relative flex gap-3 pb-4 last:pb-0">
            {i < rows.length - 1 ? <span className="absolute top-3 bottom-0 left-[5px] w-px bg-border" /> : null}
            <span className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full", dot(r))} />
            {stop && stop.lat !== null ? (
              <button type="button" onClick={() => onStop(stop)} className="min-w-0 flex-1 text-left text-sm hover:opacity-80" title="Show on the map">{body}</button>
            ) : (
              <div className="min-w-0 flex-1 text-sm">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** How the drive went against the plan, with each stretch off the planned road (click to see it on the map). */
function Deviation({ dev, plannedM, plannedRoad, onZoom }: { dev: TripDeviation | null; plannedM: number; plannedRoad: boolean; onZoom: (pts: LngLat[]) => void }) {
  if (!dev) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">This shows once the transporter starts the trip.</p>;
  const facts: Array<[string, React.ReactNode, boolean?]> = [];
  if (dev.afterM !== null) {
    const o = dev.overPlanM;
    facts.push(["Driven to the last stop", <>{km(dev.roundM)}{o === null ? "" : ` (plan ${km(plannedM)}, ${o > 0 ? `${km(o)} more` : o < 0 ? `${km(-o)} less` : "as planned"})`}</>, (o ?? 0) > 0]);
    if (dev.afterM > 0) facts.push(["After the last stop", km(dev.afterM)]);
  } else {
    facts.push(["Driven so far", km(dev.roundM)]);
  }
  if (dev.checked) facts.push(["Off the planned road", dev.stretches.length ? `${dev.stretches.length} ${dev.stretches.length === 1 ? "stretch" : "stretches"} · ${km(dev.offM)} · up to ${km(dev.maxOffM)} away` : "none", dev.stretches.length > 0]);
  if (dev.visited > 1) facts.push(["Stop order", dev.outOfOrder.length ? dev.outOfOrder.map((o) => `stop ${o.seq} after stop ${o.after}`).join(", ") : "as planned", dev.outOfOrder.length > 0]);

  return (
    <div className="space-y-4 px-4 py-3 text-sm">
      <dl className="space-y-2">
        {facts.map(([l, v, warn]) => (
          <div key={l} className="flex gap-3">
            <dt className="w-40 shrink-0 text-muted-foreground">{l}</dt>
            <dd className={cn("font-medium", warn && "text-amber-700")}>{v}</dd>
          </div>
        ))}
      </dl>
      {dev.stretches.length ? (
        <div>
          <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">Stretches off the planned road</div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {dev.stretches.map((s, i) => (
              <li key={`${s.from}-${i}`}>
                <button type="button" onClick={() => onZoom(s.path)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50">
                  <span className="num w-5 text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{km(s.m)} off the road, up to {km(s.max)} away</span>
                    <span className="block text-[12px] text-muted-foreground">{clock(s.from)} – {clock(s.to)}</span>
                  </span>
                  <span className="text-[12px] text-primary">Show</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-[12px] text-muted-foreground">
        {plannedRoad
          ? "The plan is the road from the plant through the stops in their order (Ola Maps). Off the road means more than 200 m from it for at least 250 m; single GPS jumps are left out."
          : "The plan could not be drawn by road (straight lines only), so stretches off it are not checked."}
      </p>
    </div>
  );
}
