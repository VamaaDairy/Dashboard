"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { GAIA, MatrixHeatmap, StackedBars, TrendChart, shortDate } from "@/components/farmers/charts";
import { COST, headColor, headLabel, tint } from "@/lib/costing/colors";
import { Panel, PeriodBar, dayList } from "@/components/dash/Dash";
import { THead, Th } from "@/components/tanks/ui";
import { formatNumber } from "@/lib/format";
import type { Costing, SharedHead } from "@/lib/costing/actual";

const rs = (v: number, d = 0) => `₹${formatNumber(v, d)}`;
const td = "num px-3 py-1.5 text-right";

const short = (h: SharedHead) => headLabel(h.code, h.label);
/** A table cell tinted in a shared head's colour. */
const tdHead = (code: string, extra = "") => ({ className: `num px-3 py-1.5 text-right ${extra}`, style: { background: tint(headColor(code), 0.07) } });
const addTo = (acc: Record<string, number>, add: Record<string, number>, k = 1) => {
  for (const [c, v] of Object.entries(add)) acc[c] = (acc[c] ?? 0) + v * k;
  return acc;
};

/** Column header for a cost column: a bar and tint in that cost's colour. */
function ThS({ children, code }: { children: React.ReactNode; code: string }) {
  const c = headColor(code);
  return <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-tertiary-foreground" style={{ background: tint(c, 0.12), borderTop: `3px solid ${c}` }}>{children}</th>;
}

