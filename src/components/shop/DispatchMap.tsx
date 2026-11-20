"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "@/lib/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LngLat } from "@/lib/shop/track";

/** A line on the map: one or more stretches in one colour. Later lines draw over earlier ones. */
export interface MapLine { id: string; paths: LngLat[][]; color: string; width?: number; opacity?: number; dashed?: boolean }

/**
 * A pin. dot: a ringed dot with its name beside it; num: a numbered circle (hollow for a stop still to do);
 * pill: a label pill (the plant, a truck).
 */
export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  kind: "dot" | "num" | "pill";
  color: string;
  label?: string;
  popup?: string;
  hollow?: boolean;
  dim?: boolean;
  /** drawn above the others (the truck) */
  top?: boolean;
}

function pinElement(p: MapPin): HTMLElement {
  const el = document.createElement("div");
  el.style.cursor = "pointer";
  if (p.dim) el.style.opacity = "0.4";
  if (p.kind === "num") {
    el.style.cssText += `;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 11px system-ui;box-shadow:0 1px 3px rgba(0,0,0,.3);border:2px solid ${p.hollow ? p.color : "#fff"};background:${p.hollow ? "#fff" : p.color};color:${p.hollow ? p.color : "#fff"}`;
    el.textContent = p.label ?? "";
  } else if (p.kind === "pill") {
    el.style.cssText += `;background:${p.color};color:#fff;font:600 11px system-ui;padding:3px 8px;border-radius:999px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap`;
    el.textContent = p.label ?? "";
  } else {
    el.style.cssText += ";display:flex;align-items:center;gap:6px";
    const d = document.createElement("span");
    d.style.cssText = `width:13px;height:13px;border-radius:50%;background:${p.color};border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.18),0 1px 3px rgba(0,0,0,.25);flex:none`;
    el.append(d);
    if (p.label) {
      const t = document.createElement("span");
      t.style.cssText = "font:600 12px/1.2 system-ui,-apple-system,sans-serif;color:#1f2329;white-space:nowrap;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 4px #fff";
      t.textContent = p.label;
      el.append(t);
    }
  }
  return el;
}

const sig = (p: MapPin) => [p.kind, p.color, p.label, p.popup, p.hollow, p.dim, p.top].join("|");

/**
 * The Ola map with any number of lines and pins (Dispatch: Live, a trip, the Plan map). It fits itself to everything
 * the first time there is something to show, and to `focus` whenever its key changes. It fills its parent.
 */
