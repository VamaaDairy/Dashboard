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
 * pill: a label pill (the plant, a truck); pin: a location pin with [mark] inside it and [label] beside it.
 */
export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  kind: "dot" | "num" | "pill" | "pin" | "stop";
  color: string;
  label?: string;
  /** pin: the few characters inside the pin (a stop number) */
  mark?: string;
  popup?: string;
  hollow?: boolean;
  dim?: boolean;
  /** drawn above the others (the truck) */
  top?: boolean;
  /** stop: a ring round the circle in this colour (a late stop) */
  ring?: string;
  /** pill: white with a coloured border and text, quieter than the solid pill */
  ghost?: boolean;
}

function pinElement(p: MapPin): HTMLElement {
  const el = document.createElement("div");
  el.style.cursor = "pointer";
  if (p.dim) el.style.opacity = "0.4";
  if (p.kind === "num") {
    el.style.cssText += `;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 11px system-ui;box-shadow:0 1px 3px rgba(0,0,0,.3);border:2px solid ${p.hollow ? p.color : "#fff"};background:${p.hollow ? "#fff" : p.color};color:${p.hollow ? p.color : "#fff"}`;
    el.textContent = p.label ?? "";
  } else if (p.kind === "pin") {
    // the pin's tip sits on the point (anchored bottom-left, moved left by half its width)
    el.style.cssText += ";display:flex;align-items:flex-start;gap:4px;height:40px";
    const pin = document.createElement("div");
    pin.style.cssText = "position:relative;width:30px;height:40px;flex:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))";
    pin.innerHTML = `<svg width="30" height="40" viewBox="0 0 40 52"><path d="M20 50C20 50 3 31 3 19a17 17 0 0 1 34 0c0 12-17 31-17 31z" fill="${p.color}" stroke="#fff" stroke-width="2.5"/></svg>`;
    const mark = document.createElement("span");
    mark.style.cssText = "position:absolute;top:5px;left:0;width:30px;text-align:center;color:#fff;font:700 12px system-ui";
    mark.textContent = p.mark ?? "";
    pin.append(mark);
    el.append(pin);
    if (p.label) {
      const t = document.createElement("span");
      t.style.cssText = "margin-top:4px;background:#fff;border:1px solid #9aa0a6;border-radius:6px;padding:1px 6px;font:600 12px/1.35 system-ui,-apple-system,sans-serif;color:#1f2329;white-space:nowrap";
      t.textContent = p.label;
      el.append(t);
    }
  } else if (p.kind === "pill") {
    el.style.cssText += p.ghost
      ? `;background:rgba(255,255,255,.95);color:${p.color};font:700 11px system-ui;padding:2px 7px;border-radius:999px;border:1.5px solid ${p.color};box-shadow:0 1px 3px rgba(0,0,0,.2);white-space:nowrap`
      : `;background:${p.color};color:#fff;font:600 11px system-ui;padding:3px 8px;border-radius:999px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap`;
    el.textContent = p.label ?? "";
  } else if (p.kind === "stop") {
    // a numbered circle centred on the point, its name in a small chip beside it
    el.style.cssText += ";display:flex;align-items:center;gap:5px";
    const c = document.createElement("span");
    const ring = p.ring ? `,0 0 0 5px ${p.ring}` : "";
    c.style.cssText = `width:28px;height:28px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${p.color};color:#fff;font:800 13px system-ui;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)${ring}`;
    c.textContent = p.mark ?? "";
    el.append(c);
    if (p.label) {
      const t = document.createElement("span");
      t.style.cssText = "background:rgba(255,255,255,.94);border-radius:6px;padding:1px 6px;font:600 11.5px/1.35 system-ui,-apple-system,sans-serif;color:#1f2329;white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 3px rgba(0,0,0,.25)";
      t.textContent = p.label;
      el.append(t);
    }
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

const sig = (p: MapPin) => [p.kind, p.color, p.label, p.mark, p.popup, p.hollow, p.dim, p.top, p.ring, p.ghost].join("|");

/** A small white chevron pointing along the line, drawn once and used by the arrows layer. */
function arrowImage(): ImageData {
  const c = document.createElement("canvas");
  c.width = 24;
  c.height = 24;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 4;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(8, 5);
  g.lineTo(16, 12);
  g.lineTo(8, 19);
  g.stroke();
  return g.getImageData(0, 0, 24, 24);
}

/**
 * The Ola map with any number of lines and pins (Dispatch: Live, a trip, the Plan map). It fits itself to everything
 * the first time there is something to show, and to `focus` whenever its key changes. It fills its parent.
 * `clear`: for following one route - the streets fade behind a light veil, the roads get a dark halo and arrows
 * show which way the vehicle drives.
 */
export function DispatchMap({ lines, pins, focus, onPin, clear = false, className = "" }: {
  lines: MapLine[];
  pins: MapPin[];
  focus?: { key: string; points: LngLat[] } | null;
  onPin?: (id: string) => void;
  clear?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, { m: maplibregl.Marker; sig: string }>());
  const fitted = useRef(false);
  const lastFocus = useRef<string | null>(null);
  const clicked = useRef(onPin);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState("Loading map…");
  const clearStyle = useRef(clear);
  useEffect(() => { clicked.current = onPin; }, [onPin]);

  useEffect(() => {
    let dead = false;
    const kept = markers.current;
    (async () => {
      const cfg = (await (await fetch("/api/shop/geo/config")).json()) as { enabled: boolean; styleUrl: string | null; stylePath?: string | null };
      if (dead || !box.current) return;
      if (!cfg.enabled || !cfg.styleUrl) { setNote("Maps are not switched on: set OLA_MAPS_API_KEY on the server."); return; }
      const m = new maplibregl.Map({ container: box.current, style: cfg.stylePath ? `${location.origin}${cfg.stylePath}` : cfg.styleUrl, center: [81.647, 21.2554], zoom: 10 });
      map.current = m;
      m.addControl(new maplibregl.NavigationControl(), "top-right");
      m.on("load", () => {
        m.addSource("lines", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        const round = { "line-cap": "round", "line-join": "round" } as const;
        if (clearStyle.current) {
          // a light veil over the streets, under the route, so the route stands out
          m.addSource("veil", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } } });
          m.addLayer({ id: "veil", type: "fill", source: "veil", paint: { "fill-color": "#ffffff", "fill-opacity": 0.45 } });
          m.addLayer({ id: "halo", type: "line", source: "lines", layout: round,
            paint: { "line-color": "#0b1a33", "line-width": ["+", ["get", "width"], 7], "line-opacity": ["*", ["get", "opacity"], 0.28], "line-blur": 2 } });
        }
        // a white casing under the solid lines so they read cleanly over the streets
        m.addLayer({ id: "casing", type: "line", source: "lines", filter: ["==", ["get", "dashed"], false], layout: round,
          paint: { "line-color": "#ffffff", "line-width": ["+", ["get", "width"], 3], "line-opacity": ["*", ["get", "opacity"], 0.85] } });
        m.addLayer({ id: "solid", type: "line", source: "lines", filter: ["==", ["get", "dashed"], false], layout: round,
          paint: { "line-color": ["get", "color"], "line-width": ["get", "width"], "line-opacity": ["get", "opacity"] } });
        m.addLayer({ id: "dashed", type: "line", source: "lines", filter: ["==", ["get", "dashed"], true],
          paint: { "line-color": ["get", "color"], "line-width": ["get", "width"], "line-opacity": ["get", "opacity"], "line-dasharray": [2, 1.6] } });
        if (clearStyle.current) {
          m.addImage("route-arrow", arrowImage(), { pixelRatio: 2 });
          m.addLayer({ id: "arrows", type: "symbol", source: "lines",
            layout: { "symbol-placement": "line", "symbol-spacing": 90, "icon-image": "route-arrow", "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 1, 14, 1.5, 17, 1.9],
              "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true },
            paint: { "icon-opacity": ["get", "opacity"] } });
        }
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
      const mk = new maplibregl.Marker({
        element: el,
        anchor: p.kind === "dot" || p.kind === "stop" ? "left" : p.kind === "pin" ? "bottom-left" : "center",
        offset: p.kind === "dot" ? [-9, 0] : p.kind === "stop" ? [-14, 0] : p.kind === "pin" ? [-15, 0] : [0, 0],
      }).setLngLat([p.lng, p.lat]);
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
      m.fitBounds(b, { padding: 60, maxZoom, duration: fitted.current ? 600 : 0 });
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
