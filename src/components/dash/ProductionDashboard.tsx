"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { CAT3, ColumnChart, GAIA, MatrixHeatmap, StackedBars, TrendChart, shortDate } from "@/components/farmers/charts";
import { Panel, PeriodBar, dayList } from "@/components/dash/Dash";
import { THead, Th } from "@/components/tanks/ui";
import { formatNumber } from "@/lib/format";
import type { Costing, SkuCost } from "@/lib/costing/actual";

const rs = (v: number, d = 0) => `₹${formatNumber(v, d)}`;
const td = "num px-3 py-1.5 text-right";
const CASE_NAMES: Record<string, { one: string; many: string }> = {
  CRT: { one: "crate", many: "Crates" }, CBX: { one: "box", many: "Boxes" }, PCS: { one: "piece", many: "Pieces (buckets, tins, paneer)" }, KG: { one: "kg", many: "Kg (khowa)" },
};

export function ProductionDashboard({ from, to, today, costing, tankIn }: {
  from: string; to: string; today: string; costing: Costing; tankIn: number;
}) {
  const { days, batches, skus } = costing;
  const dates = dayList(from, to);
  const milk = days.reduce((t, d) => t + d.milk_litre, 0);
  const outKg = batches.filter((b) => b.unit === "kg").reduce((t, b) => t + (b.output ?? 0), 0);
  const outL = batches.filter((b) => b.unit === "L").reduce((t, b) => t + (b.output ?? 0), 0);
  const pcs = skus.reduce((t, s) => t + s.pcs, 0);
  const packedKg = skus.filter((s) => s.bulk_unit === "kg").reduce((t, s) => t + s.bulk_qty, 0);
  const packedL = skus.filter((s) => s.bulk_unit === "L").reduce((t, s) => t + s.bulk_qty, 0);
  const totalSku = skus.reduce((t, s) => t + s.total, 0);

  // finished output by case type
  const byCase = new Map<string, { cases: number; pcs: number }>();
  for (const s of skus) {
    const c = byCase.get(s.case_unit) ?? { cases: 0, pcs: 0 };
    c.cases += s.cases + (s.pcs_per_case === 1 ? s.loose_pcs : 0);
    c.pcs += s.pcs;
    byCase.set(s.case_unit, c);
  }

  // products over the period
  const products = new Map<string, { name: string; unit: string; batches: number; milk: number; output: number; milkCost: number; ing: number; oh: number; total: number; cells: Record<string, number> }>();
  for (const b of batches) {
    const p = products.get(b.product_id) ?? { name: b.product, unit: b.unit, batches: 0, milk: 0, output: 0, milkCost: 0, ing: 0, oh: 0, total: 0, cells: {} };
    p.batches += 1; p.milk += b.milk_litre; p.output += b.output ?? 0; p.milkCost += b.milk_cost;
    p.ing += b.ingredient_cost + b.labour_cost; p.oh += b.overhead_cost; p.total += b.total;
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

  // per SKU over the period
  const skuAgg = new Map<string, { code: string; name: string; caseUnit: string; perCase: number; cases: number; loose: number; pcs: number; bulk: number; shared: number; mat: number; del: number; total: number }>();
  for (const s of skus) {
    const a = skuAgg.get(s.sku_id) ?? { code: s.code, name: s.name, caseUnit: s.case_unit, perCase: s.pcs_per_case, cases: 0, loose: 0, pcs: 0, bulk: 0, shared: 0, mat: 0, del: 0, total: 0 };
    a.cases += s.cases; a.loose += s.loose_pcs; a.pcs += s.pcs; a.bulk += s.bulk_cost; a.shared += s.shared_cost;
    a.mat += s.material_cost; a.del += s.delivery_cost; a.total += s.total;
    skuAgg.set(s.sku_id, a);
  }
  const skuRows = [...skuAgg.entries()].sort((a, b) => b[1].pcs - a[1].pcs);
  const pcsByDay = new Map<string, number>();
  for (const s of skus) pcsByDay.set(s.day, (pcsByDay.get(s.day) ?? 0) + s.pcs);
  const byDay = new Map(days.map((d) => [d.day, d]));

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

      <Panel title="Output by category" description="Cases and pieces packed, how much product went into them, and what it all cost (bulk product + packing + delivery).">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead><Th align="left">Category</Th><Th>SKUs</Th><Th align="left">Cases</Th><Th>Pieces</Th><Th>Product packed</Th><Th>Cost ₹</Th><Th>₹ / piece</Th></THead>
            <tbody>
              {[...cats.entries()].sort((a, b) => b[1].pcs - a[1].pcs).map(([name, c]) => (
                <tr key={name} className="border-b border-border/70 hover:bg-muted/60">
                  <td className="px-3 py-1.5 font-semibold text-foreground">{name}</td>
                  <td className={td}>{c.skus.size}</td>
                  <td className="px-3 py-1.5 text-[12px] text-muted-foreground">
                    {Object.entries(c.cases).map(([u, n]) => `${formatNumber(n, 0)} ${n === 1 ? CASE_NAMES[u]?.one : (CASE_NAMES[u]?.one ?? u) + (u === "KG" ? "" : u === "CBX" ? "es" : "s")}`).join(" · ")}
                  </td>
                  <td className={`${td} font-semibold text-foreground`}>{formatNumber(c.pcs, 0)}</td>
                  <td className={td}>{formatNumber(c.qty, 0)} {c.unit}</td>
                  <td className={td}>{formatNumber(c.total, 0)}</td>
                  <td className={`${td} font-semibold text-foreground`}>{c.pcs ? formatNumber(c.total / c.pcs, 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---- where shared costs go */}
      <SharedWalkthrough costing={costing} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="What a kg / litre of each product costs" description="Per unit of yield, split into its three parts. Shared = the day's electricity, fuel, labour and milk transport by litres of milk.">
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
            extraTip={(d) => [
              { label: "shared ₹", value: formatNumber(byDay.get(d)?.shared ?? 0, 0) },
              { label: "L milk", value: formatNumber(byDay.get(d)?.milk_litre ?? 0, 0) },
            ]} />
        </Panel>
      </div>

      <Panel title="Milk by product, day by day" description="Litres each product took from the tanks. Products made on set weekdays show as stripes.">
        <MatrixHeatmap rows={productRows.map(([id, p]) => ({ key: id, label: p.name, cells: p.cells }))} days={dates} unit="L" emptyLabel="not made" />
      </Panel>

      <Panel title="Every SKU" description="Cases and pieces packed, and what one piece cost - including its share of the day's shared costs.">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead>
              <Th align="left">Code</Th><Th align="left">SKU</Th><Th>Cases</Th><Th>Pieces</Th><Th>Bulk product ₹</Th>
              <Th>of which shared ₹</Th><Th>Packing ₹</Th><Th>Delivery ₹</Th><Th>₹ / piece</Th><Th>Shared / piece</Th>
            </THead>
            <tbody>
              {skuRows.map(([id, s]) => (
                <tr key={id} className="border-b border-border/70 hover:bg-muted/60">
                  <td className="num px-3 py-1.5 text-[12px]">{s.code}</td>
                  <td className="max-w-72 truncate px-3 py-1.5 font-semibold text-foreground" title={s.name}>{s.name}</td>
                  <td className={td}>{s.perCase > 1 ? `${formatNumber(s.cases, 0)} ${s.caseUnit}` : "—"}</td>
                  <td className={`${td} font-semibold text-foreground`}>{formatNumber(s.pcs, 0)}</td>
                  <td className={td}>{formatNumber(s.bulk, 0)}</td>
                  <td className={`${td} text-muted-foreground`}>{formatNumber(s.shared, 0)}</td>
                  <td className={td}>{formatNumber(s.mat, 0)}</td>
                  <td className={td}>{formatNumber(s.del, 0)}</td>
                  <td className={`${td} font-semibold text-foreground`}>{s.pcs ? formatNumber(s.total / s.pcs, 2) : "—"}</td>
                  <td className={`${td} text-muted-foreground`}>{s.pcs ? formatNumber((s.shared + s.del) / s.pcs, 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
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
 * Shows, for one day, exactly where shared costs go: the heads that make them
 * up, the litres they are divided over, each batch's share, what that adds to
 * a kg / litre, and what lands in one SKU piece. Delivery fuel's route to the
 * SKUs is shown beside it.
 */
function SharedWalkthrough({ costing }: { costing: Costing }) {
  const withBatches = costing.days.filter((d) => d.milk_litre > 0);
  const [day, setDay] = useState(withBatches[withBatches.length - 1]?.day ?? "");
  const d = costing.days.find((x) => x.day === day);
  if (!d) return null;
  const batches = costing.batches.filter((b) => b.day === day).sort((a, b) => b.milk_litre - a.milk_litre);
  const skus = costing.skus.filter((s) => s.day === day);
  const packed = skus.reduce((t, s) => t + s.bulk_qty, 0);
  const example: SkuCost | undefined = [...skus].sort((a, b) => b.pcs - a.pcs)[0];
  const shared = d.heads.filter((h) => h.code !== "fuel_delivery");

  return (
    <section className="rounded-lg border-2 border-foreground/15 bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">Where the shared costs are added</h3>
          <p className="mt-0.5 max-w-3xl text-[12px] text-muted-foreground">
            Electricity, labour, coal and milk-to-plant transport aren&apos;t tied to one product, so each day&apos;s total is divided over the litres of
            milk that went into bulk batches that day. Every batch carries its litres&apos; share; that share then travels into each kg / litre of
            yield and into every SKU piece made from it. Delivery fuel is spread over the SKUs packed instead.
          </p>
        </div>
        <label className="text-[12px] text-muted-foreground">
          Day{" "}
          <select value={day} onChange={(e) => setDay(e.target.value)} className="ml-1 h-8 rounded-lg border border-border bg-white px-2 text-[13px] font-semibold text-foreground">
            {[...withBatches].reverse().map((x) => <option key={x.day} value={x.day}>{shortDate(x.day)}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div className="rounded-lg bg-muted/60 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">1 · The day&apos;s shared costs</div>
          <ul className="mt-2 space-y-1 text-[12px]">
            {shared.map((h) => (
              <li key={h.code} className="flex justify-between gap-3"><span className="text-muted-foreground">{h.label}</span><span className="num font-semibold text-foreground">{rs(h.amount)}</span></li>
            ))}
            <li className="flex justify-between gap-3 border-t border-border pt-1"><span className="font-semibold text-foreground">Total</span><span className="num font-bold text-foreground">{rs(d.shared)}</span></li>
          </ul>
        </div>
        <ChevronRight className="hidden h-5 w-5 self-center text-muted-foreground lg:block" />
        <div className="flex flex-col justify-center rounded-lg bg-muted/60 p-3 text-center">
          <div className="text-[11px] font-semibold text-muted-foreground">2 · Divided over the milk processed</div>
          <div className="num mt-2 text-[13px] text-foreground">{rs(d.shared)} ÷ {formatNumber(d.milk_litre, 0)} L</div>
          <div className="num mt-1 text-[26px] font-bold" style={{ color: GAIA.orange }}>{d.rate_per_litre === null ? "—" : rs(d.rate_per_litre, 2)}</div>
          <div className="text-[11px] text-muted-foreground">per litre of milk, added to every batch</div>
        </div>
        <ChevronRight className="hidden h-5 w-5 self-center text-muted-foreground lg:block" />
        <div className="rounded-lg bg-muted/60 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">3 · Into one piece {example ? `- ${example.name}` : ""}</div>
          {example ? (
            <ul className="mt-2 space-y-1 text-[12px]">
              <li className="flex justify-between gap-3"><span className="text-muted-foreground">Bulk product in it</span><span className="num font-semibold text-foreground">{rs(example.bulk_cost / example.pcs, 2)}</span></li>
              <li className="flex justify-between gap-3 pl-3"><span className="text-muted-foreground">of which shared costs</span><span className="num font-semibold" style={{ color: GAIA.orange }}>{rs(example.shared_cost / example.pcs, 2)}</span></li>
              <li className="flex justify-between gap-3"><span className="text-muted-foreground">Packing material</span><span className="num font-semibold text-foreground">{rs(example.material_cost / example.pcs, 2)}</span></li>
              <li className="flex justify-between gap-3"><span className="text-muted-foreground">Delivery fuel</span><span className="num font-semibold" style={{ color: GAIA.orange }}>{rs(example.delivery_cost / example.pcs, 2)}</span></li>
              <li className="flex justify-between gap-3 border-t border-border pt-1"><span className="font-semibold text-foreground">One piece</span><span className="num font-bold text-foreground">{rs(example.total / example.pcs, 2)}</span></li>
            </ul>
          ) : <p className="mt-2 text-[12px] text-muted-foreground">Nothing packed this day.</p>}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-[13px]">
          <THead>
            <Th align="left">Batch</Th><Th>Milk L</Th><Th>× ₹ / L</Th><Th>= Shared ₹</Th><Th>Milk ₹</Th><Th>Ingredients ₹</Th>
            <Th>Batch ₹</Th><Th>Yield</Th><Th>Shared / unit</Th><Th>Cost / unit</Th>
          </THead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.product_id} className="border-b border-border/70 hover:bg-muted/60">
                <td className="px-3 py-1.5 font-semibold text-foreground">{b.product}</td>
                <td className={td}>{formatNumber(b.milk_litre, 0)}</td>
                <td className={`${td} text-muted-foreground`}>{d.rate_per_litre === null ? "—" : formatNumber(d.rate_per_litre, 2)}</td>
                <td className={`${td} font-semibold`} style={{ color: GAIA.orange }}>{formatNumber(b.overhead_cost, 0)}</td>
                <td className={td}>{formatNumber(b.milk_cost, 0)}</td>
                <td className={td}>{formatNumber(b.ingredient_cost, 0)}</td>
                <td className={`${td} font-semibold text-foreground`}>{formatNumber(b.total, 0)}</td>
                <td className={td}>{b.output === null ? "—" : `${formatNumber(b.output, 1)} ${b.unit}`}</td>
                <td className={td}>{b.output ? `${formatNumber(b.overhead_cost / b.output, 2)}` : "—"}</td>
                <td className={`${td} font-semibold text-foreground`}>{b.unit_cost === null ? "—" : `${formatNumber(b.unit_cost, 2)} / ${b.unit}`}</td>
              </tr>
            ))}
            <tr className="bg-muted/50 font-semibold">
              <td className="px-3 py-2">All batches</td>
              <td className={td}>{formatNumber(d.milk_litre, 0)}</td>
              <td />
              <td className={td} style={{ color: GAIA.orange }}>{formatNumber(batches.reduce((t, b) => t + b.overhead_cost, 0), 0)}</td>
              <td className={td}>{formatNumber(batches.reduce((t, b) => t + b.milk_cost, 0), 0)}</td>
              <td className={td}>{formatNumber(batches.reduce((t, b) => t + b.ingredient_cost, 0), 0)}</td>
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
