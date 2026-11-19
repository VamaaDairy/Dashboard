"use client";

import { useEffect, useState } from "react";
import { RouteMap } from "@/components/shop/RouteMap";
import { NAVY, type MapMarker } from "@/components/shop/route-colors";
import type { LngLat } from "@/lib/shop/track";
import { cn } from "@/lib/utils";
import { roadPlanAction } from "./actions";

type Customer = { name: string; channel: string; code: string | null; lat: number | null; lng: number | null };
type Route = { id: number; name: string; customers: Customer[] };

// one colour per route on the all-routes view (they repeat after twelve)
const ROUTE_COLOURS = ["#2B3990", "#1E8E3E", "#D97706", "#B91C1C", "#7C3AED", "#0E7490", "#BE185D", "#4D7C0F", "#9A3412", "#1D4ED8", "#047857", "#6B21A8"];

/**
 * Every route from the plant: pick a route to see its customers numbered in the shortest way round from the plant
 * (straight lines between the stops), or All routes to see every customer coloured by route.
 */
export function RoutesMap({ routes, plant }: { routes: Route[]; plant: { name: string; lat: number; lng: number } }) {
  const [pick, setPick] = useState<number | "all">(routes.find((r) => r.customers.some((c) => c.lat !== null))?.id ?? "all");
  // the road plan of the picked route: its outlets in road order and the road path from the plant (Ola Maps)
  const [road, setRoad] = useState<{ id: number; customers: Customer[]; path: LngLat[]; metres: number; seconds: number; road: boolean } | null>(null);
  const [failed, setFailed] = useState<number | null>(null);
  useEffect(() => {
    if (pick === "all") return;
    let dead = false;
    roadPlanAction(pick)
      .then((x) => { if (dead) return; if (x) setRoad({ id: pick, customers: x.customers, ...x.plan }); else setFailed(pick); })
      .catch(() => { if (!dead) setFailed(pick); });
    return () => { dead = true; };
  }, [pick]);
  const colour = new Map(routes.map((r, i) => [r.id, ROUTE_COLOURS[i % ROUTE_COLOURS.length]]));
  const shown = pick === "all" ? routes : routes.filter((r) => r.id === pick);

  const markers: MapMarker[] = [{ lat: plant.lat, lng: plant.lng, label: "Plant", color: NAVY, popup: plant.name }];
  let planned: LngLat[] | null = null;
  const roadNow = pick !== "all" && road?.id === pick ? road : null;
  const loading = pick !== "all" && !roadNow && failed !== pick;
  for (const r of shown) {
    const pinned = (roadNow ? roadNow.customers : r.customers).filter((c) => c.lat !== null && c.lng !== null);
    pinned.forEach((c, i) =>
      markers.push({
        lat: c.lat!, lng: c.lng!, color: colour.get(r.id)!,
        label: pick === "all" ? "" : `${i + 1}. ${c.name}`,
        popup: `${c.name}${c.code ? ` (${c.code})` : ""} · ${r.name} · ${c.channel}${pick === "all" ? "" : ` · stop ${i + 1}`}`,
      }),
    );
    if (pick !== "all") planned = roadNow?.path.length ? roadNow.path : [[plant.lng, plant.lat], ...pinned.map((c) => [c.lng!, c.lat!] as LngLat)];
  }
  const count = (r: Route) => r.customers.filter((c) => c.lat !== null).length;
  const noPin = shown.flatMap((r) => r.customers.filter((c) => c.lat === null));

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div>
        <h2 className="text-[15px] font-semibold">Routes map</h2>
        <p className="text-[12px] text-muted-foreground">
          Every delivery starts at {plant.name}. Customers are placed by their map pin in Customer Masters; on one route they are numbered in the shortest way round from the plant by road, with the road path drawn; a new trip&apos;s stops get the same order.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[{ id: "all" as const, name: "All routes", n: routes.reduce((s, r) => s + count(r), 0) }, ...routes.map((r) => ({ id: r.id, name: r.name, n: count(r) }))].map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setPick(r.id)}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px]", pick === r.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
          >
            {r.id !== "all" ? <span className="size-2.5 rounded-full" style={{ background: colour.get(r.id) }} /> : null}
            {r.name} <span className="opacity-70">{r.n}</span>
          </button>
        ))}
      </div>
      {pick !== "all" ? (
        <p className="text-[12px] text-muted-foreground">
          {loading && !roadNow ? "Working out the road route from the plant…"
            : roadNow?.road ? `By road from the plant: ${(roadNow.metres / 1000).toFixed(1)} km, about ${Math.round(roadNow.seconds / 60)} min of driving, ${roadNow.customers.filter((c) => c.lat !== null).length} outlets in this order.`
              : "Road data is not available right now: shown in straight lines, nearest first."}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border">
        <RouteMap key={String(pick)} track={[]} planned={planned} markers={markers} height="520px" plain />
      </div>
      {noPin.length ? (
        <p className="text-[12px] text-muted-foreground">
          Not on the map ({noPin.length}): {noPin.slice(0, 12).map((c) => c.name).join(", ")}{noPin.length > 12 ? ", …" : ""}. Link them to their customer on Route orders → Customers & products, or set the pin in Customer Masters.
        </p>
      ) : null}
    </section>
  );
}