export function ProductionDashboard({ from, to, today, costing, tankIn }: {
  from: string; to: string; today: string; costing: Costing; tankIn: number;
}) {
  const { days, batches, skus, heads } = costing;
  const dates = dayList(from, to);
  const milk = days.reduce((t, d) => t + d.milk_litre, 0);
  const outKg = batches.filter((b) => b.unit === "kg").reduce((t, b) => t + (b.output ?? 0), 0);
  const outL = batches.filter((b) => b.unit === "L").reduce((t, b) => t + (b.output ?? 0), 0);
  const packedKg = skus.filter((s) => s.bulk_unit === "kg").reduce((t, s) => t + s.bulk_qty, 0);
  const packedL = skus.filter((s) => s.bulk_unit === "L").reduce((t, s) => t + s.bulk_qty, 0);
  const skuCount = new Set(skus.map((s) => s.sku_id)).size;
  const byDay = new Map(days.map((d) => [d.day, d]));

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

  // what each cost adds: on the bulk batches, or on the SKUs
  const headAmount: Record<string, number> = {};
  for (const d of days) for (const h of d.heads) if (h.code !== "fuel_delivery") headAmount[h.code] = (headAmount[h.code] ?? 0) + h.amount;
  const delivery = days.reduce((t, d) => t + d.delivery, 0);
  const batchTotal = batches.reduce((t, b) => t + b.total, 0);
  const material = skus.reduce((t, s) => t + s.material_cost, 0);
  const productionCost = batchTotal + material + delivery;
  const milkCostAll = batches.reduce((t, b) => t + b.milk_cost, 0);
  const ingAll = batches.reduce((t, b) => t + b.ingredient_cost + b.labour_cost, 0);
  const packed = packedKg + packedL;
  const onBatch = [
    { key: "milk", label: "Milk from tanks", amount: milkCostAll, color: COST.milk.color, how: "what each batch drew" },
    { key: "ing", label: "Ingredients", amount: ingAll, color: COST.ingredients.color, how: "what each batch used" },
    ...heads.map((h) => ({ key: h.code, label: short(h), amount: headAmount[h.code] ?? 0, color: headColor(h.code), how: "litres of milk in each batch" })),
  ];
  const onSku = [
    { key: "pack", label: "Packing material", amount: material, color: COST.packing.color, how: "each SKU's own packing list" },
    { key: "del", label: "Delivery fuel", amount: delivery, color: COST.fuel_delivery.color, how: "kg / L in each SKU" },
  ];
  const share = (v: number) => (productionCost ? (v / productionCost) * 100 : 0);

  return (
    <div className="space-y-5">
      <PeriodBar from={from} to={to} today={today} />

      {/* ---- the chain: up to the bulk batch, then into SKUs */}
      <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
        <h3 className="text-[13px] font-semibold text-foreground">From milk to SKUs</h3>
        <p className="mt-0.5 text-[12px] text-muted-foreground">Up to the bulk batch it&apos;s litres and kg; after that every SKU is counted in its own unit - see &quot;What each SKU produced&quot; below.</p>
        <div className="mt-4 grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          <Step label="Milk into tanks" value={formatNumber(tankIn, 0)} unit="L" note="farmers + tankers" />
          <Arrow note={tankIn ? `${formatNumber((milk / tankIn) * 100, 0)}% used` : ""} />
          <Step label="Milk into bulk batches" value={formatNumber(milk, 0)} unit="L" note={`${batches.length} batches · ${products.size} products`} />
          <Arrow note="made into" />
          <Step label="Bulk output (yield)" value={formatNumber(outKg, 0)} unit="kg" note={`+ ${formatNumber(outL, 0)} L of milk, lassi, chaach`} />
          <Arrow note={outKg + outL ? `${formatNumber((packed / (outKg + outL)) * 100, 1)}% packed` : ""} />
          <Step label="Packed into SKUs" value={String(skuCount)} unit="SKUs" strong note={`${formatNumber(packedKg, 0)} kg + ${formatNumber(packedL, 0)} L of product`} />
        </div>
      </section>

      {/* ---- where every cost is put */}
      <Panel title="Where every cost is put"
        description="Milk, ingredients and every shared cost go onto the bulk batches. Only packing material and delivery fuel go onto the SKUs. Share = part of the whole production cost.">
        <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <CostPlacement title="On the bulk batches" rows={onBatch} share={share} per={(v) => (milk ? `₹${formatNumber(v / milk, 2)} / L milk` : "—")} />
          <CostPlacement title="On the SKUs" rows={onSku} share={share} per={(v) => (packed ? `₹${formatNumber(v / packed, 2)} / kg·L packed` : "—")} />
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">
          <span>Production cost <span className="num font-semibold text-foreground">{rs(productionCost)}</span></span>
          <span>On batches <span className="num font-semibold text-foreground">{formatNumber(share(batchTotal), 1)}%</span> · on SKUs <span className="num font-semibold text-foreground">{formatNumber(share(material + delivery), 1)}%</span></span>
        </div>
      </Panel>

      {/* ================= up to the bulk batch ================= */}
      <h2 className="pt-2 text-[15px] font-semibold text-foreground">Bulk batches - milk, ingredients and shared costs</h2>

      <SharedWalkthrough costing={costing} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="What a kg / litre of each product costs" description="Per unit of yield, one colour per kind of cost. Everything up to the bulk batch.">
          <StackedBars format={(v) => rs(v, 2)}
            series={(["milk", "ingredients", "electricity", "fuel_production", "labour", "fuel_procurement"] as const).map((k) => ({ label: COST[k].label, color: COST[k].color }))}
            rows={productRows.filter(([, p]) => p.output > 0).map(([id, p]) => ({
              key: id, label: p.name,
              parts: [p.milkCost, p.ing, p.byHead.electricity ?? 0, p.byHead.fuel_production ?? 0, p.byHead.labour ?? 0, p.byHead.fuel_procurement ?? 0].map((v) => v / p.output),
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
                <ThS code="milk">Milk ₹</ThS>
                <ThS code="ingredients">Ingredients ₹</ThS>
                {heads.map((h) => <ThS key={h.code} code={h.code}>{short(h)} ₹</ThS>)}
                <th className="px-3 py-2 text-right">Shared %</th>
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
                  <td {...tdHead("milk")}>{formatNumber(p.milkCost, 0)}</td>
                  <td {...tdHead("ingredients")}>{formatNumber(p.ing, 0)}</td>
                  {heads.map((h) => <td key={h.code} {...tdHead(h.code)}>{formatNumber(p.byHead[h.code] ?? 0, 0)}</td>)}
                  <td className={td}>{p.total ? formatNumber((p.oh / p.total) * 100, 1) : 0}%</td>
                  <td className={`${td} font-semibold text-foreground`}>{formatNumber(p.total, 0)}</td>
                  <td className={`${td} font-semibold text-foreground`}>{p.output ? `${formatNumber(p.total / p.output, 2)} / ${p.unit}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Milk by product, day by day" description="Litres each product took from the tanks.">
        <MatrixHeatmap rows={productRows.map(([id, p]) => ({ key: id, label: p.name, cells: p.cells }))} days={dates} unit="L" emptyLabel="not made" />
      </Panel>

      {/* ================= after packing ================= */}
      <h2 className="pt-2 text-[15px] font-semibold text-foreground">After packing - every SKU in its own unit</h2>

      <SkuOutput costing={costing} dates={dates} />
      <SkuCostTable costing={costing} />
    </div>
  );
}

/** One side of "where every cost is put": each cost, what it came to, and its share of production cost. */
function CostPlacement({ title, rows, share, per }: {
  title: string;
  rows: { key: string; label: string; amount: number; color: string; how: string }[];
  share: (v: number) => number;
  per: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold text-foreground">{title}</div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="text-muted-foreground"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: r.color }} /><span className="font-semibold text-foreground">{r.label}</span> · by {r.how}</span>
              <span className="num shrink-0"><span className="font-semibold text-foreground">{rs(r.amount)}</span> <span className="text-muted-foreground">· {per(r.amount)} · {formatNumber(share(r.amount), 1)}%</span></span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
              <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, share(r.amount))}%`, background: r.color }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const unitName = (u: string, n: number) => {
  const one = { CRT: "crate", CBX: "box", PCS: "piece", KG: "kg" }[u] ?? u.toLowerCase();
  if (u === "KG" || n === 1) return one;
  return u === "CBX" ? "boxes" : `${one}s`;
};
/** "7,840 crates + 6 pcs" - a SKU's count in its own unit. */
const inUnit = (cases: number, loose: number, unit: string, perCase: number) => {
  if (perCase <= 1) return `${formatNumber(cases + loose, unit === "KG" ? 1 : 0)} ${unitName(unit, cases + loose)}`;
  return `${formatNumber(cases, 0)} ${unitName(unit, cases)}${loose ? ` + ${formatNumber(loose, 0)} pcs` : ""}`;
};

/** What every SKU produced, each in its own unit - and day by day. */
function SkuOutput({ costing, dates }: { costing: Costing; dates: string[] }) {
  const agg = new Map<string, { code: string; name: string; category: string; unit: string; perCase: number; cases: number; loose: number; pcs: number; qty: number; qtyUnit: string; days: Set<string>; cells: Record<string, number> }>();
  for (const s of costing.skus) {
    const a = agg.get(s.sku_id) ?? { code: s.code, name: s.name, category: s.category, unit: s.case_unit, perCase: s.pcs_per_case, cases: 0, loose: 0, pcs: 0, qty: 0, qtyUnit: s.bulk_unit ?? "", days: new Set<string>(), cells: {} };
    a.cases += s.cases; a.loose += s.loose_pcs; a.pcs += s.pcs; a.qty += s.bulk_qty; a.days.add(s.day);
    a.cells[s.day] = (a.cells[s.day] ?? 0) + (s.pcs_per_case > 1 ? s.cases : s.cases + s.loose_pcs);
    agg.set(s.sku_id, a);
  }
  const rows = [...agg.entries()].sort((a, b) => a[1].category.localeCompare(b[1].category) || b[1].qty - a[1].qty);
  // loose pieces carry over into full cases for the total
  const norm = (a: { cases: number; loose: number; perCase: number }) =>
    a.perCase > 1 ? { cases: a.cases + Math.floor(a.loose / a.perCase), loose: a.loose % a.perCase } : a;

  return (
    <>
      <Panel title="What each SKU produced" description="Every SKU counted in its own unit - crates, boxes, pieces or kg - with the pieces inside and the product it holds.">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead><Th align="left">Code</Th><Th align="left">SKU</Th><Th align="left">Counted in</Th><Th>Packed</Th><Th>A day</Th><Th>Pieces</Th><Th>Product</Th><Th>Days</Th></THead>
            <tbody>
              {rows.map(([id, a], i) => {
                const n = norm(a);
                const head = i === 0 || rows[i - 1][1].category !== a.category;
                return [
                  head ? (
                    <tr key={`${a.category}-h`} className="bg-muted/40">
                      <td colSpan={8} className="px-3 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{a.category}</td>
                    </tr>
                  ) : null,
                  <tr key={id} className="border-b border-border/70 hover:bg-muted/60">
                    <td className="num px-3 py-1.5 text-[12px]">{a.code}</td>
                    <td className="max-w-72 truncate px-3 py-1.5 font-semibold text-foreground" title={a.name}>{a.name}</td>
                    <td className="px-3 py-1.5 text-[12px] text-muted-foreground">{a.perCase > 1 ? `${a.unit} of ${a.perCase}` : a.unit === "KG" ? "kg" : "piece"}</td>
                    <td className={`${td} font-bold text-foreground`}>{inUnit(n.cases, n.loose, a.unit, a.perCase)}</td>
                    {(() => {
                      const perDay = (a.perCase > 1 ? a.pcs / a.perCase : a.pcs) / Math.max(1, a.days.size);
                      return <td className={td}>{formatNumber(perDay, perDay < 10 ? 1 : 0)} {unitName(a.unit, 2)}</td>;
                    })()}
                    <td className={`${td} text-muted-foreground`}>{a.perCase > 1 ? formatNumber(a.pcs, 0) : "—"}</td>
                    <td className={td}>{formatNumber(a.qty, 0)} {a.qtyUnit}</td>
                    <td className={`${td} text-muted-foreground`}>{a.days.size}</td>
                  </tr>,
                ];
              })}
              {rows.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-[12px] text-muted-foreground">Nothing packed in this period.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Each SKU, day by day" description="Full crates / boxes (or pieces, kg) packed each day, in each SKU's own unit. Hover a cell for the count.">
        <MatrixHeatmap days={dates} unit="in its unit" emptyLabel="not packed"
          rows={rows.map(([id, a]) => ({ key: id, label: `${a.code} · ${a.name} (${a.perCase > 1 ? unitName(a.unit, 2) : a.unit === "KG" ? "kg" : "pcs"})`, cells: a.cells }))} />
      </Panel>
    </>
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
 * Every SKU's cost after packing: the bulk product in it (at its batch's cost,
 * shared costs already inside), each item of its own packing list, and its
 * share of delivery fuel - per piece, per crate / box, or per kg / litre.
 */
function SkuCostTable({ costing }: { costing: Costing }) {
  const [basis, setBasis] = useState<"pc" | "case" | "unit">("pc");
  const [category, setCategory] = useState("All");

  type Agg = { code: string; name: string; category: string; unit: string; caseUnit: string; perCase: number; pcs: number; qty: number; bulk: number; milk: number; ing: number; shared: number; mat: Record<string, number>; del: number; total: number };
  const agg = new Map<string, Agg>();
  for (const s of costing.skus) {
    const a = agg.get(s.sku_id) ?? { code: s.code, name: s.name, category: s.category, unit: s.bulk_unit ?? "", caseUnit: s.case_unit, perCase: s.pcs_per_case, pcs: 0, qty: 0, bulk: 0, milk: 0, ing: 0, shared: 0, mat: {}, del: 0, total: 0 };
    a.pcs += s.pcs; a.qty += s.bulk_qty; a.bulk += s.bulk_cost; a.milk += s.milk_cost; a.shared += s.shared_cost;
    a.ing += Object.values(s.ingredient_by_item).reduce((t, v) => t + v, 0);
    addTo(a.mat, s.material_by_item); a.del += s.delivery_cost; a.total += s.total;
    agg.set(s.sku_id, a);
  }
  const all = [...agg.entries()].sort((a, b) => a[1].category.localeCompare(b[1].category) || b[1].qty - a[1].qty);
  const categories = ["All", ...new Set(all.map(([, a]) => a.category))];
  const rows = all.filter(([, a]) => category === "All" || a.category === category);
  const matTotals: Record<string, number> = {};
  for (const [, a] of rows) addTo(matTotals, a.mat);
  const matCols = Object.entries(matTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const div = (a: Agg) => (basis === "pc" ? a.pcs : basis === "case" ? a.pcs / Math.max(1, a.perCase) : a.qty);
  const per = (v: number, a: Agg) => (div(a) > 0 && v ? formatNumber(v / div(a), 2) : "");
  const caseLabel = (a: Agg) => (a.perCase > 1 ? unitName(a.caseUnit, 1) : a.caseUnit === "KG" ? "kg" : "piece");
  const basisLabel = basis === "pc" ? "per piece" : basis === "case" ? "per crate / box (its own unit)" : "per kg / litre of product";

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">What each SKU costs</h3>
          <p className="mt-0.5 max-w-3xl text-[12px] text-muted-foreground">
            The bulk product in it at its batch&apos;s cost (milk, ingredients and shared costs are already inside), plus its own packing items and its share of delivery fuel - {basisLabel}.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-border text-[12px] font-semibold">
          {([["pc", "Per piece"], ["case", "Per crate / box"], ["unit", "Per kg / L"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setBasis(k)} className={`px-3 py-1.5 ${basis === k ? "bg-foreground text-background" : "bg-white text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${category === c ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[12px] font-semibold text-foreground">What a kg / litre of product costs in each SKU</div>
        <StackedBars format={(v) => `₹${formatNumber(v, 2)}`}
          series={[{ label: "Bulk product (from the batch)", color: COST.milk.color }, { label: COST.packing.label, color: COST.packing.color }, { label: COST.fuel_delivery.label, color: COST.fuel_delivery.color }]}
          rows={rows.slice(0, 18).map(([id, a]) => {
            const d = a.qty || 1;
            return { key: id, label: `${a.code} · ${a.name}`, parts: [a.bulk / d, Object.values(a.mat).reduce((t, v) => t + v, 0) / d, a.del / d], total: `₹${formatNumber(a.total / d, 2)} / ${a.unit}` };
          })} />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-[12px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wide text-tertiary-foreground">
              <th colSpan={3} />
              <th className="px-2 pt-2 pb-1 text-left" style={{ borderTop: `4px solid ${COST.milk.color}`, background: tint(COST.milk.color, 0.1) }}>From the batch</th>
              {matCols.length ? <th colSpan={matCols.length} className="px-2 pt-2 pb-1 text-left" style={{ borderTop: `4px solid ${COST.packing.color}`, background: tint(COST.packing.color, 0.1) }}>Packing (its own list)</th> : null}
              <th className="px-2 pt-2 pb-1 text-left" style={{ borderTop: `4px solid ${COST.fuel_delivery.color}`, background: tint(COST.fuel_delivery.color, 0.1) }}>Delivery</th>
              <th colSpan={3} />
            </tr>
            <tr className="border-b border-border bg-secondary text-[10px] font-bold uppercase tracking-wide text-tertiary-foreground">
              <th className="px-2 py-2 text-left">Code</th>
              <th className="px-2 py-2 text-left">SKU</th>
              <th className="px-2 py-2 text-left">Unit</th>
              <th className="px-2 py-2 text-right" style={{ background: tint(COST.milk.color, 0.1) }}>Bulk product</th>
              {matCols.map((m) => <th key={m} className="max-w-28 truncate px-2 py-2 text-right normal-case" style={{ background: tint(COST.packing.color, 0.1) }} title={m}>{m}</th>)}
              <th className="px-2 py-2 text-right" style={{ background: tint(COST.fuel_delivery.color, 0.1) }}>Fuel</th>
              <th className="px-2 py-2 text-right">₹ / piece</th>
              <th className="px-2 py-2 text-right">₹ / crate · box</th>
              <th className="px-2 py-2 text-right">₹ / kg or L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, a]) => (
              <tr key={id} className="border-b border-border/70 hover:bg-muted/60">
                <td className="num px-2 py-1.5">{a.code}</td>
                <td className="max-w-56 truncate px-2 py-1.5 font-semibold text-foreground" title={a.name}>{a.name}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{a.perCase > 1 ? `${a.caseUnit} of ${a.perCase}` : caseLabel(a)}</td>
                <td className="num px-2 py-1.5 text-right" style={{ background: tint(COST.milk.color, 0.05) }}
                  title={`Inside the bulk product ${basisLabel}: milk ${per(a.milk, a) || 0} · ingredients ${per(a.ing, a) || 0} · shared costs ${per(a.shared, a) || 0}`}>
                  {per(a.bulk, a)}
                </td>
                {matCols.map((m) => <td key={m} className="num px-2 py-1.5 text-right" style={{ background: tint(COST.packing.color, 0.05) }}>{per(a.mat[m] ?? 0, a)}</td>)}
                <td className="num px-2 py-1.5 text-right" style={{ background: tint(COST.fuel_delivery.color, 0.05) }}>{per(a.del, a)}</td>
                <td className={`num px-2 py-1.5 text-right ${basis === "pc" ? "text-[13px] font-bold text-foreground" : ""}`}>{a.pcs ? formatNumber(a.total / a.pcs, 2) : "—"}</td>
                <td className={`num px-2 py-1.5 text-right ${basis === "case" ? "text-[13px] font-bold text-foreground" : ""}`}>
                  {a.pcs && a.perCase > 1 ? `${formatNumber((a.total / a.pcs) * a.perCase, 2)} / ${caseLabel(a)}` : "—"}
                </td>
                <td className={`num px-2 py-1.5 text-right ${basis === "unit" ? "text-[13px] font-bold text-foreground" : ""}`}>{a.qty ? `${formatNumber(a.total / a.qty, 2)} / ${a.unit}` : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-6 text-center text-[12px] text-muted-foreground">Nothing packed in this period.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        The tinted columns are {basisLabel}; across a row they add up to the bold total. Hover &quot;Bulk product&quot; to see the milk, ingredients and shared costs inside it. A blank cell means the SKU doesn&apos;t use that item.
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
                  <td className="py-0.5 text-muted-foreground"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: headColor(h.code) }} />{short(h)}</td>
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
                <li key={h.code} className="flex justify-between gap-3"><span className="text-muted-foreground"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: headColor(h.code) }} />{short(h)}</span><span className="num font-semibold" style={{ color: GAIA.orange }}>{rs((example.shared_by_head[h.code] ?? 0) / example.pcs, 3)}</span></li>
              ))}
              <li className="flex justify-between gap-3"><span className="text-muted-foreground"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: COST.fuel_delivery.color }} />Delivery fuel</span><span className="num font-semibold" style={{ color: GAIA.orange }}>{rs(example.delivery_cost / example.pcs, 3)}</span></li>
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
              {heads.map((h) => <ThS key={h.code} code={h.code}>{short(h)} ₹</ThS>)}
              <ThS code="shared">Shared ₹</ThS>
              <th className="px-3 py-2 text-right">Batch ₹</th>
              <th className="px-3 py-2 text-right">Yield</th>
              <ThS code="shared">Shared / unit</ThS>
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
                {heads.map((h) => <td key={h.code} {...tdHead(h.code)}>{formatNumber(b.shared_by_head[h.code] ?? 0, 0)}</td>)}
                <td {...tdHead("shared", "font-semibold text-foreground")}>{formatNumber(b.overhead_cost, 0)}</td>
                <td className={`${td} font-semibold text-foreground`}>{formatNumber(b.total, 0)}</td>
                <td className={td}>{b.output === null ? "—" : `${formatNumber(b.output, 1)} ${b.unit}`}</td>
                <td {...tdHead("shared")}>{b.output ? formatNumber(b.overhead_cost / b.output, 2) : "—"}</td>
                <td className={`${td} font-semibold text-foreground`}>{b.unit_cost === null ? "—" : `${formatNumber(b.unit_cost, 2)} / ${b.unit}`}</td>
              </tr>
            ))}
            <tr className="bg-muted/50 font-semibold">
              <td className="px-3 py-2">All batches</td>
              <td className={td}>{formatNumber(d.milk_litre, 0)}</td>
              <td className={td}>{formatNumber(batches.reduce((t, b) => t + b.milk_cost, 0), 0)}</td>
              <td className={td}>{formatNumber(batches.reduce((t, b) => t + b.ingredient_cost, 0), 0)}</td>
              {heads.map((h) => <td key={h.code} {...tdHead(h.code)}>{formatNumber(batches.reduce((t, b) => t + (b.shared_by_head[h.code] ?? 0), 0), 0)}</td>)}
              <td {...tdHead("shared")}>{formatNumber(batches.reduce((t, b) => t + b.overhead_cost, 0), 0)}</td>
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
