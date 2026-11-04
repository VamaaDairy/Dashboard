"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "@/lib/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { teamSnapshot, teamTrail } from "@/app/employee-app/actions";
import type { TeamMember, TrailPoint, TrailVisit } from "@/lib/employee/admin";

const BLUE = "#2B3990";
const GREEN = "#1E8E3E";
const GREY = "#6B7280";
const AMBER = "#D97706";

const rs = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 90 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`;
};
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "—");

function pin(color: string, label: string) {
  const el = document.createElement("div");
  el.style.cssText = `background:${color};color:#fff;font:600 11px system-ui;padding:3px 8px;border-radius:999px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap`;
  el.textContent = label;
  return el;
}

/** The live position of every sales employee (refreshed every 15 s) and, for one person and day, the route they walked. */
export function TeamLive({ initial }: { initial: TeamMember[] }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const trailMarkers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState("Loading map…");
  const [team, setTeam] = useState<TeamMember[]>(initial);
  const [picked, setPicked] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10));
  const [fetched, setFetched] = useState<{ key: string; points: TrailPoint[]; visits: TrailVisit[]; name: string | null } | null>(null);
  // only the trail that belongs to the person and day on screen
  const trail = picked && fetched?.key === `${picked}|${date}` ? fetched : null;

  useEffect(() => {
    let dead = false;
    (async () => {
      const cfg = (await (await fetch("/api/shop/geo/config")).json()) as { enabled: boolean; styleUrl: string | null; stylePath?: string | null };
      if (dead || !box.current) return;
      if (!cfg.enabled || !cfg.styleUrl) { setNote("Maps are not switched on: set OLA_MAPS_API_KEY on the server. The list still works."); return; }
      const m = new maplibregl.Map({ container: box.current, style: cfg.stylePath ? `${location.origin}${cfg.stylePath}` : cfg.styleUrl, center: [77.59, 12.97], zoom: 10 });
      m.addControl(new maplibregl.NavigationControl(), "top-right");
      m.on("load", () => {
        m.addSource("trail", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({ id: "trail", type: "line", source: "trail", paint: { "line-color": BLUE, "line-width": 4, "line-opacity": 0.8 } });
        if (!dead) setReady(true);
      });
      map.current = m;
      setNote("");
    })().catch(() => setNote("Could not load the map."));
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, []);

  const refresh = useCallback(async () => {
    const t = await teamSnapshot();
    if (t) setTeam(t);
  }, []);
  useEffect(() => {
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  // one person's route for the chosen day
  useEffect(() => {
    if (!picked) return;
    let dead = false;
    void teamTrail(picked, date).then((r) => { if (!dead && r) setFetched({ key: `${picked}|${date}`, ...r }); });
    return () => { dead = true; };
  }, [picked, date, team]);

  // everyone's latest position
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    markers.current.forEach((x) => x.remove());
    markers.current = [];
    const pts: Array<[number, number]> = [];
    for (const t of team) {
      if (t.lat == null || t.lng == null) continue;
      const live = !!t.startedAt && !t.endedAt;
      const stale = !t.seenAt || Date.now() - new Date(t.seenAt).getTime() > 15 * 60_000;
      const colour = !live ? GREY : stale ? AMBER : GREEN;
      const popup = new maplibregl.Popup({ offset: 14 }).setText(`${t.name}\n${t.atStore ? `At ${t.atStore}` : live ? "On the move" : "Day not running"}\nSeen ${ago(t.seenAt)}${t.battery != null ? ` · battery ${t.battery}%` : ""}`);
      markers.current.push(new maplibregl.Marker({ element: pin(colour, t.name.split(" ")[0]) }).setLngLat([t.lng, t.lat]).setPopup(popup).addTo(m));
      pts.push([t.lng, t.lat]);
    }
    if (pts.length && !picked) {
      const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 0 });
    }
  }, [team, ready, picked]);

  // the route line and its visits
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    trailMarkers.current.forEach((x) => x.remove());
    trailMarkers.current = [];
    const src = m.getSource("trail") as maplibregl.GeoJSONSource | undefined;
    const coords = (trail?.points ?? []).map((p) => [p.lng, p.lat] as [number, number]);
    src?.setData({ type: "FeatureCollection", features: coords.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [] });
    const all = [...coords];
    (trail?.visits ?? []).forEach((v, i) => {
      if (v.lat == null || v.lng == null) return;
      all.push([v.lng, v.lat]);
      const popup = new maplibregl.Popup({ offset: 14 }).setText(`${v.store}\n${hhmm(v.inAt)} – ${hhmm(v.outAt)}${v.verified ? " · verified" : ""}\n${v.orders ? `${v.orders} order · ${rs(v.value)}` : v.outcome ? v.outcome.replace("_", " ") : "in progress"}`);
      trailMarkers.current.push(new maplibregl.Marker({ element: pin(v.orders ? GREEN : BLUE, String(i + 1)) }).setLngLat([v.lng, v.lat]).setPopup(popup).addTo(m));
    });
    if (all.length) {
      const b = new maplibregl.LngLatBounds(all[0], all[0]);
      all.forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: 60, maxZoom: 15, duration: 400 });
    }
  }, [trail, ready]);

  const on = team.filter((t) => t.startedAt && !t.endedAt).length;
  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div className="max-h-[75vh] space-y-2 overflow-y-auto">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{on} on the field · {team.length} in the team</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
        </div>
        {team.map((t) => {
          const live = !!t.startedAt && !t.endedAt;
          return (
            <button key={t.uid} onClick={() => setPicked(picked === t.uid ? null : t.uid)}
              className={`w-full rounded-lg border p-3 text-left text-sm transition ${picked === t.uid ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"}`}>
              <div className="flex items-center gap-2">
                <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: live ? GREEN : GREY }} />
                <b className="truncate">{t.name}</b>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{live ? "On duty" : t.endedAt ? "Day ended" : "Not started"}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t.atStore ? `At ${t.atStore} · ` : ""}Started {hhmm(t.startedAt)} · seen {ago(t.seenAt)}{t.battery != null ? ` · 🔋${t.battery}%` : ""}
              </div>
              <div className="mt-1 text-xs">{t.visits} visits ({t.verified} verified) · {t.orders} orders {rs(t.orderValue)} · {t.km.toFixed(1)} km</div>
            </button>
          );
        })}
        {team.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No sales employees yet.</p> : null}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: GREEN }} />On duty</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: AMBER }} />No signal for 15+ min</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: GREY }} />Day not running</span>
          {picked && trail ? <span className="ml-auto">{trail.name}: {trail.points.length} location points · {trail.visits.length} store visits on {date}</span> : <span className="ml-auto">Click a person to see their route</span>}
        </div>
        <div className="relative h-[70vh] overflow-hidden rounded-lg border border-border">
          <div ref={box} className="h-full w-full" />
          {note ? <div className="absolute inset-0 flex items-center justify-center bg-muted/60 p-6 text-center text-sm">{note}</div> : null}
        </div>
      </div>
    </div>
  );
}
