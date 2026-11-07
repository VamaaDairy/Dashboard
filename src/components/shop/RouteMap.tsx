"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as maplibregl from "maplibre-gl";
import "@/lib/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LngLat } from "@/lib/shop/track";
import { GREEN, GREY, NAVY, type MapMarker } from "./route-colors";

const line = (paths: LngLat[][]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: paths.filter((p) => p.length > 1).map((p) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: p } })),
});

/** Where the gaps in the signal are: a straight dotted joint from the end of one stretch to the start of the next. */
const joints = (paths: LngLat[][]): LngLat[][] => {
  const out: LngLat[][] = [];
  for (let i = 1; i < paths.length; i++) {
    const a = paths[i - 1][paths[i - 1].length - 1], b = paths[i][0];
    if (a && b) out.push([a, b]);
  }
  return out;
};

function pin(color: string, label: string) {
  const el = document.createElement("div");
  el.style.cssText = `background:${color};color:#fff;font:600 11px system-ui;padding:3px 7px;border-radius:999px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap;cursor:pointer`;
  el.textContent = label;
  return el;
}

/**
 * The route a rider actually rode (solid), an optional highlighted part of it (thicker green, e.g. one
 * order's own leg), the planned road route (dashed grey) and labelled pins. With `live`, the page reloads
 * its data every 20 s so the line grows while the rider is on the way.
 */
export function RouteMap({ track, highlight = [], planned, markers, live = false, height = "65vh" }: {
  track: LngLat[][];
  highlight?: LngLat[][];
  planned?: LngLat[] | null;
  markers: MapMarker[];
  live?: boolean;
  height?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pins = useRef<maplibregl.Marker[]>([]);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState("Loading map…");
  const router = useRouter();

  useEffect(() => {
    let dead = false;
    (async () => {
      const cfg = (await (await fetch("/api/shop/geo/config")).json()) as { enabled: boolean; styleUrl: string | null; stylePath?: string | null };
      if (dead || !box.current) return;
      if (!cfg.enabled || !cfg.styleUrl) { setNote("Maps are not switched on: set OLA_MAPS_API_KEY on the server."); return; }
      const m = new maplibregl.Map({ container: box.current, style: cfg.stylePath ? `${location.origin}${cfg.stylePath}` : cfg.styleUrl, center: [81.647, 21.2554], zoom: 12 });
      map.current = m;
      m.addControl(new maplibregl.NavigationControl(), "top-right");
      m.on("load", () => {
        const empty = line([]);
        for (const id of ["planned", "gaps", "track", "highlight"]) m.addSource(id, { type: "geojson", data: empty });
        m.addLayer({ id: "planned", type: "line", source: "planned", paint: { "line-color": GREY, "line-width": 4, "line-opacity": 0.7, "line-dasharray": [2, 2] }, layout: { "line-cap": "round" } });
        m.addLayer({ id: "gaps", type: "line", source: "gaps", paint: { "line-color": NAVY, "line-width": 2, "line-opacity": 0.6, "line-dasharray": [1, 3] } });
        m.addLayer({ id: "track", type: "line", source: "track", paint: { "line-color": NAVY, "line-width": 5, "line-opacity": 0.85 }, layout: { "line-cap": "round", "line-join": "round" } });
        m.addLayer({ id: "highlight", type: "line", source: "highlight", paint: { "line-color": GREEN, "line-width": 7 }, layout: { "line-cap": "round", "line-join": "round" } });
        setReady(true);
        setNote("");
      });
    })().catch(() => setNote("Could not load the map."));
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("track") as maplibregl.GeoJSONSource).setData(line(track));
    (m.getSource("gaps") as maplibregl.GeoJSONSource).setData(line(joints(track)));
    (m.getSource("highlight") as maplibregl.GeoJSONSource).setData(line(highlight));
    (m.getSource("planned") as maplibregl.GeoJSONSource).setData(line(planned ? [planned] : []));
    pins.current.forEach((p) => p.remove());
    pins.current = markers.map((k) => {
      const mk = new maplibregl.Marker({ element: pin(k.color, k.label) }).setLngLat([k.lng, k.lat]);
      if (k.popup) mk.setPopup(new maplibregl.Popup({ offset: 14 }).setText(k.popup));
      return mk.addTo(m);
    });
    if (!fitted.current) {
      const all: LngLat[] = [...track.flat(), ...(planned ?? []), ...markers.map((k) => [k.lng, k.lat] as LngLat)];
      if (all.length) {
        fitted.current = true;
        const b = new maplibregl.LngLatBounds(all[0], all[0]);
        all.forEach((p) => b.extend(p));
        m.fitBounds(b, { padding: 60, maxZoom: 16, duration: 0 });
      }
    }
  }, [ready, track, highlight, planned, markers]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [live, router]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border" style={{ height }}>
      <div ref={box} className="h-full w-full" />
      {note ? <div className="absolute inset-0 flex items-center justify-center bg-muted/60 p-6 text-center text-sm">{note}</div> : null}
    </div>
  );
}
