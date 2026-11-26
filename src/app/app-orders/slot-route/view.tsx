"use client";

import Link from "next/link";
import { Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Ruler } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DispatchMap, type MapLine, type MapPin } from "@/components/shop/DispatchMap";
import { ROUTE_COLOURS } from "@/components/shop/route-colors";
import { Button } from "@/components/ui/button";
import type { RouteOption, RouteTab, SlotRoutePlan } from "@/lib/dispatch/slot-route";
import type { LngLat } from "@/lib/shop/track";
import { cn } from "@/lib/utils";
import { slotRouteAction, slotRoutePathsAction } from "./actions";

const GREEN = "#0f6e56";
const RED = "#d62828";
const LATE = "#d9480f";
const LATE_TEXT = "text-[#8a2e00]";

const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
const min = (s: number) => `${Math.round(s / 60)} min`;
/** A time of day; times before midnight of the delivery day are negative, so wrap round the clock. */
const clock = (m: number) => { const t = ((Math.round(m) % 1440) + 1440) % 1440; return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
/** Without given times a round has no clock: times are from leaving the depot. */
const elapsed = (m: number) => { const t = Math.round(m); return `+${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const hours = (s: number) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`; };
const lateText = (m: number) => { const r = Math.round(m); return r < 60 ? `${r} min` : `${Math.floor(r / 60)} hr ${r % 60} min`; };
/** A new time against the given one. */
const shiftText = (s: number | null) => (s == null ? "" : Math.abs(s) < 0.5 ? "same" : `${lateText(Math.abs(s))} ${s > 0 ? "later" : "earlier"}`);

/** A delivery window round a time: [w] minutes early to [w] minutes late. */
const windowText = (m: number, w: number) => `${clock(m - w)}–${clock(m + w)}`;

/** Each stretch's colour: the route palette, one per stretch. */
const legColour = (i: number) => ROUTE_COLOURS[i % ROUTE_COLOURS.length];

/** The point halfway along a road path (by length), where its distance and time label goes - never on a stop. */
function halfway(path: LngLat[]): LngLat {
  if (path.length < 2) return path[0];
  const d = (a: LngLat, b: LngLat) => Math.hypot((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]);
  const total = path.slice(1).reduce((s, p, i) => s + d(path[i], p), 0);
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const step = d(path[i - 1], path[i]);
    if (walked + step >= total / 2) {
      const f = step ? (total / 2 - walked) / step : 0;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f];
    }
    walked += step;
  }
  return path[path.length - 1];
}

/**
 * The route sheet's delivery routes, one route at a time, each with its options: the sheet's (given times in order),
 * the same times in another order, and routes with changed delivery times for fewer km or less driving. Nobody takes a
 * delivery before their given time; with new times, each stop is delivered when the vehicle gets there.
 */
