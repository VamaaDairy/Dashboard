"use client";

import { useEffect, useMemo, useState } from "react";
import { DispatchMap, type MapLine, type MapPin } from "@/components/shop/DispatchMap";
import { NAVY, ROUTE_COLOURS } from "@/components/shop/route-colors";
import { PLAN_SOLID } from "@/components/shop/RouteMap";
import type { RouteCustomer, RouteOnMap } from "@/lib/dispatch";
import type { RouteStats } from "@/lib/dispatch/route-stats";
import type { LngLat } from "@/lib/shop/track";
import { cn } from "@/lib/utils";
import { roadPlanAction } from "../actions";
import { ScreenBox } from "../screen";

type Road = { customers: RouteCustomer[]; path: LngLat[]; metres: number; seconds: number; road: boolean };

const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
const drive = (s: number) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const onMap = (c: RouteCustomer) => c.lat !== null && c.lng !== null;

/**
 * Every route from the plant on the whole screen: all of them coloured, or one route's customers numbered in the
 * shortest way round from the plant by road (the order a new trip's stops get), with how its trips went lately.
 */
export function RoutesView({ routes, plant, stats }: { routes: RouteOnMap[]; plant: { name: string; lat: number; lng: number }; stats: RouteStats[] }) {
  const [pick, setPick] = useState<number | "all">("all");
  const [roads, setRoads] = useState<Record<number, Road | "failed">>({});
  const [focus, setFocus] = useState<{ key: string; points: LngLat[] } | null>(null);
  const colour = useMemo(() => new Map(routes.map((r, i) => [r.id, ROUTE_COLOURS[i % ROUTE_COLOURS.length]])), [routes]);
  const statOf = useMemo(() => new Map(stats.map((s) => [s.routeId, s])), [stats]);

  // the picked route's road plan (Ola), asked once per route
  useEffect(() => {
    if (pick === "all" || roads[pick]) return;
    let dead = false;
    roadPlanAction(pick)
      .then((x) => { if (!dead) setRoads((m) => ({ ...m, [pick]: x ? { customers: x.customers, path: x.plan.path, metres: x.plan.metres, seconds: x.plan.seconds, road: x.plan.road } : "failed" })); })
      .catch(() => { if (!dead) setRoads((m) => ({ ...m, [pick]: "failed" })); });
    return () => { dead = true; };
  }, [pick, roads]);

  const got = pick === "all" ? undefined : roads[pick];
  const road = got && got !== "failed" ? got : null;
  const shown = useMemo(() => (pick === "all" ? routes : routes.filter((r) => r.id === pick)), [pick, routes]);

  const choose = (id: number | "all") => {
    setPick(id);
    const list = id === "all" ? routes : routes.filter((r) => r.id === id);
    const pts = list.flatMap((r) => r.customers.filter(onMap).map((c) => [c.lng!, c.lat!] as LngLat));
    setFocus({ key: `${id}-${Date.now()}`, points: [[plant.lng, plant.lat], ...pts] });
  };

  const pins = useMemo(() => {
    const out: MapPin[] = [{ id: "plant", lat: plant.lat, lng: plant.lng, kind: "pill", color: NAVY, label: "Plant", popup: plant.name }];
    for (const r of shown) {
      const list = (road && pick === r.id ? road.customers : r.customers).filter(onMap);
      list.forEach((c, i) => out.push(pick === "all"
        ? { id: `${r.id}-${i}`, lat: c.lat!, lng: c.lng!, kind: "dot", color: colour.get(r.id)!, popup: `${c.name}${c.code ? ` (${c.code})` : ""} · ${r.name} · ${c.channel}` }
        : { id: `${r.id}-${i}`, lat: c.lat!, lng: c.lng!, kind: "num", label: String(i + 1), color: colour.get(r.id)!, popup: `${i + 1}. ${c.name}${c.code ? ` (${c.code})` : ""} · ${c.channel}` }));
    }
    return out;
  }, [shown, road, pick, colour, plant]);

  const lines: MapLine[] = useMemo(() => {
    if (pick === "all") return [];
    const r = routes.find((x) => x.id === pick);
    if (!r) return [];
    // by road once Ola has it, straight lines from the plant meanwhile
    const path: LngLat[] = road?.path.length ? road.path : [[plant.lng, plant.lat], ...r.customers.filter(onMap).map((c) => [c.lng!, c.lat!] as LngLat)];
    return [{ id: "road", paths: [path], color: PLAN_SOLID, width: 4.5 }];
  }, [pick, routes, road, plant]);

  const picked = pick === "all" ? null : routes.find((r) => r.id === pick) ?? null;
  const noPin = picked ? picked.customers.filter((c) => !onMap(c)) : [];
  const totalOnMap = routes.reduce((s, r) => s + r.customers.filter(onMap).length, 0);

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-3 md:px-6">
      <p className="text-sm text-tertiary-foreground">
        Every route from {plant.name}. Customers sit at their map pin from Customer Masters; pick a route to see them numbered in the shortest
        way round from the plant by road, the order a new trip&apos;s stops get. The line under each route is its last 30 days.
      </p>
      <ScreenBox className="rounded-xl border border-border">
        <div className="grid h-full grid-rows-[3fr_2fr] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1">
          <div className="relative min-h-0">
            <DispatchMap lines={lines} pins={pins} focus={focus} />
            {picked ? (
              <div className="absolute bottom-3 left-3 z-10 max-w-[85%] rounded-lg bg-background/95 px-3 py-2 text-[12px] text-muted-foreground shadow-sm">
                {got === undefined ? "Working out the road from the plant (the first time can take up to a minute)…"
                  : road?.road ? `${picked.name}: ${km(road.metres)} by road from the plant, about ${drive(road.seconds)} of driving, ${road.customers.filter(onMap).length} customers in this order.`
                    : "No road data right now: straight lines, nearest first."}
              </div>
            ) : null}
          </div>
          <aside className="min-h-0 overflow-y-auto border-t border-border lg:border-t-0 lg:border-l">
            <button type="button" onClick={() => choose("all")}
              className={cn("block w-full border-b border-border px-4 py-2.5 text-left hover:bg-muted/40", pick === "all" && "bg-muted/60")}>
              <div className="font-medium">All routes</div>
              <div className="text-[12px] text-muted-foreground">{routes.length} routes · {totalOnMap} customers on the map</div>
            </button>
            {routes.map((r) => {
              const st = statOf.get(r.id);
              const pinned = r.customers.filter(onMap).length;
              const pct = st && st.done ? Math.round((st.delivered / st.done) * 100) : null;
              return (
                <button key={r.id} type="button" onClick={() => choose(r.id)}
                  className={cn("block w-full border-b border-border px-4 py-2.5 text-left hover:bg-muted/40", pick === r.id && "bg-muted/60")}>
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: colour.get(r.id) }} />
                    <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                    <span className={cn("shrink-0 text-[12px]", pinned < r.customers.length ? "text-amber-700" : "text-muted-foreground")}>{pinned}/{r.customers.length} on the map</span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">
                    {st
                      ? [`${st.trips} ${st.trips === 1 ? "trip" : "trips"}`, st.avgStops !== null ? `${st.avgStops} stops each` : null, pct !== null ? `${pct}% delivered` : null,
                        st.avgMin !== null ? drive(st.avgMin * 60) : null, st.avgDrivenM !== null ? km(st.avgDrivenM) : null].filter(Boolean).join(" · ")
                      : "No trips in the last 30 days"}
                  </div>
                </button>
              );
            })}
            {noPin.length ? (
              <p className="px-4 py-3 text-[12px] text-amber-700">
                Not on the map ({noPin.length}): {noPin.slice(0, 12).map((c) => c.name).join(", ")}{noPin.length > 12 ? ", …" : ""}. Link them to their customer on
                Route orders → Customers &amp; products, or set the pin in Customer Masters.
              </p>
            ) : null}
          </aside>
        </div>
      </ScreenBox>
    </div>
  );
}
