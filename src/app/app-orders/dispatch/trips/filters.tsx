"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const VIEWS = [
  { id: "table", label: "Table" },
  { id: "calendar", label: "Calendar" },
  { id: "board", label: "Board" },
] as const;
const STATUSES = [
  { id: "", label: "Any status" },
  { id: "planned", label: "Planned" },
  { id: "on_the_way", label: "On the way" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const minus = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

/** The Trips page's view and filters, kept in the address so a view can be shared or bookmarked. */
export function TripFilters(p: {
  view: string; from: string; to: string; today: string; status: string; transporter: string; route: string; q: string;
  transporters: Array<{ id: number; name: string }>; routes: string[];
}) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(p.q);
  const set = (patch: Record<string, string | null>) => {
    const s = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) s.set(k, v);
      else s.delete(k);
    }
    router.push(`${path}?${s.toString()}`);
  };
  const box = "h-8 rounded-lg border border-input bg-background px-2 text-[13px]";
  const presets = [7, 30, 90].map((n) => ({ label: `${n} days`, from: minus(p.today, n - 1) }));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-input p-0.5" role="tablist" aria-label="View">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={p.view === v.id} onClick={() => set({ view: v.id === "table" ? null : v.id })}
            className={cn("rounded-md px-3 py-1 text-[13px]", p.view === v.id ? "bg-foreground font-semibold text-background" : "text-muted-foreground hover:text-foreground")}>
            {v.label}
          </button>
        ))}
      </div>
      {p.view !== "calendar" ? (
        <>
          {presets.map((x) => (
            <button key={x.label} type="button" onClick={() => set({ from: x.from, to: p.today })}
              className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold", p.from === x.from && p.to === p.today ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}>
              {x.label}
            </button>
          ))}
          <input type="date" value={p.from} max={p.to} onChange={(e) => e.target.value && set({ from: e.target.value })} className={box} aria-label="From" />
          <span className="text-[12px] text-muted-foreground">to</span>
          <input type="date" value={p.to} min={p.from} onChange={(e) => e.target.value && set({ to: e.target.value })} className={box} aria-label="To" />
        </>
      ) : null}
      <select value={p.status} onChange={(e) => set({ status: e.target.value || null })} className={box} aria-label="Status">
        {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <select value={p.transporter} onChange={(e) => set({ transporter: e.target.value || null })} className={box} aria-label="Transporter">
        <option value="">Every transporter</option>
        {p.transporters.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select value={p.route} onChange={(e) => set({ route: e.target.value || null })} className={box} aria-label="Route">
        <option value="">Every route</option>
        {p.routes.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <form onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() || null }); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer, order no., vehicle…" className={cn(box, "w-56")} aria-label="Search trips" />
      </form>
    </div>
  );
}
