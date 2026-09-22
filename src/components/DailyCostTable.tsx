"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setOverhead } from "@/app/daily/actions";
import { formatNumber } from "@/lib/format";
import type { DailyCostDay } from "@/lib/daily/data";

const src = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(Number(v));

export function DailyCostTable({
  days, columns,
}: {
  days: DailyCostDay[];
  columns: ReadonlyArray<{ code: string; label: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      setError(res.ok ? null : res.error);
    });

  const totals = columns.reduce<Record<string, number>>((acc, h) => {
    acc[h.code] = days.reduce((s, d) => s + Number(d.heads[h.code]?.amount ?? 0), 0);
    return acc;
  }, {});
  const showTotalColumn = columns.length > 1;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      {error ? <div className="bg-destructive/10 px-4 py-2 text-destructive">{error}</div> : null}
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-secondary text-[10px] font-mono uppercase tracking-wide text-tertiary-foreground">
            <th className="px-4 py-2 text-left font-bold">Date</th>
            <th className="px-3 py-2 text-right font-bold">Milk (L)</th>
            {columns.map((h) => (
              <th key={h.code} className="px-3 py-2 text-right font-bold">{h.label} ₹</th>
            ))}
            {showTotalColumn ? <th className="px-3 py-2 text-right font-bold">Total ₹</th> : null}
            <th className="px-3 py-2 text-right font-bold">Per litre</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const total = columns.reduce((s, h) => s + Number(d.heads[h.code]?.amount ?? 0), 0);
            return (
              <tr key={d.day_id} className="border-b border-border/70 hover:bg-muted">
                <td className="px-4 py-1.5">
                  <Link href={`/daily/${d.day}`} className="font-semibold text-foreground hover:underline">
                    {d.day}
                  </Link>
                </td>
                <td className="num px-3 py-1.5 text-right text-muted-foreground">
                  {formatNumber(d.milk_processed_l, 0)}
                </td>
                {columns.map((h) => {
                  const cell = d.heads[h.code];
                  return (
                    <td key={h.code} className="px-3 py-1.5 text-right">
                      {cell ? (
                        <input
                          defaultValue={src(cell.amount)}
                          onBlur={(e) => {
                            if (e.target.value !== src(cell.amount)) {
                              run(() => setOverhead(d.day_id, cell.head_id, "amount", e.target.value));
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          placeholder="—"
                          className="num w-24 rounded-lg border border-transparent bg-transparent px-2 py-1 text-right font-semibold text-foreground hover:border-border focus:border-primary focus:bg-card focus:outline-none"
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
                {showTotalColumn ? (
                  <td className="num px-3 py-1.5 text-right font-bold">{formatNumber(total, 2)}</td>
                ) : null}
                <td className="num px-3 py-1.5 text-right text-muted-foreground">
                  {d.milk_processed_l ? formatNumber(total / Number(d.milk_processed_l), 4) : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-accent font-bold">
            <td className="px-4 py-2">Total</td>
            <td />
            {columns.map((h) => (
              <td key={h.code} className="num px-3 py-2 text-right">{formatNumber(totals[h.code], 2)}</td>
            ))}
            {showTotalColumn ? (
              <td className="num px-3 py-2 text-right">
                {formatNumber(Object.values(totals).reduce((s, v) => s + v, 0), 2)}
              </td>
            ) : null}
            <td />
          </tr>
        </tfoot>
      </table>
      {days.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
          No days recorded yet. Open today from Production to get started.
        </p>
      ) : null}
    </section>
  );
}
