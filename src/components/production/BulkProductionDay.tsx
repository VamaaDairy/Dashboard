"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Milk, Plus, Trash2 } from "lucide-react";
import { saveProductionDay, type DayRow } from "@/app/daily/bulk-actions";
import { Empty, Section, THead, Th } from "@/components/tanks/ui";
import { DateBar } from "@/components/tanks/TankDayBoard";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import { kgOfSolid } from "@/lib/units";
import { batchComplete } from "@/lib/production/complete";
import { headColor, tint } from "@/lib/costing/colors";
import type { Batch, BatchMilk, BulkProduct, IngredientOption, ProductionDaySummary } from "@/lib/production/data";
import type { TankDay } from "@/lib/tanks/data";

type Line = { ingredient_id: string | null; name: string; qty: string; unit: string; custom?: boolean };
type Draw = { tank_id: string; litres: string };
type Row = {
  output_qty: string; labour_workers: string; labour_hours: string; labour_cost: string;
  milk: Draw[]; ingredients: Line[];
};
type Blend = { fat: number | null; snf: number | null; rate: number | null };
const LABOUR = ["labour_workers", "labour_hours", "labour_cost"] as const;
const UNITS = ["kg", "g", "L", "ml", "pcs"];

const str = (n: number | null) => (n === null || n === undefined ? "0" : String(Number(n)));
const val = (s: string) => {
  const v = Number(s.replace(/,/g, "").trim());
  return s.trim() === "" || !Number.isFinite(v) ? null : v;
};
const num = (n: number | null | undefined) => (n === null || n === undefined ? null : Number(n));

function blankRow(): Row {
  return { output_qty: "0", labour_workers: "0", labour_hours: "0", labour_cost: "0", milk: [], ingredients: [] };
}

const cell = "w-16 rounded-md border border-border bg-white px-1.5 py-1 text-right text-[13px] focus:border-foreground/40 focus:outline-none";

/**
 * The blend milk leaves a tank at on this date. A draw already saved keeps the
 * exact blend the tank engine gave it; a new one is shown at the tank's blend
 * at the end of the day (draws don't change a blend, so this only differs if
 * milk came in after it - the save works it out exactly).
 */
function blendOf(tankId: string, tanks: TankDay[], saved: BatchMilk[]): Blend {
  const s = saved.find((m) => m.tank_id === tankId);
  if (s) return { fat: num(s.fat_pct), snf: num(s.snf_pct), rate: num(s.cost_per_litre) };
  const t = tanks.find((x) => x.tank_id === tankId);
  return { fat: num(t?.close_fat_pct), snf: num(t?.close_snf_pct), rate: num(t?.close_cost_per_litre) };
}

/** A product's milk: total litres, weighted fat and SNF, kg of each, and cost. */
function milkOf(draws: Draw[], tanks: TankDay[], saved: BatchMilk[], kgPerLitre: number) {
  let litres = 0, kgFat = 0, kgSnf = 0, cost = 0, kgMilk = 0;
  for (const d of draws) {
    const l = val(d.litres) ?? 0;
    if (!d.tank_id || l <= 0) continue;
    const b = blendOf(d.tank_id, tanks, saved);
    litres += l;
    kgMilk += l * kgPerLitre;
    kgFat += kgOfSolid(l, b.fat, kgPerLitre) ?? 0;
    kgSnf += kgOfSolid(l, b.snf, kgPerLitre) ?? 0;
    cost += l * (b.rate ?? 0);
  }
  return {
    litres, kgFat, kgSnf, cost,
    fat: kgMilk > 0 ? (kgFat / kgMilk) * 100 : null,
    snf: kgMilk > 0 ? (kgSnf / kgMilk) * 100 : null,
  };
}

