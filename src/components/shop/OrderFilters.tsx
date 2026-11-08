"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

const ctl = "h-8 rounded-lg border border-foreground/15 bg-card px-2 text-[13px] text-foreground outline-none focus:border-foreground/40";

/** Search and filters for D2C orders; every change goes into the URL (and back to page 1). */
export function OrderFilters({ ranges, riders, pins }: {
  ranges: Array<[string, string]>;
  riders: Array<{ id: number; name: string }>;
  pins: Array<{ pin: string; n: number }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) if (v) p.set(k, v); else p.delete(k);
    p.delete("page");
    router.push(p.size ? `/shop-orders?${p}` : "/shop-orders");
  };
  const range = sp.get("range") ?? "all";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-foreground/10 py-3 pr-32 pl-4">
      <form onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() || null }); }} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-foreground/60" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order no, customer, phone, address" className={`${ctl} w-80 pl-8 placeholder:text-foreground/55`} />
      </form>
      <select value={range} onChange={(e) => set({ range: e.target.value === "all" ? null : e.target.value })} className={ctl} aria-label="Date">
        {ranges.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {range === "custom" ? (
        <>
          <input type="date" defaultValue={sp.get("from") ?? ""} onChange={(e) => set({ from: e.target.value || null })} className={ctl} aria-label="From" />
          <span className="text-[13px] text-foreground/75">to</span>
          <input type="date" defaultValue={sp.get("to") ?? ""} onChange={(e) => set({ to: e.target.value || null })} className={ctl} aria-label="To" />
        </>
      ) : null}
      <select value={sp.get("kind") ?? ""} onChange={(e) => set({ kind: e.target.value || null })} className={ctl} aria-label="Type">
        <option value="">All types</option><option value="regular">Regular</option><option value="subscription">Subscription</option>
      </select>
      <select value={sp.get("pay") ?? ""} onChange={(e) => set({ pay: e.target.value || null })} className={ctl} aria-label="Payment">
        <option value="">All payments</option><option value="cod">Cash on delivery</option><option value="online">Online</option><option value="autopay">Autopay</option>
      </select>
      <select value={sp.get("rider") ?? ""} onChange={(e) => set({ rider: e.target.value || null })} className={ctl} aria-label="Rider">
        <option value="">All riders</option><option value="none">Not assigned</option>
        {riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <select value={sp.get("pin") ?? ""} onChange={(e) => set({ pin: e.target.value || null })} className={ctl} aria-label="Pincode">
        <option value="">All pincodes</option>
        {pins.map((p) => <option key={p.pin} value={p.pin}>{p.pin} ({p.n})</option>)}
      </select>
      {[...sp.keys()].some((k) => k !== "status" && k !== "page") ? (
        <button type="button" onClick={() => { setQ(""); const s = sp.get("status"); router.push(s ? `/shop-orders?status=${s}` : "/shop-orders"); }} className="text-[13px] text-foreground/75 hover:text-foreground">Reset filters</button>
      ) : null}
    </div>
  );
}