export function SlotRouteView({ tabs, id }: { tabs: RouteTab[]; id: string }) {
  const [plan, setPlan] = useState<SlotRoutePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null: the suggested route where there is one, else the sheet's
  const [pick, setPick] = useState<string | null>(null);
  /** the roads drawn for each option, as Ola gives them */
  const [paths, setPaths] = useState<Record<string, LngLat[][]>>({});
  // the map takes the screen: the list and the km | min labels can be hidden, and the map shown full screen
  const [showList, setShowList] = useState(true);
  const [showFigures, setShowFigures] = useState(true);
  const [full, setFull] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else box.current?.requestFullscreen().catch(() => {});
  };

  useEffect(() => {
    let dead = false;
    slotRouteAction(id)
      .then((r) => {
        if (dead) return;
        if ("error" in r) setError(r.error);
        else setPlan(r);
      })
      .catch(() => { if (!dead) setError("Could not load the route."); });
    return () => { dead = true; };
  }, [id]);

  const option: RouteOption | null = plan
    ? (plan.options.find((o) => o.key === pick) ?? plan.options.find((o) => o.key === "best") ?? plan.options.find((o) => o.window) ?? plan.options[0])
    : null;
  const round = option?.round ?? null;

  // the chosen option's roads, once
  const key = option?.key;
  const order = round?.order;
  useEffect(() => {
    if (!key || !order || paths[key]) return;
    let dead = false;
    slotRoutePathsAction(id, order).then((p) => { if (!dead && p) setPaths((x) => ({ ...x, [key]: p })); }).catch(() => {});
    return () => { dead = true; };
  }, [id, key, order, paths]);

  const at = useCallback((m: number) => (plan?.timed ? clock(m) : elapsed(m - (round?.start ?? 0))), [plan, round]);

  /** each drive's road: Ola's once it is in, a straight line until then */
  const roads = useMemo(() => {
    if (!plan || !round || !option) return [] as LngLat[][];
    const got = paths[option.key];
    return round.legs.map((l, i) => got?.[i] ?? [[plan.stops[l.from].lng, plan.stops[l.from].lat], [plan.stops[l.to].lng, plan.stops[l.to].lat]] as LngLat[]);
  }, [plan, round, option, paths]);

  const pins = useMemo(() => {
    if (!plan || !round) return [] as MapPin[];
    const depot = plan.stops[0];
    const out: MapPin[] = [{
      id: "depot", lat: depot.lat, lng: depot.lng, kind: "pin", color: RED, mark: "S",
      label: `${depot.name} · leave ${at(round.start)} · back ${at(round.back)}`,
      popup: `${depot.name}: leave ${at(round.start)}, back ${at(round.back)}`,
    }];
    const win = option?.window;
    round.visits.forEach((v, i) => {
      const st = plan.stops[v.stop];
      const late = v.late >= 0.5;
      const label = win
        ? `${st.area} · ${windowText(v.target ?? v.deliver, win)}`
        : round.newTimes
        ? `${st.area} · ${at(v.deliver)}${v.shift != null && Math.abs(v.shift) >= 0.5 ? ` (${shiftText(v.shift)})` : ""}`
        : `${st.area}${st.slot ? ` · ${st.slot}` : ""}${late ? ` · ${lateText(v.late)} late` : ""}`;
      const popup = win
        ? `${st.name} (${st.area}${st.phone ? `, ${st.phone}` : ""}): ${st.slot ? `given ${st.slot}, ` : ""}new time ${clock(v.deliver)}, deliver ${windowText(v.target ?? v.deliver, win)}`
        : round.newTimes
        ? `${st.name} (${st.area}${st.phone ? `, ${st.phone}` : ""}): ${st.slot ? `given ${st.slot}, ` : ""}new time ${at(v.deliver)}`
        : `${st.name} (${st.area}${st.phone ? `, ${st.phone}` : ""}): ${st.slot ? `given ${st.slot}, ` : ""}delivered ${at(v.deliver)}${late ? `, ${lateText(v.late)} late` : ""}`;
      out.push({ id: `s${v.stop}`, lat: st.lat, lng: st.lng, kind: "pin", color: late ? LATE : GREEN, mark: String(i + 1), label, popup });
    });
    // each stretch's distance and time halfway along its road, in its colour (unless hidden)
    if (showFigures) round.legs.forEach((l, i) => {
      const [lng, lat] = halfway(roads[i]);
      out.push({ id: `l${i}`, lat, lng, kind: "pill", color: legColour(i), label: `${km(l.metres)} | ${min(l.seconds)}`, top: true });
    });
    return out;
  }, [plan, round, option, roads, at, showFigures]);

  // every stretch from one stop to the next in its own colour; the drive back dashed
  const lines: MapLine[] = useMemo(
    () => roads.map((p, i) => ({ id: `road${i}`, paths: [p], color: legColour(i), width: 5, opacity: 0.9, dashed: i === roads.length - 1 })),
    [roads],
  );
  const focus = useMemo(() => (plan ? { key: plan.id, points: plan.stops.map((s) => [s.lng, s.lat] as LngLat) } : null), [plan]);

  return (
    <div className="flex flex-1 flex-col gap-2 p-3 md:p-4">
      <nav className="flex flex-wrap items-center gap-1.5">
        <h1 className="mr-2 text-base font-semibold" title="Every route of the route sheet, from Tumgaon depot and back. No customer takes a delivery before their given time: a vehicle there sooner waits and stays the hold time. Distances and driving times are Ola Maps' road figures.">
          Delivery routes
        </h1>
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`?route=${t.id}`}
            scroll={false}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              t.id === id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.name} <span className="opacity-70">· {t.stops}</span>
          </Link>
        ))}
      </nav>

      {plan ? <Options plan={plan} pick={option!.key} onPick={setPick} /> : null}

      {/* the map fills the screen; the list beside it scrolls on its own and can be hidden */}
      <div
        ref={box}
        className={cn(
          "grid overflow-hidden border border-border bg-background",
          full ? "h-screen rounded-none" : "h-[calc(100vh-130px)] min-h-[480px] rounded-xl",
          showList && "lg:grid-cols-[minmax(0,1fr)_400px]",
        )}
      >
        <div className={cn("relative min-h-0", showList ? "h-[70vh] lg:h-full" : "h-full")}>
          <DispatchMap lines={lines} pins={pins} focus={focus} />
          <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" className="bg-background/95" onClick={() => setShowFigures((v) => !v)} aria-pressed={!showFigures}>
              <Ruler /> {showFigures ? "Hide km" : "Show km"}
            </Button>
            <Button variant="outline" size="sm" className="bg-background/95" onClick={() => setShowList((v) => !v)}>
              {showList ? <PanelRightClose /> : <PanelRightOpen />} {showList ? "Hide list" : "Show list"}
            </Button>
            <Button variant="outline" size="sm" className="bg-background/95" onClick={toggleFull}>
              {full ? <Minimize2 /> : <Maximize2 />} {full ? "Exit full screen" : "Full screen"}
            </Button>
          </div>
          {round && !showFigures ? null : round ? (
            <div className="absolute top-3 left-3 z-10 rounded-lg bg-background/95 px-3 py-2 shadow-sm">
              <div className="text-lg font-bold">{option!.title}: {km(round.metres)} | {hours(round.seconds)} driving</div>
              <div className="text-[12px]">
                {plan!.timed
                  ? `Leave ${clock(round.start)} · last drop ${clock(round.lastDrop)} · back at the depot ${clock(round.back)}`
                  : `No given times · last drop ${elapsed(round.lastDrop - round.start)} · back at the depot ${elapsed(round.back - round.start)} after leaving`}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {plan!.road ? "Road distance and time from Ola Maps" : "Ola Maps did not answer: straight-line estimates"}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              {error ?? "Working out the roads with Ola Maps (the first time can take a minute)…"}
            </div>
          )}
        </div>

        {showList ? (
          <aside className="overflow-y-auto border-t border-border text-sm lg:min-h-0 lg:border-t-0 lg:border-l">
            {plan && option ? <Stops plan={plan} option={option} at={at} /> : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

/** The ways to run this route, side by side: km and driving time, against the sheet's. */
function Options({ plan, pick, onPick }: { plan: SlotRoutePlan; pick: string; onPick: (k: string) => void }) {
  const base = plan.options[0].round;
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {plan.options.map((o, i) => {
        const r = o.round;
        const saved = base.metres - r.metres;
        const on = o.key === pick;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o.key)}
            className={cn(
              "min-w-[150px] shrink-0 rounded-lg border px-2.5 py-1.5 text-left text-[13px] leading-snug",
              on ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/50",
            )}
          >
            <div className="font-semibold">{o.title}</div>
            <div className="num">{km(r.metres)} · {hours(r.seconds)}</div>
            <div className="text-[12px] text-muted-foreground">
              {i === 0 ? "the sheet's route" : Math.abs(saved) < 50 ? "same km" : saved > 0 ? `saves ${km(saved)}` : `${km(-saved)} more`}
              {" · "}
              {o.window ? (r.lateStops ? <span className={LATE_TEXT}>{r.lateStops} outside ±{o.window}</span> : `all in ±${o.window} min`) : r.newTimes ? "new times" : r.lateStops ? <span className={LATE_TEXT}>{r.lateStops} late</span> : "on time"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Each stop of the chosen option: given time against when it is delivered (and how late), or against its new time. */
function Stops({ plan, option, at }: { plan: SlotRoutePlan; option: RouteOption; at: (m: number) => string }) {
  const round = option.round;
  const depot = plan.stops[0];
  const back = round.legs[round.legs.length - 1];
  const moved = round.visits.filter((v) => v.shift != null && Math.abs(v.shift) >= 0.5).length;
  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <p className="text-base font-semibold">
          {round.newTimes
            ? plan.timed ? `New delivery times: ${moved} of ${round.visits.length} stops change` : "No given times"
            : round.lateStops ? <span className={LATE_TEXT}>{round.lateStops} of {round.visits.length} stops late · {lateText(round.late)} late in all</span> : "Every stop on time"}
        </p>
        <p className="text-muted-foreground">{option.note}{plan.timed ? ` Leave the depot at ${clock(round.start)}.` : ""}</p>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Stop</th>
            <th className="px-2 py-2 text-right font-medium">Given</th>
            <th className="px-2 py-2 text-right font-medium">{round.newTimes ? "New time" : "Delivered"}</th>
            <th className="px-3 py-2 text-right font-medium">{option.window ? `Window ±${option.window}` : round.newTimes ? "Change" : "Late"}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="px-3 py-2" colSpan={2}><span className="font-semibold" style={{ color: RED }}>S</span> {depot.name}</td>
            <td className="num px-2 py-2 text-right">leave {at(round.start)}</td>
            <td />
          </tr>
          {round.visits.map((v, i) => {
            const st = plan.stops[v.stop];
            const late = v.late >= 0.5;
            return (
              <tr key={v.stop} className="border-b border-border align-top">
                <td className="px-3 py-2">
                  <div><span className="font-semibold">{i + 1}.</span> {st.area}</div>
                  <div className="text-[12px] text-muted-foreground">{st.name} · hold {st.hold} min</div>
                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span className="inline-block h-1 w-4 shrink-0 rounded" style={{ background: legColour(i) }} />
                    {km(round.legs[i].metres)} | {min(round.legs[i].seconds)} · gets there {at(v.arrive)}{v.waited >= 1 ? `, waits ${Math.round(v.waited)} min` : ""}
                  </div>
                </td>
                <td className="num px-2 py-2 text-right">{st.slot || <span className="text-muted-foreground">any</span>}</td>
                <td className={cn("num px-2 py-2 text-right font-semibold", late && LATE_TEXT)}>{at(v.deliver)}</td>
                {option.window ? (
                  <td className="num px-3 py-2 text-right whitespace-nowrap">
                    <div className={cn("font-semibold", late && LATE_TEXT)}>{windowText(v.target ?? v.deliver, option.window)}</div>
                    <div className="text-[12px] text-muted-foreground">{shiftText(v.shift)}</div>
                  </td>
                ) : round.newTimes ? (
                  <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">{shiftText(v.shift) || "—"}</td>
                ) : (
                  <td className={cn("px-3 py-2 text-right whitespace-nowrap", late ? cn("font-semibold", LATE_TEXT) : "text-muted-foreground")}>
                    {late ? lateText(v.late) : "on time"}
                  </td>
                )}
              </tr>
            );
          })}
          <tr className="border-b border-border align-top">
            <td className="px-3 py-2" colSpan={2}>
              <div><span className="font-semibold" style={{ color: RED }}>S</span> Back at {depot.name}</div>
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <span className="inline-block h-1 w-4 shrink-0 rounded" style={{ background: legColour(round.legs.length - 1) }} />
                {km(back.metres)} | {min(back.seconds)} after the last drop
              </div>
            </td>
            <td className="num px-2 py-2 text-right">{at(round.back)}</td>
            <td />
          </tr>
        </tbody>
      </table>
      {plan.off.length ? (
        <div className="px-4 py-3">
          <p className="font-semibold">Not on this route ({plan.off.length})</p>
          <ul className="mt-1 space-y-1.5">
            {plan.off.map((o, i) => (
              <li key={i}>
                <div>{o.name}{o.area ? <span className="text-muted-foreground"> · {o.area}</span> : null}</div>
                <div className="text-[12px] text-muted-foreground">{o.why}{o.phone ? ` · ${o.phone}` : ""}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