export function BulkProductionDay({
  date, today, products, batches, ingredients, kgPerLitre, history, tanks, shared,
}: {
  /** the day's shared costs (all overheads but delivery), head by head, and the litres they are divided over */
  shared: { amount: number; litres: number; rate: number | null; heads: { code: string; label: string; amount: number; rate: number }[] };
  date: string;
  today: string;
  products: BulkProduct[];
  batches: Batch[];
  ingredients: IngredientOption[];
  kgPerLitre: number;
  history: ProductionDaySummary[];
  tanks: TankDay[];
}) {
  const router = useRouter();
  const active = products.filter((p) => p.is_active || batches.some((b) => b.bulk_product_id === p.id));
  const savedMilk = (id: string) => batches.find((b) => b.bulk_product_id === id)?.milk ?? [];
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(active.map((p) => {
      const b = batches.find((x) => x.bulk_product_id === p.id);
      if (!b) return [p.id, blankRow()];
      return [p.id, {
        output_qty: str(b.output_qty), labour_workers: str(b.labour_workers), labour_hours: str(b.labour_hours),
        labour_cost: str(b.labour_cost),
        milk: b.milk.map((m) => ({ tank_id: m.tank_id, litres: String(Number(m.litres)) })),
        ingredients: b.ingredients.map((i) => ({ ingredient_id: i.ingredient_id, name: i.name, qty: String(Number(i.qty)), unit: i.unit })),
      }];
    })),
  );
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);   // product whose ingredients are open
  const [drawing, setDrawing] = useState<string | null>(null);   // product whose milk is open
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (id: string, patch: Partial<Row>) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
    setDirty(true);
    setSavedAt(null);
  };

  const milk = (id: string) => milkOf(rows[id].milk, tanks, savedMilk(id), kgPerLitre);
  const isUsed = (id: string) => {
    const r = rows[id];
    return milk(id).litres > 0 || (val(r.output_qty) ?? 0) > 0 || r.ingredients.length > 0
      || LABOUR.some((f) => (val(r[f]) ?? 0) > 0);
  };
  const isComplete = (p: BulkProduct) =>
    batchComplete(p.ingredients, rows[p.id].ingredients.map((l) => ({ ingredient_id: l.ingredient_id, qty: Number(l.qty) })), milk(p.id).litres);

  const totals = useMemo(() => {
    const ms = active.map((p) => milk(p.id));
    const all = Object.values(rows);
    const sum = (f: (r: Row) => number) => all.reduce((s, r) => s + f(r), 0);
    const made = active.filter((p) => isUsed(p.id));
    return {
      milk: ms.reduce((s, m) => s + m.litres, 0),
      kgFat: ms.reduce((s, m) => s + m.kgFat, 0),
      kgSnf: ms.reduce((s, m) => s + m.kgSnf, 0),
      milkCost: ms.reduce((s, m) => s + m.cost, 0),
      workerHours: sum((r) => (val(r.labour_workers) ?? 0) * (val(r.labour_hours) ?? 0)),
      labour: sum((r) => val(r.labour_cost) ?? 0),
      made: made.length,
      incomplete: made.filter((p) => !isComplete(p)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, kgPerLitre, tanks]);

  // what each tank still has for this day's batches: its closing balance, plus the
  // draws already saved today (the save replaces them), less what the table now asks for
  const available = (tankId: string, except?: { product: string; index: number }) => {
    const t = tanks.find((x) => x.tank_id === tankId);
    const savedToday = batches.reduce((s, b) => s + b.milk.filter((m) => m.tank_id === tankId).reduce((a, m) => a + Number(m.litres), 0), 0);
    let asked = 0;
    for (const [pid, r] of Object.entries(rows)) {
      r.milk.forEach((d, i) => {
        if (d.tank_id !== tankId) return;
        if (except && except.product === pid && except.index === i) return;
        asked += val(d.litres) ?? 0;
      });
    }
    return Number(t?.close_litre ?? 0) + savedToday - asked;
  };

  function save() {
    const payload: DayRow[] = active.map((p) => {
      const r = rows[p.id];
      return {
        bulk_product_id: p.id,
        output_qty: val(r.output_qty), labour_workers: val(r.labour_workers), labour_hours: val(r.labour_hours),
        labour_cost: val(r.labour_cost), notes: null,
        milk: r.milk.filter((d) => d.tank_id && (val(d.litres) ?? 0) > 0).map((d) => ({ tank_id: d.tank_id, litres: val(d.litres) ?? 0 })),
        ingredients: r.ingredients.map((l) => ({ ingredient_id: l.ingredient_id, name: l.name, qty: Number(l.qty), unit: l.unit })),
      };
    });
    start(async () => {
      const res = await saveProductionDay(date, payload);
      if (!res.ok) { setError(res.error); return; }
      setError(null);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString("en-IN"));
      router.refresh();
    });
  }

  const editingProduct = active.find((p) => p.id === editing) ?? null;
  const drawingProduct = active.find((p) => p.id === drawing) ?? null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateBar date={date} today={today} basePath="/daily" />
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted-foreground">
            {error ? <span className="font-semibold text-destructive">{error}</span>
              : savedAt ? `Saved at ${savedAt}` : dirty ? "Unsaved changes" : batches.length ? "Saved" : "Nothing entered for this day yet"}
          </span>
          <Button onClick={save} disabled={pending || !dirty} className="bg-foreground text-background hover:bg-foreground/85">
            {pending ? "Saving…" : "Save day"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          {
            label: "Batches complete", value: `${totals.made - totals.incomplete}`, unit: `of ${totals.made} made`,
            note: totals.incomplete ? `${totals.incomplete} need ingredients` : null,
          },
          { label: "Milk from tanks", value: formatNumber(totals.milk, 0), unit: "L", note: totals.milkCost ? `₹${formatNumber(totals.milkCost, 0)}` : null },
          { label: "Kg fat · kg SNF", value: `${formatNumber(totals.kgFat, 1)} · ${formatNumber(totals.kgSnf, 1)}`, unit: "kg", note: null },
          { label: "Worker-hours", value: formatNumber(totals.workerHours, 1), unit: "h", note: null },
          { label: "Labour", value: `₹${formatNumber(totals.labour, 0)}`, unit: "", note: null },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
            <div className="text-[11px] font-medium text-muted-foreground">{s.label}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-[20px] font-bold text-foreground">{s.value}</span>
              <span className="text-[12px] text-muted-foreground">{s.unit}</span>
            </div>
            {s.note ? <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{s.note}</div> : null}
          </div>
        ))}
      </div>

      <Section
        title={`Bulk production · ${date}`}
        description="Take each product's milk from the tanks - fat, SNF and cost come from the tank. Enter every ingredient's quantity: a batch is complete only once all of them are in. The yield can be added later. Save day when done."
        actions={
          <Link href="/daily/products" className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">
            Products &amp; ingredients →
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead>
              <Th align="left">Product</Th>
              <Th align="left">Status</Th>
              <Th align="left">Milk from tanks</Th>
              <Th>Fat %</Th>
              <Th>SNF %</Th>
              <Th>Kg fat</Th>
              <Th>Kg SNF</Th>
              <Th>Milk ₹</Th>
              {shared.heads.map((h) => (
                <th key={h.code} className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-tertiary-foreground" style={{ background: tint(headColor(h.code), 0.12), borderTop: `3px solid ${headColor(h.code)}` }} title={`₹${formatNumber(h.rate, 3)} per litre of milk`}>
                  {h.label} ₹
                  <div className="num mt-0.5 font-semibold normal-case tracking-normal text-foreground">₹{formatNumber(h.amount, 0)} ÷ {formatNumber(shared.litres, 0)} L</div>
                  <div className="num font-normal normal-case tracking-normal">= ₹{formatNumber(h.rate, 3)} / L</div>
                </th>
              ))}
              <th className="bg-muted px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-tertiary-foreground">
                Shared ₹
                {shared.rate !== null ? <div className="num mt-0.5 font-semibold normal-case tracking-normal text-foreground">= ₹{formatNumber(shared.rate, 2)} / L</div> : null}
              </th>
              <Th align="left">Ingredients</Th>
              <Th>Yield</Th>
              <Th>Per 100 L milk</Th>
              <Th>Workers</Th>
              <Th>Hours</Th>
              <Th>Labour ₹</Th>
            </THead>
            <tbody>
              {active.map((p) => {
                const r = rows[p.id];
                const m = milk(p.id);
                const out = val(r.output_qty) ?? 0;
                const used = isUsed(p.id);
                const complete = isComplete(p);
                const draws = r.milk.filter((d) => d.tank_id && (val(d.litres) ?? 0) > 0);
                const tankName = (id: string) => tanks.find((t) => t.tank_id === id)?.name ?? "Tank";
                const entered = r.ingredients.filter((l) => Number(l.qty) > 0);
                const missing = p.ingredients.filter((i) => !entered.some((l) => l.ingredient_id === i.ingredient_id));
                return (
                  <tr key={p.id} className={`border-b border-border/70 ${used ? "" : "text-muted-foreground"}`}>
                    <td className="px-3 py-1.5">
                      <button onClick={() => setEditing(p.id)} className="text-left font-semibold text-foreground hover:underline" title={`Ingredients for ${p.name}`}>
                        {p.name}
                      </button>
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">{p.unit}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      {!used ? <span className="text-[11px] text-tertiary-foreground">Not made</span>
                        : complete ? (
                          <span className="inline-flex flex-col leading-tight">
                            <span className="inline-flex w-fit items-center rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">Complete</span>
                            {out > 0 ? null : <span className="mt-0.5 text-[10px] text-muted-foreground">Yield pending</span>}
                          </span>
                        ) : (
                          <button onClick={() => setEditing(p.id)}
                            className="inline-flex items-center rounded-full border border-dashed border-foreground/40 px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-muted"
                            title={missing.length ? `Missing: ${missing.map((i) => i.name).join(", ")}` : "Enter the ingredients used"}>
                            Incomplete · {missing.length ? `${missing.length} ingredient${missing.length > 1 ? "s" : ""} missing` : "no ingredients"}
                          </button>
                        )}
                    </td>
                    <td className="max-w-56 px-3 py-1.5">
                      <button onClick={() => setDrawing(p.id)}
                        className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-border px-2 py-1 text-left text-[12px] hover:bg-muted"
                        title={draws.map((d) => `${tankName(d.tank_id)}: ${d.litres} L`).join("\n") || "Take milk from a tank"}>
                        <Milk className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {draws.length
                          ? <span className="truncate font-semibold text-foreground">
                              {formatNumber(m.litres, 0)} L · {draws.map((d) => tankName(d.tank_id)).join(", ")}
                            </span>
                          : <span className="text-muted-foreground">Take from tank</span>}
                      </button>
                    </td>
                    <td className="num px-3 py-1.5 text-right">{m.fat === null ? "—" : formatNumber(m.fat, 2)}</td>
                    <td className="num px-3 py-1.5 text-right">{m.snf === null ? "—" : formatNumber(m.snf, 2)}</td>
                    <td className="num px-3 py-1.5 text-right">{formatNumber(m.kgFat, 1)}</td>
                    <td className="num px-3 py-1.5 text-right">{formatNumber(m.kgSnf, 1)}</td>
                    <td className="num px-3 py-1.5 text-right">{m.litres > 0 ? formatNumber(m.cost, 0) : "—"}</td>
                    {shared.heads.map((h) => (
                      <td key={h.code} className="num px-3 py-1.5 text-right text-muted-foreground" style={{ background: tint(headColor(h.code), 0.06) }} title={`${formatNumber(m.litres, 0)} L × ₹${formatNumber(h.rate, 3)}`}>
                        {m.litres > 0 ? formatNumber(m.litres * h.rate, 0) : "—"}
                      </td>
                    ))}
                    <td className="num bg-muted/60 px-3 py-1.5 text-right font-semibold text-foreground" title={shared.rate === null ? "Shared costs appear once the day has electricity, fuel, labour or transport entered" : `${formatNumber(m.litres, 0)} L × ₹${formatNumber(shared.rate, 2)} per litre`}>
                      {m.litres > 0 && shared.rate !== null ? formatNumber(m.litres * shared.rate, 0) : "—"}
                    </td>
                    <td className="max-w-56 px-3 py-1.5">
                      <button onClick={() => setEditing(p.id)}
                        className="block max-w-full truncate rounded-md border border-border px-2 py-1 text-left text-[12px] hover:bg-muted"
                        title={r.ingredients.map((l) => `${l.name} ${l.qty} ${l.unit}`).join("\n")}>
                        {r.ingredients.length
                          ? <span className="font-semibold text-foreground">{r.ingredients.map((l) => `${l.name} ${l.qty} ${l.unit}`).join(" · ")}</span>
                          : p.ingredients.length
                            ? <span className="text-muted-foreground">{p.ingredients.length} ingredient{p.ingredients.length > 1 ? "s" : ""} · 0 entered</span>
                            : <span className="text-muted-foreground">None set · add</span>}
                      </button>
                    </td>
                    <td className="px-1.5 py-1 text-right">
                      <span className="inline-flex items-center gap-1">
                        <input inputMode="decimal" value={r.output_qty} onFocus={(e) => e.target.select()}
                          onChange={(e) => set(p.id, { output_qty: e.target.value })} className={cell} aria-label={`${p.name} yield`} />
                        <span className="w-4 text-left text-[11px] text-muted-foreground">{p.unit}</span>
                      </span>
                    </td>
                    <td className="num px-3 py-1.5 text-right text-muted-foreground">
                      {m.litres > 0 && out > 0 ? `${formatNumber((out / m.litres) * 100, 1)} ${p.unit}` : "—"}
                    </td>
                    {LABOUR.map((f) => (
                      <td key={f} className="px-1.5 py-1 text-right">
                        <input inputMode="decimal" value={r[f]} onFocus={(e) => e.target.select()}
                          onChange={(e) => set(p.id, { [f]: e.target.value })} className={cell} aria-label={`${p.name} ${f}`} />
                      </td>
                    ))}
                  </tr>
                );
              })}
              {active.length === 0 ? <Empty colSpan={15 + shared.heads.length}>No products yet - add them below.</Empty> : null}
            </tbody>
            {active.length ? (
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-[12px] text-muted-foreground">{totals.made - totals.incomplete} / {totals.made} complete</td>
                  <td className="num px-3 py-2">{formatNumber(totals.milk, 0)} L</td>
                  <td colSpan={2} />
                  <td className="num px-3 py-2 text-right">{formatNumber(totals.kgFat, 1)}</td>
                  <td className="num px-3 py-2 text-right">{formatNumber(totals.kgSnf, 1)}</td>
                  <td className="num px-3 py-2 text-right">{formatNumber(totals.milkCost, 0)}</td>
                  {shared.heads.map((h) => <td key={h.code} className="num px-3 py-2 text-right" style={{ background: tint(headColor(h.code), 0.06) }}>{formatNumber(totals.milk * h.rate, 0)}</td>)}
                  <td className="num bg-muted/60 px-3 py-2 text-right">{shared.rate !== null ? formatNumber(totals.milk * shared.rate, 0) : "—"}</td>
                  <td colSpan={4} />
                  <td className="num px-3 py-2 text-right text-muted-foreground">{formatNumber(totals.workerHours, 1)} h</td>
                  <td className="num px-3 py-2 text-right">{formatNumber(totals.labour, 0)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </Section>

      <p className="-mt-2 text-[12px] text-muted-foreground">
        <span className="font-semibold text-foreground">Shared costs</span> (tinted columns) = each batch&apos;s litres × each head&apos;s ₹ per litre
        {shared.rate !== null
          ? <> - today {shared.heads.map((h) => `${h.label} ₹${formatNumber(h.amount, 0)}`).join(", ")} ÷ {formatNumber(shared.litres, 0)} L = <span className="num font-semibold text-foreground">₹{formatNumber(shared.rate, 2)} per litre</span> in all.</>
          : <> - nothing entered for this day yet (Electricity, Labour, Fuel, Transport).</>}{" "}
        <Link href={`/daily/dashboard?from=${date}&to=${date}`} className="font-semibold text-foreground underline">How it&apos;s worked out →</Link>
      </p>

      <IngredientsDialog
        product={editingProduct}
        lines={editingProduct ? rows[editingProduct.id].ingredients : []}
        options={ingredients}
        onSave={(lines) => { if (editingProduct) set(editingProduct.id, { ingredients: lines }); setEditing(null); }}
        onClose={() => setEditing(null)}
      />

      <Dialog open={drawingProduct !== null} onOpenChange={(o) => { if (!o) setDrawing(null); }}>
        <DialogContent className="sm:max-w-3xl">
          {drawingProduct ? (
            <MilkBody
              key={drawingProduct.id}
              product={drawingProduct}
              date={date}
              draws={rows[drawingProduct.id].milk}
              tanks={tanks}
              saved={savedMilk(drawingProduct.id)}
              kgPerLitre={kgPerLitre}
              available={(tankId) => available(tankId, { product: drawingProduct.id, index: -1 }) + rows[drawingProduct.id].milk
                .filter((d) => d.tank_id === tankId).reduce((s, d) => s + (val(d.litres) ?? 0), 0)}
              onSave={(draws) => { set(drawingProduct.id, { milk: draws }); setDrawing(null); }}
              onClose={() => setDrawing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="max-w-2xl">
        <Section title="Recent production days">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-[13px]">
              <THead>
                <Th align="left">Date</Th>
                <Th>Products</Th>
                <Th>Complete</Th>
                <Th>Milk L</Th>
                <Th>Worker-h</Th>
                <Th>Labour ₹</Th>
              </THead>
              <tbody>
                {history.map((d) => (
                  <tr key={d.day} className={`border-b border-border/70 hover:bg-muted/60 ${d.day === date ? "bg-muted/60" : ""}`}>
                    <td className="px-3 py-1.5">
                      <Link href={`/daily?date=${d.day}`} className="font-semibold text-foreground hover:underline">{d.day}</Link>
                    </td>
                    <td className="num px-3 py-1.5 text-right" title={d.output.map((o) => `${o.name}: ${formatNumber(o.qty, 1)} ${o.unit}`).join("\n")}>{d.batches}</td>
                    <td className={`num px-3 py-1.5 text-right ${d.complete < d.batches ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {d.complete} / {d.batches}
                    </td>
                    <td className="num px-3 py-1.5 text-right">{formatNumber(d.milk_litre, 0)}</td>
                    <td className="num px-3 py-1.5 text-right">{formatNumber(d.labour_hours, 1)}</td>
                    <td className="num px-3 py-1.5 text-right">{formatNumber(d.labour_cost, 0)}</td>
                  </tr>
                ))}
                {history.length === 0 ? <Empty colSpan={6}>No production saved yet.</Empty> : null}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}

/**
 * The milk one product took from the tanks today: pick a tank and the litres;
 * the fat, SNF, kg and cost follow from that tank's blend. More than one tank
 * can feed the same product - each is its own card.
 */
function MilkBody({
  product, date, draws, tanks, saved, kgPerLitre, available, onSave, onClose,
}: {
  product: BulkProduct;
  date: string;
  draws: Draw[];
  tanks: TankDay[];
  saved: BatchMilk[];
  kgPerLitre: number;
  /** litres a tank can give this product (what the other products are taking already excluded) */
  available: (tankId: string) => number;
  onSave: (draws: Draw[]) => void;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<Draw[]>(() => (draws.length ? draws : [{ tank_id: "", litres: "" }]));
  const update = (i: number, patch: Partial<Draw>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const choosable = tanks.filter((t) => t.is_active || Number(t.close_litre) > 0 || saved.some((s) => s.tank_id === t.tank_id));
  // litres this dialog asks of a tank, other than line i
  const askedElsewhere = (tankId: string, i: number) =>
    lines.reduce((s, l, k) => (k !== i && l.tank_id === tankId ? s + (val(l.litres) ?? 0) : s), 0);
  const total = milkOf(lines, tanks, saved, kgPerLitre);
  const over = lines.some((l, i) => l.tank_id && (val(l.litres) ?? 0) > available(l.tank_id) - askedElsewhere(l.tank_id, i) + 0.05);
  const dash = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "—" : formatNumber(v, d));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(lines.filter((l) => l.tank_id && (val(l.litres) ?? 0) > 0)); }}>
      <DialogHeader>
        <DialogTitle>{product.name} · milk from tanks</DialogTitle>
        <DialogDescription>
          Pick the tank and how many litres went into today&apos;s {product.name}. Fat, SNF and cost come from the tank;
          Save day takes the milk out of it.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[65vh] space-y-3 overflow-auto px-5 py-4">
        {lines.map((l, i) => {
          const litres = val(l.litres) ?? 0;
          const b = l.tank_id ? blendOf(l.tank_id, tanks, saved) : null;
          const left = l.tank_id ? available(l.tank_id) - askedElsewhere(l.tank_id, i) : 0;
          const short = Boolean(l.tank_id) && litres > left + 0.05;
          return (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-48 flex-1">
                  <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Tank</span>
                  <select value={l.tank_id} onChange={(e) => update(i, { tank_id: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-[13px]" aria-label="Tank">
                    <option value="">Choose tank</option>
                    {choosable.map((t) => {
                      const a = available(t.tank_id) - askedElsewhere(t.tank_id, i);
                      return <option key={t.tank_id} value={t.tank_id} disabled={a <= 0 && t.tank_id !== l.tank_id}>
                        {t.name} — {formatNumber(Math.max(a, 0), 0)} L available
                      </option>;
                    })}
                  </select>
                </label>
                <label className="w-36">
                  <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    Litres
                    {l.tank_id && left > 0 ? (
                      <button type="button" onClick={() => update(i, { litres: String(Math.round(left * 10) / 10) })}
                        className="font-semibold hover:text-foreground" title="Take everything left in the tank">Take all</button>
                    ) : null}
                  </span>
                  <input inputMode="decimal" value={l.litres} autoFocus={i === 0} onFocus={(e) => e.target.select()}
                    onChange={(e) => update(i, { litres: e.target.value })}
                    className={`h-9 w-full rounded-lg border bg-white px-2.5 text-right text-[14px] font-semibold focus:outline-none ${short ? "border-destructive" : "border-border focus:border-foreground/40"}`}
                    aria-label="Litres" />
                </label>
                <button type="button" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}
                  className="mb-0.5 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Remove this tank">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {l.tank_id ? (
                <p className={`mt-1.5 text-[11px] ${short ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                  {short ? `Only ${formatNumber(Math.max(left, 0), 1)} L left in this tank on ${date}` : `${formatNumber(Math.max(left, 0), 1)} L in the tank on ${date}`}
                </p>
              ) : null}

              {b ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    { label: "Fat %", value: dash(b.fat) },
                    { label: "SNF %", value: dash(b.snf) },
                    { label: "Kg fat", value: formatNumber(kgOfSolid(litres, b.fat, kgPerLitre) ?? 0, 1) },
                    { label: "Kg SNF", value: formatNumber(kgOfSolid(litres, b.snf, kgPerLitre) ?? 0, 1) },
                    { label: "Rate ₹ / L", value: dash(b.rate) },
                    { label: "Cost ₹", value: formatNumber(litres * (b.rate ?? 0), 0), strong: true },
                  ].map((s) => (
                    <div key={s.label} className="rounded-md bg-muted/60 px-3 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
                      <div className={`num mt-0.5 text-[15px] ${s.strong ? "font-bold" : "font-semibold"} text-foreground`}>{s.value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {choosable.length === 0 ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-[12px] text-muted-foreground">
            No tank holds milk on {date}. Put milk into a tank from <Link href={`/procurement/vamaa/${date}`} className="font-semibold text-foreground underline">Milk in</Link> first.
          </p>
        ) : null}
        <button type="button" onClick={() => setLines((ls) => [...ls, { tank_id: "", litres: "" }])}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Another tank
        </button>

        {total.litres > 0 ? (
          <div className="rounded-lg border border-foreground/15 bg-muted/40 p-4">
            <div className="text-[11px] font-semibold text-muted-foreground">
              Total for {product.name}{lines.filter((l) => l.tank_id).length > 1 ? " · weighted average" : ""}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-7">
              {[
                { label: "Litres", value: formatNumber(total.litres, 1) },
                { label: "Fat %", value: dash(total.fat) },
                { label: "SNF %", value: dash(total.snf) },
                { label: "Kg fat", value: formatNumber(total.kgFat, 1) },
                { label: "Kg SNF", value: formatNumber(total.kgSnf, 1) },
                { label: "Rate ₹ / L", value: formatNumber(total.cost / total.litres, 2) },
                { label: "Cost ₹", value: formatNumber(total.cost, 0) },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
                  <div className="num mt-0.5 text-[16px] font-bold text-foreground">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={over} className="bg-foreground text-background hover:bg-foreground/85">Done</Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Today's ingredient quantities for one product. The product's standing list
 * (set on the product master) is shown in full, each starting at 0; anything
 * else it used today can be added as a one-off line.
 */
function IngredientsDialog({
  product, lines, options, onSave, onClose,
}: {
  product: BulkProduct | null;
  lines: Line[];
  options: IngredientOption[];
  onSave: (lines: Line[]) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={product !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        {product ? <IngredientsBody key={product.id} product={product} saved={lines} options={options} onSave={onSave} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function IngredientsBody({
  product, saved, options, onSave, onClose,
}: {
  product: BulkProduct;
  saved: Line[];
  options: IngredientOption[];
  onSave: (lines: Line[]) => void;
  onClose: () => void;
}) {
  // the standing list first, with today's quantity where one was entered; then today's extras
  const [lines, setLines] = useState<(Line & { standing?: boolean })[]>(() => [
    ...product.ingredients.map((i) => {
      const s = saved.find((l) => l.ingredient_id === i.ingredient_id);
      return { ingredient_id: i.ingredient_id, name: i.name, qty: s?.qty ?? "0", unit: s?.unit ?? i.unit, standing: true };
    }),
    ...saved.filter((l) => !product.ingredients.some((i) => i.ingredient_id === l.ingredient_id)),
  ]);
  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const used = new Set(lines.map((l) => l.ingredient_id).filter(Boolean));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(lines.filter((l) => l.name.trim() && Number(l.qty) > 0).map((l) => ({ ingredient_id: l.ingredient_id, name: l.name, qty: l.qty, unit: l.unit }))); }}>
      <DialogHeader>
        <DialogTitle>{product.name} · ingredients</DialogTitle>
        <DialogDescription>
          Every ingredient on {product.name}&apos;s list needs today&apos;s quantity - the batch is complete only once all are in. Save day afterwards.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-1.5 overflow-auto px-5 py-4">
        {lines.length === 0 ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-[12px] text-muted-foreground">
            No ingredient list set for {product.name} yet. Set one on{" "}
            <Link href="/daily/products" className="font-semibold text-foreground underline">Products &amp; ingredients</Link>,
            or add today&apos;s below.
          </p>
        ) : null}
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            {l.standing ? (
              <span className="flex-1 truncate text-[13px] font-medium text-foreground">{l.name}</span>
            ) : (
              <select
                value={l.ingredient_id ?? (l.custom || l.name ? "__other" : "")}
                onChange={(e) => {
                  const o = options.find((x) => x.id === e.target.value);
                  if (o) update(i, { ingredient_id: o.id, name: o.name, custom: false, unit: o.unit && UNITS.includes(o.unit) ? o.unit : l.unit });
                  else update(i, { ingredient_id: null, custom: e.target.value === "__other", name: e.target.value === "__other" ? l.name : "" });
                }}
                className="h-8 flex-1 rounded-lg border border-border bg-white px-2 text-[13px]"
                aria-label="Ingredient"
              >
                <option value="">Choose ingredient</option>
                {options.filter((o) => o.id === l.ingredient_id || !used.has(o.id)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                <option value="__other">Other (type a name)</option>
              </select>
            )}
            {!l.standing && !l.ingredient_id && (l.custom || l.name) ? (
              <Input value={l.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Name" className="h-8 w-28" />
            ) : null}
            <Input
              inputMode="decimal"
              value={l.qty}
              autoFocus={i === 0}
              onFocus={(e) => e.target.select()}
              onChange={(e) => update(i, { qty: e.target.value })}
              className="h-8 w-24 text-right"
              aria-label={`${l.name || "Ingredient"} quantity`}
            />
            <select value={l.unit} onChange={(e) => update(i, { unit: e.target.value })} className="h-8 w-16 rounded-lg border border-border bg-white px-1.5 text-[13px]" aria-label="Unit">
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {l.standing ? <span className="w-7" /> : (
              <button type="button" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Remove line">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setLines((ls) => [...ls, { ingredient_id: null, name: "", qty: "", unit: "kg" }])}
          className="inline-flex items-center gap-1 pt-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Something else used today
        </button>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" className="bg-foreground text-background hover:bg-foreground/85">Done</Button>
      </DialogFooter>
    </form>
  );
}
