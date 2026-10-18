"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { FILTER_KEYS, type FilterOptions, type NoteFilter } from "@/lib/creditnote/filters";

const sel =
  "h-8 w-full rounded-lg border border-input bg-white px-2 text-sm text-neutral-900 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const lbl = "mb-1 block text-[11px] font-medium text-muted-foreground";

const STATUSES = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The filter bar for credit notes. Every change goes into the page's URL, so the
 * page filters on the server and a filtered view can be bookmarked or shared.
 * `counts` are the notes per status under the other filters.
 */
export function NoteFilters({ filter, options, counts, today, shown, total }: {
  filter: NoteFilter; options: FilterOptions; counts: Record<string, number>; today: string; shown: number; total: number;
}) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(filter.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const go = (patch: Partial<NoteFilter>) => {
    const next = { ...filter, q, ...patch };
    const qs = new URLSearchParams();
    for (const k of FILTER_KEYS) if (next[k]) qs.set(k, next[k]);
    router.push(qs.size ? `${path}?${qs}` : path);
  };

  const active = FILTER_KEYS.some((k) => filter[k]);
  const pick = (label: string, key: keyof NoteFilter, values: string[]) => (
    <label>
      <span className={lbl}>{label}</span>
      <select className={sel} value={filter[key]} onChange={(e) => go({ [key]: e.target.value })}>
        <option value="">All</option>
        {values.map((v) => <option key={v} value={v} className="bg-white text-neutral-900">{v}</option>)}
      </select>
    </label>
  );
  const preset = (label: string, from: string, to: string) => {
    const on = filter.from === from && filter.to === to;
    return (
      <button key={label} type="button" onClick={() => go({ from, to })}
        className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
        {label}
      </button>
    );
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => {
          const on = filter.status === s.key;
          return (
            <button key={s.key} type="button" onClick={() => go({ status: s.key })}
              className={`rounded-full border px-3 py-1 text-[13px] ${on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted"}`}>
              {s.label} <span className="num ml-1 opacity-70">{counts[s.key || "all"] ?? 0}</span>
            </button>
          );
        })}
        <span className="mx-1 h-5 w-px bg-border" />
        {preset("7 days", addDays(today, -6), today)}
        {preset("30 days", addDays(today, -29), today)}
        {preset("90 days", addDays(today, -89), today)}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="sm:col-span-2">
          <span className={lbl}>Search</span>
          <Input
            value={q}
            placeholder="Challan no., customer, product, vehicle, remark…"
            onChange={(e) => {
              setQ(e.target.value);
              if (timer.current) clearTimeout(timer.current);
              const v = e.target.value;
              timer.current = setTimeout(() => go({ q: v }), 350);
            }}
          />
        </label>
        {pick("Customer", "customer", options.customers)}
        {pick("Product", "product", options.products)}
        {pick("Reason", "reason", options.reasons)}
        {pick("Team", "team", options.teams)}
        {pick("Checked by", "checked", options.checkers)}
        {pick("Approved by", "approver", options.approvers)}
        <label>
          <span className={lbl}>Date from</span>
          <Input type="date" value={filter.from} max={filter.to || undefined} onChange={(e) => go({ from: e.target.value })} />
        </label>
        <label>
          <span className={lbl}>Date to</span>
          <Input type="date" value={filter.to} min={filter.from || undefined} onChange={(e) => go({ to: e.target.value })} />
        </label>
      </div>

      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>Showing {shown} of {total} credit notes</span>
        {active ? (
          <button type="button" className="font-semibold text-foreground underline" onClick={() => { setQ(""); router.push(path); }}>
            Clear filters
          </button>
        ) : null}
      </div>
    </section>
  );
}
