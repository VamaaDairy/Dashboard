"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as maplibregl from "maplibre-gl";
import "@/lib/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LngLat } from "@/lib/shop/track";
import { AMBER, GREEN, GREY, NAVY, type MapMarker } from "./route-colors";

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

/** A map-style marker: a coloured dot with a white ring, and its name beside it in dark text with a white halo. */
function dot(color: string, label: string) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;align-items:center;gap:6px;cursor:pointer";
  const d = document.createElement("span");
  d.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.18),0 1px 3px rgba(0,0,0,.25);flex:none`;
  const t = document.createElement("span");
  t.style.cssText = "font:600 12px/1.2 system-ui,-apple-system,sans-serif;color:#1f2329;white-space:nowrap;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 4px #fff";
  t.textContent = label;
  el.append(d, t);
  return el;
}

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
/** The planned road route when it is drawn solid (Dispatch): a light navy under the driven route's dark navy. */
export const PLAN_SOLID = "#8FA0D8";

export function RouteMap({ track, highlight = [], off = [], planned, markers, live = false, height = "65vh", plain = false, solid = false }: {
  track: LngLat[][];
  highlight?: LngLat[][];
  /** stretches driven away from the planned road, drawn amber over the track */
  off?: LngLat[][];
  planned?: LngLat[] | null;
  markers: MapMarker[];
  live?: boolean;
  height?: string;
  /** No frame of its own (the page's card is the frame) and plain dot markers instead of label pills. */
  plain?: boolean;
  /** Draw the planned route and the signal gaps as solid lines (the planned one light navy) instead of dashes and dots. */
  solid?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pins = useRef<maplibregl.Marker[]>([]);
  const fitted = useRef(false);
  // the line style is set once, when the map is made
  const solidLines = useRef(solid);
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
        for (const id of ["planned", "gaps", "track", "off", "highlight"]) m.addSource(id, { type: "geojson", data: empty });
        // a white casing under the routes so they read cleanly over the streets
        m.addLayer({ id: "planned-casing", type: "line", source: "planned", paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.9 }, layout: { "line-cap": "round", "line-join": "round" } });
        m.addLayer({ id: "track-casing", type: "line", source: "track", paint: { "line-color": "#ffffff", "line-width": 8 }, layout: { "line-cap": "round", "line-join": "round" } });
        m.addLayer(solidLines.current
          ? { id: "planned", type: "line", source: "planned", paint: { "line-color": PLAN_SOLID, "line-width": 4.5, "line-opacity": 0.95 }, layout: { "line-cap": "round", "line-join": "round" } }
          : { id: "planned", type: "line", source: "planned", paint: { "line-color": GREY, "line-width": 3, "line-opacity": 0.85, "line-dasharray": [2, 1.5] }, layout: { "line-cap": "round" } });
        m.addLayer(solidLines.current
          ? { id: "gaps", type: "line", source: "gaps", paint: { "line-color": NAVY, "line-width": 3, "line-opacity": 0.6 }, layout: { "line-cap": "round" } }
          : { id: "gaps", type: "line", source: "gaps", paint: { "line-color": NAVY, "line-width": 2, "line-opacity": 0.6, "line-dasharray": [1, 3] } });
        m.addLayer({ id: "track", type: "line", source: "track", paint: { "line-color": NAVY, "line-width": 4.5 }, layout: { "line-cap": "round", "line-join": "round" } });
        m.addLayer({ id: "off", type: "line", source: "off", paint: { "line-color": AMBER, "line-width": 5 }, layout: { "line-cap": "round", "line-join": "round" } });
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
    (m.getSource("off") as maplibregl.GeoJSONSource).setData(line(off));
    (m.getSource("highlight") as maplibregl.GeoJSONSource).setData(line(highlight));
    (m.getSource("planned") as maplibregl.GeoJSONSource).setData(line(planned ? [planned] : []));
    pins.current.forEach((p) => p.remove());
    pins.current = markers.map((k) => {
      // a plain marker sits on its dot (10 px from the left edge), with the name to the right
      const mk = (plain ? new maplibregl.Marker({ element: dot(k.color, k.label), anchor: "left", offset: [-10, 0] }) : new maplibregl.Marker({ element: pin(k.color, k.label) })).setLngLat([k.lng, k.lat]);
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
  }, [ready, track, highlight, off, planned, markers, plain]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [live, router]);

  return (
    <div className={plain ? "relative overflow-hidden border-t border-foreground/10" : "relative overflow-hidden rounded-lg border border-border"} style={{ height }}>
      <div ref={box} className="h-full w-full" />
      {note ? <div className="absolute inset-0 flex items-center justify-center bg-foreground/[0.03] p-6 text-center text-[13px] text-foreground/75">{note}</div> : null}
    </div>
  );
}
