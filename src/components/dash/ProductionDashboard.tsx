"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { CAT3, ColumnChart, GAIA, MatrixHeatmap, StackedBars, TrendChart, shortDate } from "@/components/farmers/charts";
import { Panel, PeriodBar, dayList } from "@/components/dash/Dash";
import { THead, Th } from "@/components/tanks/ui";
import { formatNumber } from "@/lib/format";
import type { Costing, SharedHead } from "@/lib/costing/actual";

const rs = (v: number, d = 0) => `₹${formatNumber(v, d)}`;
const td = "num px-3 py-1.5 text-right";
const tdShared = "num px-3 py-1.5 text-right bg-[#eb6834]/[0.06]";
const CASE_NAMES: Record<string, { one: string; many: string }> = {
  CRT: { one: "crate", many: "Crates" }, CBX: { one: "box", many: "Boxes" }, PCS: { one: "piece", many: "Pieces (buckets, tins, paneer)" }, KG: { one: "kg", many: "Kg (khowa)" },
};
/** Short column names for the shared-cost heads. */
const SHORT: Record<string, string> = {
  electricity: "Electricity", labour: "Labour", fuel_production: "Coal / plant fuel", fuel_procurement: "Milk transport",
  coal: "Coal (old head)", plant_staff: "Staff salary", chemicals_daily: "Chemicals", other_overhead: "Other",
};
const short = (h: SharedHead) => SHORT[h.code] ?? h.label;
const addTo = (acc: Record<string, number>, add: Record<string, number>, k = 1) => {
  for (const [c, v] of Object.entries(add)) acc[c] = (acc[c] ?? 0) + v * k;
  return acc;
};

/** Column header for a shared-cost column - tinted so the shared block reads as one group. */
function ThS({ children }: { children: React.ReactNode }) {
  return <th className="bg-[#eb6834]/[0.08] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-tertiary-foreground">{children}</th>;
}

