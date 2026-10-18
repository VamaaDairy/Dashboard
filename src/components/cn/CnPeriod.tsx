"use client";

import { usePathname, useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Input } from "@/components/ui/input";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** The period every panel on the CN dashboard follows: a preset, or a from-to range. */
export function CnPeriod({ from, to, today }: { from: string; to: string; today: string }) {
  const router = useRouter();
  const path = usePathname();
  const go = (f: string, t: string) => router.push(`${path}?from=${f}&to=${t}`);
  const presets = [
    { label: "7D", from: addDays(today, -6) },
    { label: "30D", from: addDays(today, -29) },
    { label: "90D", from: addDays(today, -89) },
  ];
  const ctl = "h-8 w-36 border-border-control-hover bg-card px-2 text-[13px]";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
        {presets.map((p) => {
          const on = from === p.from && to === today;
          return (
            <button key={p.label} type="button" onClick={() => go(p.from, today)}
              className={cn("h-7 rounded-md px-3 text-[12px] font-medium transition-colors",
                on ? "bg-card text-foreground shadow-xs ring-1 ring-border" : "text-tertiary-foreground hover:text-foreground")}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[12px] text-tertiary-foreground">
        <CalendarRange className="size-4" strokeWidth={1.5} />
        <Input type="date" aria-label="From" value={from} max={to} className={ctl} onChange={(e) => e.target.value && go(e.target.value, to)} />
        <span>to</span>
        <Input type="date" aria-label="To" value={to} min={from} className={ctl} onChange={(e) => e.target.value && go(from, e.target.value)} />
      </div>
    </div>
  );
}
