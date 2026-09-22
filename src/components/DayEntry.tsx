"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  addOverheadHead, deleteOverheadHead, setMilkProcessed, setOverhead, setProduction,
} from "@/app/daily/actions";
import { formatNumber } from "@/lib/format";
import type { ProductDayCost } from "@/lib/daily/compute";

interface Head {
  id: string;
  code: string;
  label: string;
  unit: string | null;
  qty: number | null;
  rate: number | null;
  amount: number | null;
}

interface Product {
  id: string;
  code: string;
  name: string;
  qty_produced: number;
}

const src = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(Number(v));

export function DayEntry({
  dayId, milkProcessed, heads, products, costing,
}: {
  dayId: string;
  milkProcessed: number | null;
  heads: Head[];
  products: Product[];
  costing: {
    totalOverhead: number;
    conversionRate: number;
    totalProductionCost: number;
    milkAccountedFor: number;
    products: ProductDayCost[];
  };
}) {
  const [error, setError] = useState<string | null>(null);
  const [addingHead, setAddingHead] = useState(false);
  const [, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      setError(res.ok ? null : res.error);
    });

  const costByProduct = new Map(costing.products.map((p) => [p.product_id, p]));
  const madeToday = products.filter((p) => p.qty_produced > 0);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl bg-destructive/10 px-4 py-2 text-destructive">{error}</div> : null}

      {/* ---------------- milk + the day's rate ---------------- */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Milk processed today
          </label>
          <div className="mt-1 flex items-baseline gap-2">
            <input
              defaultValue={src(milkProcessed)}
              onBlur={(e) => {
                if (e.target.value !== src(milkProcessed)) {
                  const v = e.target.value;
                  run(() => setMilkProcessed(dayId, v));
                }
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              placeholder="0"
              className="num w-40 rounded-lg border border-border bg-input/30 px-3 py-2 text-[22px] font-bold text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-sm font-semibold text-muted-foreground">litres</span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Every shared cost below is divided by this.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Total shared cost
          </div>
          <div className="num mt-2 text-[26px] font-black text-foreground">
            ₹{formatNumber(costing.totalOverhead, 2)}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Coal, power, labour, transport…</p>
        </div>

        <div className="rounded-lg border-2 border-primary bg-accent p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            Conversion cost today
          </div>
          <div className="num mt-2 text-[26px] font-black text-primary">
            ₹{formatNumber(costing.conversionRate, 4)}
            <span className="ml-1 text-sm font-bold text-muted-foreground">/ litre</span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Shared cost ÷ milk processed. Every product carries this.
          </p>
        </div>
      </div>

      {/* ---------------- shared costs ---------------- */}
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-bold text-foreground">Today&apos;s shared costs</h2>
          <button
            onClick={() => setAddingHead((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:border-primary hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Cost head
          </button>
        </div>

        {addingHead ? (
          <form
            action={(fd) => start(async () => {
              const res = await addOverheadHead(fd);
              setError(res.ok ? null : res.error);
              if (res.ok) setAddingHead(false);
            })}
            className="flex flex-wrap items-center gap-2 border-b border-blue-200 bg-accent px-4 py-2.5"
          >
            <input type="hidden" name="day_id" value={dayId} />
            <input name="label" required placeholder="e.g. Diesel for generator"
              className="w-64 rounded-lg border border-border bg-card px-3 py-1.5" />
            <input name="unit" placeholder="unit (litres, kg…)"
              className="w-40 rounded-lg border border-border bg-card px-3 py-1.5" />
            <button className="rounded-lg border border-border bg-white px-3 py-1.5 font-medium text-foreground hover:bg-accent">
              Add
            </button>
            <button type="button" onClick={() => setAddingHead(false)} className="text-muted-foreground">
              Cancel
            </button>
          </form>
        ) : null}

        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-secondary text-[10px] font-mono uppercase tracking-wide text-tertiary-foreground">
              <th className="px-4 py-2 text-left font-bold">Cost head</th>
              <th className="px-3 py-2 text-right font-bold">Qty used</th>
              <th className="px-3 py-2 text-right font-bold">Rate</th>
              <th className="px-3 py-2 text-right font-bold">Amount ₹</th>
              <th className="px-3 py-2 text-right font-bold">Per litre</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {heads.map((h) => (
              <tr key={h.id} className="group border-b border-border/70">
                <td className="px-4 py-1.5">
                  {h.label}
                  {h.unit ? <span className="ml-1.5 text-[11px] text-muted-foreground">({h.unit})</span> : null}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <Cell value={h.qty} onCommit={(v) => run(() => setOverhead(dayId, h.id, "qty", v))} />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <Cell value={h.rate} onCommit={(v) => run(() => setOverhead(dayId, h.id, "rate", v))} />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <Cell value={h.amount} bold
                    onCommit={(v) => run(() => setOverhead(dayId, h.id, "amount", v))} />
                </td>
                <td className="num px-3 py-1.5 text-right text-muted-foreground">
                  {milkProcessed && h.amount
                    ? formatNumber(Number(h.amount) / Number(milkProcessed), 4)
                    : ""}
                </td>
                <td className="px-2 py-1.5">
                  <button
                    onClick={() => run(() => deleteOverheadHead(h.id, dayId))}
                    className="invisible text-muted-foreground group-hover:visible hover:text-destructive"
                    title="Remove this cost head"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-accent font-bold">
              <td className="px-4 py-2">Total</td>
              <td />
              <td />
              <td className="num px-3 py-2 text-right">₹{formatNumber(costing.totalOverhead, 2)}</td>
              <td className="num px-3 py-2 text-right text-primary">
                {formatNumber(costing.conversionRate, 4)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </section>

      {/* ---------------- production ---------------- */}
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-bold text-foreground">What was produced today</h2>
          <p className="text-[11px] text-muted-foreground">
            Enter quantities against the products you made. Cost per unit is worked out from the
            milk in each one, today&apos;s conversion rate, and its own materials and packing.
          </p>
        </div>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="sticky top-0 border-b border-border bg-secondary text-[10px] font-mono uppercase tracking-wide text-tertiary-foreground">
                <th className="px-4 py-2 text-left font-bold">Product</th>
                <th className="px-3 py-2 text-right font-bold">Qty made</th>
                <th className="px-3 py-2 text-right font-bold">Milk / unit</th>
                <th className="px-3 py-2 text-right font-bold">Material</th>
                <th className="px-3 py-2 text-right font-bold">Conversion</th>
                <th className="px-3 py-2 text-right font-bold">Packing</th>
                <th className="px-3 py-2 text-right font-bold">Cost / unit</th>
                <th className="px-3 py-2 text-right font-bold">Cost / kg or L</th>
                <th className="px-3 py-2 text-right font-bold">Total ₹</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const c = costByProduct.get(p.id);
                return (
                  <tr key={p.id} className={`border-b border-border/70 ${c ? "" : "text-muted-foreground"}`}>
                    <td className="px-4 py-1.5">{p.name}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Cell value={p.qty_produced || null} bold
                        onCommit={(v) => run(() => setProduction(dayId, p.id, v))} />
                    </td>
                    <td className="num px-3 py-1.5 text-right">
                      {c ? formatNumber(c.milk_qty_per_unit, 4) : ""}
                    </td>
                    <td className="num px-3 py-1.5 text-right">
                      {c ? formatNumber(c.material_cost, 2) : ""}
                    </td>
                    <td className="num px-3 py-1.5 text-right text-primary">
                      {c ? formatNumber(c.conversion_cost, 2) : ""}
                    </td>
                    <td className="num px-3 py-1.5 text-right">
                      {c ? formatNumber(c.packing_cost, 2) : ""}
                    </td>
                    <td className="num px-3 py-1.5 text-right font-bold">
                      {c ? formatNumber(c.unit_cost, 2) : ""}
                    </td>
                    <td className="num px-3 py-1.5 text-right font-bold text-foreground">
                      {c ? formatNumber(c.cost_per_kg, 2) : ""}
                    </td>
                    <td className="num px-3 py-1.5 text-right font-bold">
                      {c ? formatNumber(c.total_cost, 2) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-accent font-bold">
                <td className="px-4 py-2">
                  {madeToday.length} product{madeToday.length === 1 ? "" : "s"} made
                </td>
                <td />
                <td className="num px-3 py-2 text-right">
                  {formatNumber(costing.milkAccountedFor, 1)} L
                </td>
                <td colSpan={5} className="px-3 py-2 text-right text-[11px] font-normal text-muted-foreground">
                  milk accounted for by production
                </td>
                <td className="num px-3 py-2 text-right">
                  ₹{formatNumber(costing.totalProductionCost, 2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function Cell({
  value, onCommit, bold,
}: {
  value: number | null;
  onCommit: (v: string) => void;
  bold?: boolean;
}) {
  const initial = src(value);
  return (
    <input
      defaultValue={initial}
      onBlur={(e) => { if (e.target.value !== initial) onCommit(e.target.value); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      placeholder="—"
      className={`num w-24 rounded-lg border border-transparent bg-transparent px-2 py-1 text-right hover:border-border focus:border-primary focus:bg-card focus:outline-none ${
        bold ? "font-bold text-foreground" : "text-muted-foreground"
      }`}
    />
  );
}