export function ProductionDashboard({ from, to, today, costing, tankIn }: {
  from: string; to: string; today: string; costing: Costing; tankIn: number;
}) {
  const { days, batches, skus, heads } = costing;
  const dates = dayList(from, to);
  const milk = days.reduce((t, d) => t + d.milk_litre, 0);
  const outKg = batches.filter((b) => b.unit === "kg").reduce((t, b) => t + (b.output ?? 0), 0);
  const outL = batches.filter((b) => b.unit === "L").reduce((t, b) => t + (b.output ?? 0), 0);
  const pcs = skus.reduce((t, s) => t + s.pcs, 0);
  const packedKg = skus.filter((s) => s.bulk_unit === "kg").reduce((t, s) => t + s.bulk_qty, 0);
  const packedL = skus.filter((s) => s.bulk_unit === "L").reduce((t, s) => t + s.bulk_qty, 0);
  const totalSku = skus.reduce((t, s) => t + s.total, 0);
  const byDay = new Map(days.map((d) => [d.day, d]));

  // finished output by case type
  const byCase = new Map<string, { cases: number; pcs: number }>();
  for (const s of skus) {
    const c = byCase.get(s.case_unit) ?? { cases: 0, pcs: 0 };
    c.cases += s.cases + (s.pcs_per_case === 1 ? s.loose_pcs : 0);
    c.pcs += s.pcs;
    byCase.set(s.case_unit, c);
  }

  // products over the period, shared costs head by head
  const products = new Map<string, { name: string; unit: string; batches: number; milk: number; output: number; milkCost: number; ing: number; oh: number; byHead: Record<string, number>; total: number; cells: Record<string, number> }>();
  for (const b of batches) {
    const p = products.get(b.product_id) ?? { name: b.product, unit: b.unit, batches: 0, milk: 0, output: 0, milkCost: 0, ing: 0, oh: 0, byHead: {}, total: 0, cells: {} };
    p.batches += 1; p.milk += b.milk_litre; p.output += b.output ?? 0; p.milkCost += b.milk_cost;
    p.ing += b.ingredient_cost + b.labour_cost; p.oh += b.overhead_cost; p.total += b.total;
    addTo(p.byHead, b.shared_by_head);
    p.cells[b.day] = b.milk_litre;
    products.set(b.product_id, p);
  }
  const productRows = [...products.entries()].sort((a, b) => b[1].milk - a[1].milk);

  // finished goods by category
  const cats = new Map<string, { skus: Set<string>; cases: Record<string, number>; pcs: number; qty: number; unit: string; total: number }>();
  for (const s of skus) {
    const c = cats.get(s.category) ?? { skus: new Set<string>(), cases: {}, pcs: 0, qty: 0, unit: s.bulk_unit ?? "", total: 0 };
    c.skus.add(s.sku_id);
    c.cases[s.case_unit] = (c.cases[s.case_unit] ?? 0) + s.cases + (s.pcs_per_case === 1 ? s.loose_pcs : 0);
    c.pcs += s.pcs; c.qty += s.bulk_qty; c.total += s.total;
    cats.set(s.category, c);
  }

  // what each shared head adds to the period's production cost
  const headAmount: Record<string, number> = {};
  for (const d of days) for (const h of d.heads) if (h.code !== "fuel_delivery") headAmount[h.code] = (headAmount[h.code] ?? 0) + h.amount;
  const delivery = days.reduce((t, d) => t + d.delivery, 0);
  const batchTotal = batches.reduce((t, b) => t + b.total, 0);
  const material = skus.reduce((t, s) => t + s.material_cost, 0);
  const productionCost = batchTotal + material + delivery;
  const milkCostAll = batches.reduce((t, b) => t + b.milk_cost, 0);
  const ingAll = batches.reduce((t, b) => t + b.ingredient_cost + b.labour_cost, 0);
  const sharedAll = Object.values(headAmount).reduce((t, v) => t + v, 0);
  const pcsByDay = new Map<string, number>();
  for (const s of skus) pcsByDay.set(s.day, (pcsByDay.get(s.day) ?? 0) + s.pcs);

  return (
    <div className="space-y-5">
      <PeriodBar from={from} to={to} today={today} />

      {/* ---- the chain, start to finish */}
      <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
        <h3 className="text-[13px] font-semibold text-foreground">From milk to packed goods</h3>
        <p className="mt-0.5 text-[12px] text-muted-foreground">The whole period, step by step. Each arrow shows how much of the step before made it through.</p>
        <div className="mt-4 grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          <Step label="Milk into tanks" value={formatNumber(tankIn, 0)} unit="L" note="farmers + tankers" />
          <Arrow note={tankIn ? `${formatNumber((milk / tankIn) * 100, 0)}% used` : ""} />
          <Step label="Milk into bulk batches" value={formatNumber(milk, 0)} unit="L" note={`${batches.length} batches · ${days.filter((d) => d.milk_litre > 0).length} days`} />
          <Arrow note="made into" />
          <Step label="Bulk output (yield)" value={formatNumber(outKg, 0)} unit="kg" note={`+ ${formatNumber(outL, 0)} L of milk, lassi, chaach`} />
          <Arrow note={outKg + outL ? `${formatNumber(((packedKg + packedL) / (outKg + outL)) * 100, 1)}% packed` : ""} />
          <Step label="Packed into SKUs" value={formatNumber(pcs, 0)} unit="pcs" strong
            note={[...byCase.entries()].map(([u, c]) => `${formatNumber(c.cases, 0)} ${CASE_NAMES[u]?.many.split(" ")[0].toLowerCase() ?? u}`).join(" · ")} />
        </div>
      </section>

      {/* ---- what was actually produced */}
      <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
        <Panel title="Finished goods produced" description="What came off the packing line, counted the way it is dispatched.">
          <div className="grid grid-cols-2 gap-3">
            {["CRT", "CBX", "PCS", "KG"].filter((u) => byCase.has(u)).map((u) => (
              <div key={u} className="rounded-lg bg-muted/60 px-4 py-3">
                <div className="text-[11px] font-medium text-muted-foreground">{CASE_NAMES[u].many}</div>
                <div className="num mt-1 text-[22px] font-bold text-foreground">{formatNumber(byCase.get(u)!.cases, 0)}</div>
                <div className="num text-[11px] text-muted-foreground">{formatNumber(byCase.get(u)!.pcs, 0)} pieces inside</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3 text-[12px]">
            <span className="text-muted-foreground">Average cost per piece, delivered</span>
            <span className="num text-[15px] font-bold text-foreground">{pcs ? rs(totalSku / pcs, 2) : "—"}</span>
          </div>
        </Panel>
        <Panel title="Pieces packed, day by day" description="Every SKU together.">
          <ColumnChart color={GAIA.blue} unit="pieces" height={210}
            data={dates.map((d) => ({
              key: d, label: shortDate(d).replace(/ \d+$/, ""), value: pcsByDay.get(d) ?? 0,
              tip: [{ label: "pieces", value: formatNumber(pcsByDay.get(d) ?? 0, 0) }, { label: "L milk", value: formatNumber(byDay.get(d)?.milk_litre ?? 0, 0) }],
            }))} />
        </Panel>
      </div>

      {/* ---- each shared cost and what it adds to production cost */}
      <Panel title="What each shared cost adds to production cost"
        description="Over the period: each head's total, what it came to per litre of milk and per piece packed, and its share of the whole production cost (milk + ingredients + shared costs + packing + delivery).">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead><Th align="left">Cost</Th><Th>Amount ₹</Th><Th>₹ / L milk</Th><Th>₹ / piece</Th><Th>Share of production cost</Th><Th align="left">Added to</Th></THead>
            <tbody>
              {[
                { key: "milk", label: "Milk from tanks", amount: milkCostAll, shared: false, to: "batches, by what each drew" },
                { key: "ing", label: "Ingredients", amount: ingAll, shared: false, to: "batches, by what each used" },
                ...heads.map((h) => ({ key: h.code, label: short(h), amount: headAmount[h.code] ?? 0, shared: true, to: "batches, by litres of milk" })),
                { key: "pack", label: "Packing material", amount: material, shared: false, to: "the SKU it was used for" },
                { key: "del", label: "Delivery fuel", amount: delivery, shared: true, to: "SKUs, by kg / L packed" },
              ].map((r) => (
                <tr key={r.key} className={`border-b border-border/70 ${r.shared ? "bg-[#eb6834]/[0.05]" : ""}`}>
                  <td className="px-3 py-1.5 font-semibold text-foreground">{r.label}{r.shared ? <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">shared</span> : null}</td>
                  <td className={td}>{formatNumber(r.amount, 0)}</td>
                  <td className={td}>{milk ? formatNumber(r.amount / milk, 2) : "—"}</td>
                  <td className={td}>{pcs ? formatNumber(r.amount / pcs, 2) : "—"}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-28 rounded-full bg-muted">
                        <div className="h-1.5 rounded-full" style={{ width: `${productionCost ? (r.amount / productionCost) * 100 : 0}%`, background: r.shared ? GAIA.orange : GAIA.blue }} />
                      </div>
                      <span className="num w-12 text-right font-semibold text-foreground">{productionCost ? formatNumber((r.amount / productionCost) * 100, 1) : 0}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-muted-foreground">{r.to}</td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-semibold">
                <td className="px-3 py-2">Production cost</td>
                <td className={td}>{formatNumber(productionCost, 0)}</td>
                <td className={td}>{milk ? formatNumber(productionCost / milk, 2) : "—"}</td>
                <td className={td}>{pcs ? formatNumber(productionCost / pcs, 2) : "—"}</td>
                <td className="px-3 py-2 text-right text-[12px] text-muted-foreground">
                  shared costs: <span className="num font-semibold text-foreground">{productionCost ? formatNumber(((sharedAll + delivery) / productionCost) * 100, 1) : 0}%</span>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---- where shared costs go, one day */}
      <SharedWalkthrough costing={costing} />

      {/* ---- every SKU: per piece and per kg */}
      <SkuCostTable costing={costing} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="What a kg / litre of each product costs" description="Per unit of yield, split into its three parts.">
          <StackedBars format={(v) => rs(v, 2)}
            series={[{ label: "Ingredients", color: CAT3[0] }, { label: "Milk", color: CAT3[1] }, { label: "Shared costs", color: CAT3[2] }]}
            rows={productRows.filter(([, p]) => p.output > 0).map(([id, p]) => ({
              key: id, label: p.name,
              parts: [p.ing / p.output, p.milkCost / p.output, p.oh / p.output],
              total: `${rs(p.total / p.output, 2)} / ${p.unit}`,
            }))} />
        </Panel>
        <Panel title="Shared cost per litre of milk" description="Each day's shared costs ÷ the litres of milk that went into batches that day.">
          <TrendChart color={GAIA.orange} unit="₹ / L" decimals={2} emptyLabel="no batches" height={260}
            points={dates.map((d) => ({ day: d, value: byDay.get(d)?.rate_per_litre ?? null }))}
            extraTip={(d) => heads.map((h) => ({ label: short(h), value: formatNumber(byDay.get(d)?.rates[h.code] ?? 0, 2) }))} />
        </Panel>
      </div>

      <Panel title="Cost by product" description="Each product's batches over the period, with every shared cost in its own column.">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <thead>
              <tr className="border-b border-border bg-secondary text-[10px] font-bold uppercase tracking-wide text-tertiary-foreground">
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-right">Milk L</th>
                <th className="px-3 py-2 text-right">Yield</th>
                <th className="px-3 py-2 text-right">Milk ₹</th>
                <th className="px-3 py-2 text-right">Ingredients ₹</th>
                {heads.map((h) => <ThS key={h.code}>{short(h)} ₹</ThS>)}
                <ThS>Shared ₹</ThS>
                <ThS>Shared %</ThS>
                <th className="px-3 py-2 text-right">Total ₹</th>
                <th className="px-3 py-2 text-right">₹ / unit</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map(([id, p]) => (
                <tr key={id} className="border-b border-border/70 hover:bg-muted/60">
                  <td className="px-3 py-1.5 font-semibold text-foreground">{p.name}</td>
                  <td className={td}>{formatNumber(p.milk, 0)}</td>
                  <td className={td}>{formatNumber(p.output, 1)} {p.unit}</td>
                  <td className={td}>{formatNumber(p.milkCost, 0)}</td>
                  <td className={td}>{formatNumber(p.ing, 0)}</td>
                  {heads.map((h) => <td key={h.code} className={tdShared}>{formatNumber(p.byHead[h.code] ?? 0, 0)}</td>)}
                  <td className={`${tdShared} font-semibold text-foreground`}>{formatNumber(p.oh, 0)}</td>
                  <td className={tdShared}>{p.total ? formatNumber((p.oh / p.total) * 100, 1) : 0}%</td>
                  <td className={`${td} font-semibold text-foreground`}>{formatNumber(p.total, 0)}</td>
                  <td className={`${td} font-semibold text-foreground`}>{p.output ? `${formatNumber(p.total / p.output, 2)} / ${p.unit}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Panel title="Output by category" description="Cases and pieces packed, and what they cost per piece.">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-[13px]">
              <THead><Th align="left">Category</Th><Th align="left">Cases</Th><Th>Pieces</Th><Th>Product</Th><Th>₹ / piece</Th></THead>
              <tbody>
                {[...cats.entries()].sort((a, b) => b[1].pcs - a[1].pcs).map(([name, c]) => (
                  <tr key={name} className="border-b border-border/70 hover:bg-muted/60">
                    <td className="px-3 py-1.5 font-semibold text-foreground">{name}</td>
                    <td className="px-3 py-1.5 text-[12px] text-muted-foreground">
                      {Object.entries(c.cases).map(([u, k]) => `${formatNumber(k, 0)} ${u === "KG" ? "kg" : (CASE_NAMES[u]?.one ?? u) + (k === 1 ? "" : u === "CBX" ? "es" : "s")}`).join(" · ")}
                    </td>
                    <td className={`${td} font-semibold text-foreground`}>{formatNumber(c.pcs, 0)}</td>
                    <td className={td}>{formatNumber(c.qty, 0)} {c.unit}</td>
                    <td className={`${td} font-semibold text-foreground`}>{c.pcs ? formatNumber(c.total / c.pcs, 2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Milk by product, day by day" description="Litres each product took from the tanks.">
          <MatrixHeatmap rows={productRows.map(([id, p]) => ({ key: id, label: p.name, cells: p.cells }))} days={dates} unit="L" emptyLabel="not made" />
        </Panel>
      </div>
    </div>
  );
}

function Step({ label, value, unit, note, strong }: { label: string; value: string; unit: string; note?: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg px-4 py-3 ${strong ? "bg-foreground text-background" : "bg-muted/60"}`}>
      <div className={`text-[11px] font-medium ${strong ? "text-background/70" : "text-muted-foreground"}`}>{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="num text-[22px] font-bold">{value}</span>
        <span className={`text-[12px] ${strong ? "text-background/70" : "text-muted-foreground"}`}>{unit}</span>
      </div>
      {note ? <div className={`mt-0.5 text-[11px] ${strong ? "text-background/70" : "text-muted-foreground"}`}>{note}</div> : null}
    </div>
  );
}

function Arrow({ note }: { note: string }) {
  return (
    <div className="flex items-center justify-center gap-1 text-muted-foreground md:flex-col">
      <ArrowRight className="h-4 w-4 rotate-90 md:rotate-0" />
      <span className="text-[10px] font-semibold">{note}</span>
    </div>
  );
}

/**
 * Every SKU's cost, per piece or per kg / litre of product: milk & ingredients,
 * each shared head in its own column, delivery, packing - and the two totals.
 */
function SkuCostTable({ costing }: { costing: Costing }) {
  const [basis, setBasis] = useState<"pc" | "unit">("pc");
  const { skus, heads } = costing;
  const agg = new Map<string, { code: string; name: string; unit: string; caseUnit: string; perCase: number; cases: number; pcs: number; qty: number; base: number; byHead: Record<string, number>; mat: number; del: number; total: number }>();
  for (const s of skus) {
    const a = agg.get(s.sku_id) ?? { code: s.code, name: s.name, unit: s.bulk_unit ?? "", caseUnit: s.case_unit, perCase: s.pcs_per_case, cases: 0, pcs: 0, qty: 0, base: 0, byHead: {}, mat: 0, del: 0, total: 0 };
    a.cases += s.cases; a.pcs += s.pcs; a.qty += s.bulk_qty; a.base += s.bulk_cost - s.shared_cost;
    addTo(a.byHead, s.shared_by_head);
    a.mat += s.material_cost; a.del += s.delivery_cost; a.total += s.total;
    agg.set(s.sku_id, a);
  }
  const rows = [...agg.entries()].sort((a, b) => b[1].pcs - a[1].pcs);
  const per = (v: number, a: { pcs: number; qty: number }) => {
    const d = basis === "pc" ? a.pcs : a.qty;
    return d > 0 ? formatNumber(v / d, 2) : "—";
  };

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">Cost of every SKU - per piece and per kg / litre</h3>
          <p className="mt-0.5 max-w-3xl text-[12px] text-muted-foreground">
            What one piece (or one kg / litre of product in it) cost over the period, built up column by column. The tinted columns are the shared costs it carries.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-border text-[12px] font-semibold">
          {([["pc", "Per piece"], ["unit", "Per kg / L"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setBasis(k)} className={`px-3 py-1.5 ${basis === k ? "bg-foreground text-background" : "bg-white text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-[13px]">
          <thead>
            <tr className="border-b border-border bg-secondary text-[10px] font-bold uppercase tracking-wide text-tertiary-foreground">
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-right">Pieces</th>
              <th className="px-3 py-2 text-right">Product</th>
              <th className="px-3 py-2 text-right">Milk & ingredients</th>
              {heads.map((h) => <ThS key={h.code}>{short(h)}</ThS>)}
              <ThS>Delivery</ThS>
              <th className="px-3 py-2 text-right">Packing</th>
              <th className="px-3 py-2 text-right">₹ / piece</th>
              <th className="px-3 py-2 text-right">₹ / kg or L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, a]) => (
              <tr key={id} className="border-b border-border/70 hover:bg-muted/60">
                <td className="num px-3 py-1.5 text-[12px]">{a.code}</td>
                <td className="max-w-64 truncate px-3 py-1.5 font-semibold text-foreground" title={a.name}>{a.name}</td>
                <td className={td}>{formatNumber(a.pcs, 0)}</td>
                <td className={`${td} text-muted-foreground`}>{formatNumber(a.qty, 0)} {a.unit}</td>
                <td className={td}>{per(a.base, a)}</td>
                {heads.map((h) => <td key={h.code} className={tdShared}>{per(a.byHead[h.code] ?? 0, a)}</td>)}
                <td className={tdShared}>{per(a.del, a)}</td>
                <td className={td}>{per(a.mat, a)}</td>
                <td className={`${td} font-bold text-foreground`}>{a.pcs ? formatNumber(a.total / a.pcs, 2) : "—"}</td>
                <td className={`${td} font-bold text-foreground`}>{a.qty ? `${formatNumber(a.total / a.qty, 2)} / ${a.unit}` : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={8 + heads.length} className="px-3 py-6 text-center text-[12px] text-muted-foreground">Nothing packed in this period.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Component columns are {basis === "pc" ? "per piece" : "per kg / litre of product"}; they add up to the {basis === "pc" ? "₹ / piece" : "₹ / kg or L"} column.
      </p>
    </section>
  );
}

/**
 * Shows, for one day, exactly where shared costs go: each head, its rate per
 * litre, each batch's share head by head, what that adds to a kg / litre, and
 * what lands in one SKU piece. Delivery fuel's route to the SKUs is shown too.
 */
function SharedWalkthrough({ costing }: { costing: Costing }) {
  const withBatches = costing.days.filter((d) => d.milk_litre > 0);
  const [day, setDay] = useState(withBatches[withBatches.length - 1]?.day ?? "");
  const d = costing.days.find((x) => x.day === day);
  if (!d) return null;
  const heads = costing.heads.filter((h) => d.rates[h.code] !== undefined);
  const batches = costing.batches.filter((b) => b.day === day).sort((a, b) => b.milk_litre - a.milk_litre);
  const skus = costing.skus.filter((s) => s.day === day);
  const packed = skus.reduce((t, s) => t + s.bulk_qty, 0);
  const example = [...skus].sort((a, b) => b.pcs - a.pcs)[0];

  return (
    <section className="rounded-lg border-2 border-foreground/15 bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">Where the shared costs are added - one day, head by head</h3>
          <p className="mt-0.5 max-w-3xl text-[12px] text-muted-foreground">
            Each shared cost is divided over the litres of milk that went into bulk batches that day. Every batch carries its litres&apos; share of each one;
            that share travels into each kg / litre of yield and into every SKU piece. Delivery fuel is spread over the SKUs packed instead.
          </p>
        </div>
        <label className="text-[12px] text-muted-foreground">
          Day{" "}
          <select value={day} onChange={(e) => setDay(e.target.value)} className="ml-1 h-8 rounded-lg border border-border bg-white px-2 text-[13px] font-semibold text-foreground">
            {[...withBatches].reverse().map((x) => <option key={x.day} value={x.day}>{shortDate(x.day)}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_auto_1fr]">
        <div className="rounded-lg bg-muted/60 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">1 · Each shared cost ÷ {formatNumber(d.milk_litre, 0)} L of milk processed</div>
          <table className="mt-2 w-full text-[12px]">
            <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground"><th className="text-left font-semibold">Head</th><th className="text-right font-semibold">₹ that day</th><th className="text-right font-semibold">₹ per litre</th></tr></thead>
            <tbody>
              {heads.map((h) => (
                <tr key={h.code}>
                  <td className="py-0.5 text-muted-foreground">{short(h)}</td>
                  <td className="num py-0.5 text-right text-foreground">{rs(d.heads.filter((x) => x.code === h.code).reduce((t, x) => t + x.amount, 0))}</td>
                  <td className="num py-0.5 text-right font-semibold" style={{ color: GAIA.orange }}>{formatNumber(d.rates[h.code], 3)}</td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="pt-1 font-semibold text-foreground">All shared</td>
                <td className="num pt-1 text-right font-semibold text-foreground">{rs(d.shared)}</td>
                <td className="num pt-1 text-right font-bold" style={{ color: GAIA.orange }}>{d.rate_per_litre === null ? "—" : formatNumber(d.rate_per_litre, 2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ChevronRight className="hidden h-5 w-5 self-center text-muted-foreground lg:block" />
        <div className="rounded-lg bg-muted/60 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">2 · What lands in one piece {example ? `- ${example.name}` : ""}</div>
          {example ? (
            <ul className="mt-2 space-y-0.5 text-[12px]">
              <li className="flex justify-between gap-3"><span className="text-muted-foreground">Milk & ingredients</span><span className="num font-semibold text-foreground">{rs((example.bulk_cost - example.shared_cost) / example.pcs, 2)}</span></li>
              {heads.map((h) => (
                <li key={h.code} className="flex justify-between gap-3"><span className="text-muted-foreground">{short(h)}</span><span className="num font-semibold" style={{ color: GAIA.orange }}>{rs((example.shared_by_head[h.code] ?? 0) / example.pcs, 3)}</span></li>
              ))}
              <li className="flex justify-between gap-3"><span className="text-muted-foreground">Delivery fuel</span><span className="num font-semibold" style={{ color: GAIA.orange }}>{rs(example.delivery_cost / example.pcs, 3)}</span></li>
              <li className="flex justify-between gap-3"><span className="text-muted-foreground">Packing material</span><span className="num font-semibold text-foreground">{rs(example.material_cost / example.pcs, 2)}</span></li>
              <li className="flex justify-between gap-3 border-t border-border pt-1"><span className="font-semibold text-foreground">One piece</span><span className="num font-bold text-foreground">{rs(example.total / example.pcs, 2)}</span></li>
              <li className="flex justify-between gap-3"><span className="text-muted-foreground">Per {example.bulk_unit ?? "unit"} of product</span><span className="num font-semibold text-foreground">{example.per_unit === null ? "—" : rs(example.per_unit, 2)}</span></li>
            </ul>
          ) : <p className="mt-2 text-[12px] text-muted-foreground">Nothing packed this day.</p>}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-[13px]">
          <thead>
            <tr className="border-b border-border bg-secondary text-[10px] font-bold uppercase tracking-wide text-tertiary-foreground">
              <th className="px-3 py-2 text-left">Batch</th>
              <th className="px-3 py-2 text-right">Milk L</th>
              <th className="px-3 py-2 text-right">Milk ₹</th>
              <th className="px-3 py-2 text-right">Ingredients ₹</th>
              {heads.map((h) => <ThS key={h.code}>{short(h)} ₹</ThS>)}
              <ThS>Shared ₹</ThS>
              <th className="px-3 py-2 text-right">Batch ₹</th>
              <th className="px-3 py-2 text-right">Yield</th>
              <ThS>Shared / unit</ThS>
              <th className="px-3 py-2 text-right">Cost / unit</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.product_id} className="border-b border-border/70 hover:bg-muted/60">
                <td className="px-3 py-1.5 font-semibold text-foreground">{b.product}</td>
                <td className={td}>{formatNumber(b.milk_litre, 0)}</td>
                <td className={td}>{formatNumber(b.milk_cost, 0)}</td>
                <td className={td}>{formatNumber(b.ingredient_cost, 0)}</td>
                {heads.map((h) => <td key={h.code} className={tdShared}>{formatNumber(b.shared_by_head[h.code] ?? 0, 0)}</td>)}
                <td className={`${tdShared} font-semibold text-foreground`}>{formatNumber(b.overhead_cost, 0)}</td>
                <td className={`${td} font-semibold text-foreground`}>{formatNumber(b.total, 0)}</td>
                <td className={td}>{b.output === null ? "—" : `${formatNumber(b.output, 1)} ${b.unit}`}</td>
                <td className={tdShared}>{b.output ? formatNumber(b.overhead_cost / b.output, 2) : "—"}</td>
                <td className={`${td} font-semibold text-foreground`}>{b.unit_cost === null ? "—" : `${formatNumber(b.unit_cost, 2)} / ${b.unit}`}</td>
              </tr>
            ))}
            <tr className="bg-muted/50 font-semibold">
              <td className="px-3 py-2">All batches</td>
              <td className={td}>{formatNumber(d.milk_litre, 0)}</td>
              <td className={td}>{formatNumber(batches.reduce((t, b) => t + b.milk_cost, 0), 0)}</td>
              <td className={td}>{formatNumber(batches.reduce((t, b) => t + b.ingredient_cost, 0), 0)}</td>
              {heads.map((h) => <td key={h.code} className={tdShared}>{formatNumber(batches.reduce((t, b) => t + (b.shared_by_head[h.code] ?? 0), 0), 0)}</td>)}
              <td className={tdShared}>{formatNumber(batches.reduce((t, b) => t + b.overhead_cost, 0), 0)}</td>
              <td className={td}>{formatNumber(batches.reduce((t, b) => t + b.total, 0), 0)}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">
        Delivery fuel {rs(d.delivery)} ÷ {formatNumber(packed, 0)} kg / L packed = <span className="num font-semibold" style={{ color: GAIA.orange }}>{packed ? rs(d.delivery / packed, 2) : "—"}</span> per kg / L,
        added to each SKU by the product in it. <Link href={`/daily?date=${day}`} className="font-semibold text-foreground underline">Open this day&apos;s batches</Link>
      </p>
    </section>
  );
}
