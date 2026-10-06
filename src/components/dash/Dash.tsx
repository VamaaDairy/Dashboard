"use client";

import { usePathname, useRouter } from "next/navigation";

/** Adds days to an ISO date. */
export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Every date from `from` to `to`, inclusive. */
export function dayList(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The period every chart on a dashboard follows: presets, or a from-to range. */
export function PeriodBar({ from, to, today }: { from: string; to: string; today: string }) {
  const router = useRouter();
  const path = usePathname();
  const go = (f: string, t: string) => router.push(`${path}?from=${f}&to=${t}`);
  const presets = [
    { label: "7 days", from: addDays(today, -6) },
    { label: "30 days", from: addDays(today, -29) },
    { label: "90 days", from: addDays(today, -89) },
  ];
  const input = "rounded-lg border border-border bg-white px-2 py-1 text-[13px] font-semibold text-foreground";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => {
        const on = from === p.from && to === today;
        return (
          <button key={p.label} onClick={() => go(p.from, today)}
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {p.label}
          </button>
        );
      })}
      <span className="mx-1 text-[12px] text-muted-foreground">or</span>
      <input type="date" value={from} max={to} onChange={(e) => e.target.value && go(e.target.value, to)} className={input} aria-label="From" />
      <span className="text-[12px] text-muted-foreground">to</span>
      <input type="date" value={to} min={from} onChange={(e) => e.target.value && go(from, e.target.value)} className={input} aria-label="To" />
    </div>
  );
}

export function Tiles({ items }: { items: { label: string; value: string; unit?: string; note?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((s) => (
        <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground">{s.label}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="num text-[20px] font-bold text-foreground">{s.value}</span>
            {s.unit ? <span className="text-[12px] text-muted-foreground">{s.unit}</span> : null}
          </div>
          {s.note ? <div className="mt-0.5 text-[11px] text-muted-foreground">{s.note}</div> : null}
        </div>
      ))}
    </div>
  );
}

/** A dashboard panel: title, a one-line description of what it shows, the chart. */
export function Panel({ title, description, children, className = "" }: {
  title: string; description?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs ${className}`}>
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
