"use client";

import { useEffect, useMemo, useState } from "react";
import { DispatchMap, type MapLine, type MapPin } from "@/components/shop/DispatchMap";
import type { RoundPlan, SlotRoutePlan } from "@/lib/dispatch/slot-route";
import type { LngLat } from "@/lib/shop/track";
import { cn } from "@/lib/utils";
import { slotRouteAction } from "./actions";

const GREEN = "#0f6e56";
const RED = "#d62828";
const LATE = "#d9480f";

const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
const min = (s: number) => `${Math.round(s / 60)} min`;
const clock = (m: number) => { const t = Math.round(m); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const hours = (s: number) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`; };

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

/** A delivery round with time slots: the best order (reach every stop by its time, fewest km by road) or the file's own order. */
export function SlotRouteView() {
  const [plan, setPlan] = useState<SlotRoutePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState<"best" | "given">("best");
  /** plan: deliveries within their windows (waiting when early); estimate: drive straight on with only the hold times */
  const [mode, setMode] = useState<"plan" | "estimate">("plan");

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

  const round: RoundPlan | null = plan ? plan[show] : null;

  const pins = useMemo(() => {
    if (!plan || !round) return [] as MapPin[];
    const out: MapPin[] = [];
    round.order.forEach((s, i) => {
      const st = plan.stops[s];
      const v = round.visits.find((x) => x.stop === s);
      const lateHere = v ? (mode === "estimate" ? v.estimate - v.slot > 0.5 : v.late > 0.5) : false;
      const color = i === 0 ? RED : lateHere ? LATE : GREEN;
      out.push({
        id: `s${s}`, lat: st.lat, lng: st.lng, kind: "pin", color, mark: i === 0 ? "S" : String(i),
        label: i === 0 ? `Leave ${clock(mode === "estimate" ? round.estStart : round.start)} · ${st.name}`
          : mode === "estimate" && v ? `${st.area} · given ${st.slot} · est. ${clock(v.estimate)}` : `${st.slot} · ${st.area}`,
        popup: i === 0 ? `Leave ${clock(round.start)} · ${st.name}` : `${st.name} (${st.area}${st.phone ? `, ${st.phone}` : ""}): reach by ${st.slot}, gets there ${v ? clock(v.arrive) : ""}, leaves ${v ? clock(v.leave) : ""}`,
      });
    });
    // each stretch's distance and time halfway along its road
    round.legs.forEach((l, i) => {
      const [lng, lat] = halfway(l.path);
      const v = round.visits[i];
      const lateHere = mode === "estimate" ? v.estimate - v.slot > 0.5 : v.late > 0.5;
      out.push({ id: `l${i}`, lat, lng, kind: "pill", color: lateHere ? LATE : GREEN, label: `${km(l.metres)} | ${min(l.seconds)}`, top: true });
    });
    return out;
  }, [plan, round, mode]);

  const lines: MapLine[] = useMemo(() => (round ? [{ id: "road", paths: round.legs.map((l) => l.path), color: GREEN, width: 5, opacity: 0.85 }] : []), [round]);
  const focus = useMemo(() => (plan ? { key: "all", points: plan.stops.map((s) => [s.lng, s.lat] as LngLat) } : null), [plan]);

  return (
    <div className="flex flex-1 flex-col gap-3 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Delivery round with time slots</h1>
          <p className="text-sm text-muted-foreground">
            From Tumgaon depot, deliver to each customer by their delivery time - at most {plan?.early ?? 60} minutes before it (a vehicle there sooner waits) -
            and stay their hold time. Distances and driving times are Ola Maps&apos; road figures; each route says when to leave the depot.
          </p>
        </div>
        {plan ? (
          <div className="flex flex-wrap gap-1.5">
            {(["best", "given"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setShow(k)}
                className={cn("h-8 rounded-full border px-3 text-sm", show === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                {k === "best" ? "Shortest route" : "In delivery-time order"}
              </button>
            ))}
            <span className="mx-1 w-px self-stretch bg-border" />
            {(["plan", "estimate"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setMode(k)}
                className={cn("h-8 rounded-full border px-3 text-sm", mode === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                {k === "plan" ? "Plan" : "Estimated vs given time"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid min-h-[640px] flex-1 overflow-hidden rounded-xl border border-border lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-[420px]">
          <DispatchMap lines={lines} pins={pins} focus={focus} />
          {round ? (
            <div className="absolute top-3 left-3 z-10 rounded-lg bg-background/95 px-3 py-2 shadow-sm">
              <div className="text-lg font-bold">Total: {km(round.metres)} | {hours(round.seconds)} driving</div>
              <div className="text-[12px]">
                {mode === "estimate"
                  ? `Leave ${clock(round.estStart)}, last drop done at ${clock(round.estFinish)} (driving + hold times, no waiting)`
                  : `Last drop done at ${clock(round.finish)}`}
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

        <aside className="overflow-y-auto border-t border-border text-sm lg:border-t-0 lg:border-l">
          {plan && round && mode === "estimate" ? (
            <Estimate plan={plan} round={round} />
          ) : plan && round ? (
            <>
              <div className="border-b border-border px-4 py-3">
                <p className="text-base font-semibold">Leave the depot at {clock(round.start)}</p>
                {!round.onTime ? <p className="text-[#8a2e00]">The roads are slower than these delivery times allow: some stops are late.</p> : null}
                <p className="text-muted-foreground">
                  {show === "best" ? "The fewest km by road that still delivers to everyone in their time."
                    : "The customers in order of their delivery time."}
                </p>
                {show !== "best" && round.metres - plan.best.metres > 50 ? (
                  <p className="mt-1 text-muted-foreground">{km(round.metres - plan.best.metres)} longer than the shortest route ({km(plan.best.metres)}, leave by {clock(plan.best.start)}).</p>
                ) : null}
              </div>
              <ol>
                <li className="flex items-baseline gap-3 border-b border-border px-4 py-2">
                  <span className="w-5 font-semibold" style={{ color: RED }}>S</span>
                  <span className="flex-1 font-medium">{plan.stops[0].name}</span>
                  <span className="text-muted-foreground">leave {clock(round.start)}</span>
                </li>
                {round.visits.map((v, i) => {
                  const st = plan.stops[v.stop];
                  const late = v.late > 0.5;
                  return (
                    <li key={v.stop} className="border-b border-border px-4 py-2">
                      <div className="flex items-baseline gap-3">
                        <span className="w-5 font-semibold">{i + 1}</span>
                        <span className="min-w-0 flex-1"><span className="font-medium">{st.name}</span> <span className="text-muted-foreground">· {st.area}</span></span>
                        <span className={late ? "font-semibold text-[#8a2e00]" : ""}>{clock(v.arrive)}</span>
                        <span className="w-16 text-right text-muted-foreground">by {st.slot}</span>
                      </div>
                      <div className="ml-8 text-[12px] text-muted-foreground">
                        {km(round.legs[i].metres)} | {min(round.legs[i].seconds)} from the last stop{v.waited >= 1 ? ` · waits ${Math.round(v.waited)} min` : ""} · hold {st.hold} min{st.phone ? ` · ${st.phone}` : ""}{late ? ` · ${Math.round(v.late)} min late` : ""}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/** Each stop's given time against when the vehicle really gets there: driving on with only the hold times, no waiting. */
function Estimate({ plan, round }: { plan: SlotRoutePlan; round: RoundPlan }) {
  const lateCount = round.visits.filter((v) => v.estimate - v.slot > 0.5).length;
  const first = plan.stops[round.order[1]];
  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <p className="text-base font-semibold">Leave the depot at {clock(round.estStart)}</p>
        <p className="text-muted-foreground">
          To reach {first.area} at its {first.slot}, then drive on with only the hold time at each stop (5 or 10 min) - no waiting anywhere.
          This is when the vehicle really gets to each place.
        </p>
        <p className="mt-1 font-medium">
          {lateCount ? <span className="text-[#8a2e00]">{lateCount} {lateCount === 1 ? "stop is" : "stops are"} after the given time.</span> : "Every stop is reached by the given time."}
          {" "}Last drop done at {clock(round.estFinish)}.
        </p>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Stop</th>
            <th className="px-2 py-2 text-right font-medium">Given</th>
            <th className="px-2 py-2 text-right font-medium">Estimated</th>
            <th className="px-3 py-2 text-right font-medium">Difference</th>
          </tr>
        </thead>
        <tbody>
          {round.visits.map((v, i) => {
            const st = plan.stops[v.stop];
            const d = Math.round(v.estimate - v.slot);
            return (
              <tr key={v.stop} className="border-b border-border align-top">
                <td className="px-3 py-2">
                  <div><span className="font-semibold">{i + 1}.</span> {st.area}</div>
                  <div className="text-[12px] text-muted-foreground">{st.name} · hold {st.hold} min</div>
                </td>
                <td className="num px-2 py-2 text-right">{st.slot}</td>
                <td className={cn("num px-2 py-2 text-right font-semibold", d > 0 && "text-[#8a2e00]")}>{clock(v.estimate)}</td>
                <td className={cn("px-3 py-2 text-right whitespace-nowrap", d > 0 ? "font-semibold text-[#8a2e00]" : "text-muted-foreground")}>
                  {d === 0 ? "on time" : d > 0 ? `${d} min late` : `${-d} min early`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
