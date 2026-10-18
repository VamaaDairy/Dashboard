"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { liveSnapshot, type Live } from "@/lib/shop/live";

const BLUE = "#2B3990";
const GREEN = "#3AB54A";
const AMBER = "#D97706";

function dot(color: string, label: string) {
  const el = document.createElement("div");
  el.style.cssText = `background:${color};color:#fff;font:600 11px system-ui;padding:3px 7px;border-radius:999px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap`;
  el.textContent = label;
  return el;
}

/** Riders and waiting orders on the Ola map, refreshed every 10 seconds. */
export function LiveMap() {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const fitted = useRef(false);
  const [note, setNote] = useState("Loading map…");
  const [data, setData] = useState<Live | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      const cfg = (await (await fetch("/api/shop/geo/config")).json()) as { enabled: boolean; styleUrl: string | null; stylePath?: string | null };
      if (dead || !box.current) return;
      if (!cfg.enabled || !cfg.styleUrl) { setNote("Maps are not switched on: set OLA_MAPS_API_KEY on the server."); return; }
      map.current = new maplibregl.Map({ container: box.current, style: cfg.stylePath ? `${location.origin}${cfg.stylePath}` : cfg.styleUrl, center: [77.59, 12.97], zoom: 10 });
      map.current.addControl(new maplibregl.NavigationControl(), "top-right");
      setNote("");
    })().catch(() => setNote("Could not load the map."));
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    let dead = false;
    const tick = async () => { const d = await liveSnapshot(); if (!dead && d) setData(d); };
    void tick();
    const t = setInterval(tick, 10_000);
    return () => { dead = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !data) return;
    markers.current.forEach((x) => x.remove());
    markers.current = [];
    const pts: Array<[number, number]> = [];
    for (const o of data.orders) {
      const colour = o.status === "out_for_delivery" ? GREEN : o.rider ? BLUE : AMBER;
      const popup = new maplibregl.Popup({ offset: 14 }).setText(`${o.orderNo} · ${o.name}\n${o.address}\n${o.rider ? `Rider: ${o.rider}` : "Not assigned"}`);
      markers.current.push(new maplibregl.Marker({ element: dot(colour, o.orderNo.slice(-4)) }).setLngLat([o.lng, o.lat]).setPopup(popup).addTo(m));
      pts.push([o.lng, o.lat]);
    }
    for (const r of data.riders) {
      const popup = new maplibregl.Popup({ offset: 14 }).setText(`${r.name} · ${r.phone}\n${r.open} to deliver · seen ${r.seenSecondsAgo}s ago`);
      markers.current.push(new maplibregl.Marker({ element: dot("#111827", `🏍 ${r.name.split(" ")[0]}`) }).setLngLat([r.lng, r.lat]).setPopup(popup).addTo(m));
      pts.push([r.lng, r.lat]);
    }
    if (pts.length && !fitted.current) {
      fitted.current = true;
      const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: 60, maxZoom: 15, duration: 0 });
    }
  }, [data, note]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: AMBER }} />Waiting for a rider</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: BLUE }} />Assigned</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: GREEN }} />Out for delivery</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-gray-900" />Rider</span>
        {data ? <span className="ml-auto">{data.riders.length} riders · {data.orders.length} open orders · updates every 10 s</span> : null}
      </div>
      <div className="relative h-[70vh] overflow-hidden rounded-lg border border-border">
        <div ref={box} className="h-full w-full" />
        {note ? <div className="absolute inset-0 flex items-center justify-center bg-muted/60 p-6 text-center text-sm">{note}</div> : null}
      </div>
    </div>
  );
}
