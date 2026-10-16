"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPoint } from "@/lib/orders/analytics";

const LEAFLET = "1.9.4";

/** OpenStreetMap via Leaflet (loaded from a CDN on demand). Employees are blue, outlets are green. */
export function TeamMap({ points }: { points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: { remove: () => void } | null = null;
    let dead = false;
    (async () => {
      try {
        if (!document.getElementById("leaflet-css")) {
          const css = document.createElement("link");
          css.id = "leaflet-css"; css.rel = "stylesheet";
          css.href = `https://unpkg.com/leaflet@${LEAFLET}/dist/leaflet.css`;
          document.head.appendChild(css);
        }
        type LeafletWin = { L?: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
        const w = window as unknown as LeafletWin;
        if (!w.L) {
          await new Promise<void>((ok, bad) => {
            const s = document.createElement("script");
            s.src = `https://unpkg.com/leaflet@${LEAFLET}/dist/leaflet.js`;
            s.onload = () => ok(); s.onerror = () => bad(new Error("leaflet"));
            document.body.appendChild(s);
          });
        }
        if (dead || !el.current || !w.L) return;
        const L = w.L;
        const m = L.map(el.current).setView(points.length ? [points[0].lat, points[0].lng] : [18.52, 73.85], 11);
        map = m;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 18 }).addTo(m);
        const group: unknown[] = [];
        for (const p of points) {
          const c = L.circleMarker([p.lat, p.lng], {
            radius: p.kind === "employee" ? 8 : 5, color: p.kind === "employee" ? "#2563eb" : "#16a34a",
            fillOpacity: 0.8, weight: 1,
          }).addTo(m);
          const box = document.createElement("div");
          const b = document.createElement("b"); b.textContent = p.name;
          box.append(b, document.createElement("br"), document.createTextNode(p.detail));
          c.bindPopup(box);
          group.push(c);
        }
        if (group.length > 1) m.fitBounds(L.featureGroup(group).getBounds().pad(0.2));
      } catch {
        if (!dead) setFailed(true);
      }
    })();
    return () => { dead = true; map?.remove(); };
  }, [points]);

  if (failed || points.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
        {points.length === 0 ? "No coordinates yet - add outlet latitude/longitude or location log entries." : "The map could not load (needs internet access to OpenStreetMap)."}
      </div>
    );
  }
  return <div ref={el} className="h-[28rem] w-full" />;
}
