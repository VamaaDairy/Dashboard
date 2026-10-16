import Link from "next/link";
import type { ReactNode } from "react";
import type { DashFilters } from "@/lib/fp/dash";

export const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
export const num = (n: number) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 1 });
export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");

const FIELD = "h-8 rounded-lg border border-border bg-background px-2 text-[13px] outline-none focus:border-primary";

/** The filter strip common to the dashboards: a GET form, so the URL is the state. */
export function DashFilterBar({ path, f, opts, show = ["region", "team", "state", "designation", "salesType"], day = false, extra }: {
  path: string; f: DashFilters; show?: string[]; day?: boolean; extra?: ReactNode;
  opts: { regions: string[]; teams: string[]; states: string[]; designations: Array<{ id: string; label: string }> };
}) {
  const sel = (name: keyof DashFilters, label: string, values: Array<{ v: string; l: string }>) => show.includes(name) && (
    <select name={name} defaultValue={f[name]} aria-label={label} className={FIELD}>
      <option value="">{label}: all</option>{values.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
  return (
    <form action={path} method="get" className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
      {!day && <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">From<input type="date" name="from" defaultValue={f.from} className={FIELD} /></label>}
      <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">{day ? "Date" : "To"}<input type="date" name="to" defaultValue={f.to} className={FIELD} /></label>
      {extra}
      {sel("region", "Region", opts.regions.map((v) => ({ v, l: v })))}
      {sel("team", "Branch / team", opts.teams.map((v) => ({ v, l: v })))}
      {sel("state", "State", opts.states.map((v) => ({ v, l: v })))}
      {sel("designation", "Designation", opts.designations.map((d) => ({ v: d.id, l: d.label })))}
      {sel("salesType", "Sales type", [{ v: "primary", l: "Primary" }, { v: "secondary", l: "Secondary" }])}
      <button className="h-8 rounded-lg border border-border bg-white px-3 text-[12px] font-medium hover:bg-muted">Apply</button>
      <Link href={path} className="text-[12px] text-muted-foreground hover:text-foreground">Reset</Link>
    </form>
  );
}

export function Tile({ title, value, hint, tone }: { title: string; value: string; hint?: string; tone?: "good" | "bad" | "warn" }) {
  const c = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-700" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${c}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Horizontal bars with a value on the right. */
export function BarList({ rows, format = num, empty = "Nothing in this range." }: { rows: Array<{ label: string; value: number; hint?: string }>; format?: (n: number) => string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2.5 px-4 py-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-[12px]"><span className="text-foreground">{r.label}{r.hint && <span className="ml-1.5 text-muted-foreground">{r.hint}</span>}</span><span className="tabular-nums text-muted-foreground">{format(r.value)}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical bars over time. */
export function TrendBars({ rows }: { rows: Array<{ day: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex h-44 items-end gap-0.5 overflow-x-auto px-4 pt-6 pb-2">
      {rows.map((r) => (
        <div key={r.day} title={`${r.day}: ${inr(r.value)}`} className="group flex min-w-3 flex-1 flex-col items-center justify-end gap-1">
          <div className="w-full rounded-t bg-primary/80 group-hover:bg-primary" style={{ height: `${Math.max(2, (r.value / max) * 110)}px` }} />
          {rows.length <= 16 && <span className="text-[10px] text-muted-foreground">{r.day}</span>}
        </div>
      ))}
    </div>
  );
}

export function Grid({ head, rows, right = [], empty = "Nothing in this range." }: { head: string[]; rows: Array<Array<ReactNode>>; right?: number[]; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border bg-muted/40"><tr>{head.map((h, i) => <th key={h} className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${right.includes(i) ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i} className="border-b border-border/70">{r.map((c, j) => <td key={j} className={`px-4 py-2 ${j === 0 ? "font-medium text-foreground" : "text-muted-foreground"} ${right.includes(j) ? "text-right tabular-nums" : ""}`}>{c}</td>)}</tr>)}
          {rows.length === 0 && <tr><td colSpan={head.length} className="px-4 py-8 text-center text-muted-foreground">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
