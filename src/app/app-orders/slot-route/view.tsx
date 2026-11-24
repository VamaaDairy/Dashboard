"use client";

import { useEffect, useMemo, useState } from "react";
import { DispatchMap, type MapLine, type MapPin } from "@/components/shop/DispatchMap";
import { ROUTE_COLOURS } from "@/components/shop/route-colors";
import type { RoundPlan, SlotRoutePlan } from "@/lib/dispatch/slot-route";
import type { LngLat } from "@/lib/shop/track";
import { cn } from "@/lib/utils";
import { slotRouteAction } from "./actions";

const GREEN = "#0f6e56";
const RED = "#d62828";
const LATE = "#d9480f";
const LATE_TEXT = "text-[#8a2e00]";

const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
const min = (s: number) => `${Math.round(s / 60)} min`;
const clock = (m: number) => { const t = Math.round(m); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const hours = (s: number) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`; };
const lateText = (m: number) => { const r = Math.round(m); return r < 60 ? `${r} min` : `${Math.floor(r / 60)} hr ${r % 60} min`; };

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
 * A delivery round with time slots. Nobody takes a delivery before their given time: a vehicle there sooner waits, so
 * every stop is on time or late, and the page shows by how much. The round ends back at the depot.
 */
export function SlotRouteView() {
  const [plan, setPlan] = useState<SlotRoutePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    slotRouteAction()
      .then((r) => {
        if (dead) return;
        if ("error" in r) setError(r.error);
        else setPlan(r);
      })
      .catch(() => { if (!dead) setError("Could not load the route."); });
    return () => { dead = true; };
  }, []);

  const round: RoundPlan | null = plan ? plan.best : null;

  const pins = useMemo(() => {
    if (!plan || !round) return [] as MapPin[];
    const depot = plan.stops[0];
    const out: MapPin[] = [{
      id: "depot", lat: depot.lat, lng: depot.lng, kind: "pin", color: RED, mark: "S",
      label: `${depot.name} · leave ${clock(round.start)} · back ${clock(round.back)}`,
      popup: `${depot.name}: leave ${clock(round.start)}, back ${clock(round.back)}`,
    }];
    round.visits.forEach((v, i) => {
      const st = plan.stops[v.stop];
      const late = v.late >= 0.5;
      out.push({
        id: `s${v.stop}`, lat: st.lat, lng: st.lng, kind: "pin", color: late ? LATE : GREEN, mark: String(i + 1),
        label: `${st.area} · ${st.slot}${late ? ` · ${lateText(v.late)} late` : ""}`,
        popup: `${st.name} (${st.area}${st.phone ? `, ${st.phone}` : ""}): given ${st.slot}, delivered ${clock(v.deliver)}${late ? `, ${lateText(v.late)} late` : ""}`,
      });
    });
    // each stretch's distance and time halfway along its road, in its colour
    round.legs.forEach((l, i) => {
      const [lng, lat] = halfway(l.path);
      out.push({ id: `l${i}`, lat, lng, kind: "pill", color: legColour(i), label: `${km(l.metres)} | ${min(l.seconds)}`, top: true });
    });
    return out;
  }, [plan, round]);

  // every stretch from one stop to the next in its own colour; the drive back dashed
  const lines: MapLine[] = useMemo(() => (round
    ? round.legs.map((l, i) => ({ id: `road${i}`, paths: [l.path], color: legColour(i), width: 5, opacity: 0.9, dashed: i === round.legs.length - 1 }))
    : []), [round]);
  const focus = useMemo(() => (plan ? { key: "all", points: plan.stops.map((s) => [s.lng, s.lat] as LngLat) } : null), [plan]);

  return (
    <div className="flex flex-1 flex-col gap-3 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Delivery round with time slots</h1>
          <p className="text-sm text-muted-foreground">
            From Tumgaon depot and back. No customer takes a delivery before their given time: a vehicle there sooner waits, delivers at the given time and
            stays the hold time. The vehicle leaves so it reaches the first stop on time. Distances and driving times are Ola Maps&apos; road figures.
          </p>
        </div>
      </div>

      {/* one screen high: the list scrolls on its own, so the map fits the route in what you can see */}
      <div className="grid overflow-hidden rounded-xl border border-border lg:h-[calc(100vh-150px)] lg:min-h-[560px] lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="relative h-[60vh] min-h-[380px] lg:h-full lg:min-h-0">
          <DispatchMap lines={lines} pins={pins} focus={focus} />
          {round ? (
            <div className="absolute top-3 left-3 z-10 rounded-lg bg-background/95 px-3 py-2 shadow-sm">
              <div className="text-lg font-bold">Total: {km(round.metres)} | {hours(round.seconds)} driving</div>
              <div className="text-[12px]">Leave {clock(round.start)} · last drop {clock(round.lastDrop)} · back at the depot {clock(round.back)}</div>
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

        <aside className="overflow-y-auto border-t border-border text-sm lg:min-h-0 lg:border-t-0 lg:border-l">
          {plan && round ? <Stops plan={plan} round={round} /> : null}
        </aside>
      </div>
    </div>
  );
}

/** Given time against when each stop is really delivered, and how late. */
function Stops({ plan, round }: { plan: SlotRoutePlan; round: RoundPlan }) {
  const depot = plan.stops[0];
  const back = round.legs[round.legs.length - 1];
  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <p className="text-base font-semibold">
          {round.lateStops ? <span className={LATE_TEXT}>{round.lateStops} of {round.visits.length} stops late · {lateText(round.late)} late in all</span> : "Every stop on time"}
        </p>
        <p className="text-muted-foreground">
          The order with the least lateness, then the fewest km. Leave the depot at {clock(round.start)}.
        </p>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Stop</th>
            <th className="px-2 py-2 text-right font-medium">Given</th>
            <th className="px-2 py-2 text-right font-medium">Delivered</th>
            <th className="px-3 py-2 text-right font-medium">Late</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="px-3 py-2" colSpan={2}><span className="font-semibold" style={{ color: RED }}>S</span> {depot.name}</td>
            <td className="num px-2 py-2 text-right">leave {clock(round.start)}</td>
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
                    {km(round.legs[i].metres)} | {min(round.legs[i].seconds)} · gets there {clock(v.arrive)}{v.waited >= 1 ? `, waits ${Math.round(v.waited)} min` : ""}
                  </div>
                </td>
                <td className="num px-2 py-2 text-right">{st.slot}</td>
                <td className={cn("num px-2 py-2 text-right font-semibold", late && LATE_TEXT)}>{clock(v.deliver)}</td>
                <td className={cn("px-3 py-2 text-right whitespace-nowrap", late ? cn("font-semibold", LATE_TEXT) : "text-muted-foreground")}>
                  {late ? lateText(v.late) : "on time"}
                </td>
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
            <td className="num px-2 py-2 text-right">{clock(round.back)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </>
  );
}