export function DispatchMap({ lines, pins, focus, onPin, className = "", controls = "top-right", fitPadding = 60 }: {
  lines: MapLine[];
  pins: MapPin[];
  focus?: { key: string; points: LngLat[] } | null;
  onPin?: (id: string) => void;
  className?: string;
  /** where the zoom buttons sit (keep them clear of a floating panel) */
  controls?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
  /** room kept clear when fitting the view, e.g. the width of a floating panel on one side */
  fitPadding?: number | { top: number; right: number; bottom: number; left: number };
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, { m: maplibregl.Marker; sig: string }>());
  const fitted = useRef(false);
  const lastFocus = useRef<string | null>(null);
  const clicked = useRef(onPin);
  const padding = useRef(fitPadding);
  const corner = useRef(controls);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState("Loading map…");
  useEffect(() => { clicked.current = onPin; }, [onPin]);
  useEffect(() => { padding.current = fitPadding; }, [fitPadding]);

  useEffect(() => {
    let dead = false;
    const kept = markers.current;
    (async () => {
      const cfg = (await (await fetch("/api/shop/geo/config")).json()) as { enabled: boolean; styleUrl: string | null; stylePath?: string | null };
      if (dead || !box.current) return;
      if (!cfg.enabled || !cfg.styleUrl) { setNote("Maps are not switched on: set OLA_MAPS_API_KEY on the server."); return; }
      const m = new maplibregl.Map({ container: box.current, style: cfg.stylePath ? `${location.origin}${cfg.stylePath}` : cfg.styleUrl, center: [81.647, 21.2554], zoom: 10 });
      map.current = m;
      m.addControl(new maplibregl.NavigationControl(), corner.current);
      m.on("load", () => {
        m.addSource("lines", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        const round = { "line-cap": "round", "line-join": "round" } as const;
        // a white casing under the solid lines so they read cleanly over the streets
        m.addLayer({ id: "casing", type: "line", source: "lines", filter: ["==", ["get", "dashed"], false], layout: round,
          paint: { "line-color": "#ffffff", "line-width": ["+", ["get", "width"], 3], "line-opacity": ["*", ["get", "opacity"], 0.85] } });
        m.addLayer({ id: "solid", type: "line", source: "lines", filter: ["==", ["get", "dashed"], false], layout: round,
          paint: { "line-color": ["get", "color"], "line-width": ["get", "width"], "line-opacity": ["get", "opacity"] } });
        m.addLayer({ id: "dashed", type: "line", source: "lines", filter: ["==", ["get", "dashed"], true],
          paint: { "line-color": ["get", "color"], "line-width": ["get", "width"], "line-opacity": ["get", "opacity"], "line-dasharray": [2, 1.6] } });
        setReady(true);
        setNote("");
      });
    })().catch(() => setNote("Could not load the map."));
    return () => {
      dead = true;
      kept.forEach((x) => x.m.remove());
      kept.clear();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // the lines
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const features: GeoJSON.Feature[] = [];
    for (const l of lines) {
      for (const p of l.paths) {
        if (p.length < 2) continue;
        features.push({ type: "Feature", properties: { color: l.color, width: l.width ?? 4, opacity: l.opacity ?? 1, dashed: !!l.dashed }, geometry: { type: "LineString", coordinates: p } });
      }
    }
    (m.getSource("lines") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features });
  }, [ready, lines]);

  // the pins: moved in place, made again only when they look different
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const kept = markers.current;
    const seen = new Set<string>();
    for (const p of pins) {
      seen.add(p.id);
      const k = sig(p);
      const had = kept.get(p.id);
      if (had && had.sig === k) {
        had.m.setLngLat([p.lng, p.lat]);
        continue;
      }
      had?.m.remove();
      const el = pinElement(p);
      if (p.top) el.style.zIndex = "5";
      el.addEventListener("click", (e) => { if (clicked.current) { e.stopPropagation(); clicked.current(p.id); } });
      const mk = new maplibregl.Marker({ element: el, anchor: p.kind === "dot" ? "left" : "center", offset: p.kind === "dot" ? [-9, 0] : [0, 0] }).setLngLat([p.lng, p.lat]);
      if (p.popup) mk.setPopup(new maplibregl.Popup({ offset: 14 }).setText(p.popup));
      kept.set(p.id, { m: mk.addTo(m), sig: k });
    }
    for (const [id, x] of kept) if (!seen.has(id)) { x.m.remove(); kept.delete(id); }
  }, [ready, pins]);

  // the view: everything once, then whatever is asked for
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const fit = (pts: LngLat[], maxZoom: number) => {
      if (!pts.length) return false;
      const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: padding.current, maxZoom, duration: fitted.current ? 600 : 0 });
      return true;
    };
    if (focus && focus.key !== lastFocus.current) {
      lastFocus.current = focus.key;
      if (fit(focus.points, 16)) fitted.current = true;
      return;
    }
    if (!fitted.current) {
      const all: LngLat[] = [...lines.flatMap((l) => l.paths.flat()), ...pins.map((p) => [p.lng, p.lat] as LngLat)];
      if (fit(all, 15)) fitted.current = true;
    }
  }, [ready, focus, lines, pins]);

  return (
    <div className={`relative h-full w-full ${className}`}>
      <div ref={box} className="h-full w-full" />
      {note ? <div className="absolute inset-0 flex items-center justify-center bg-muted/60 p-6 text-center text-sm">{note}</div> : null}
    </div>
  );
}
