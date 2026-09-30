"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import type { Batch, BulkProduct, IngredientOption, ProductionDaySummary } from "@/lib/production/data";

type Line = { ingredient_id: string | null; name: string; qty: string; unit: string; custom?: boolean };
type Row = {
  output_qty: string; milk_litre: string; milk_fat_pct: string; milk_snf_pct: string;
  labour_workers: string; labour_hours: string; labour_cost: string; ingredients: Line[];
};
const NUM_FIELDS = ["milk_litre", "milk_fat_pct", "milk_snf_pct", "output_qty", "labour_workers", "labour_hours", "labour_cost"] as const;
const UNITS = ["kg", "g", "L", "ml", "pcs"];

const str = (n: number | null) => (n === null || n === undefined ? "0" : String(Number(n)));
const val = (s: string) => {
  const v = Number(s.replace(/,/g, "").trim());
  return s.trim() === "" || !Number.isFinite(v) ? null : v;
};

function blankRow(): Row {
  return { output_qty: "0", milk_litre: "0", milk_fat_pct: "0", milk_snf_pct: "0", labour_workers: "0", labour_hours: "0", labour_cost: "0", ingredients: [] };
}

const cell = "w-16 rounded-md border border-border bg-white px-1.5 py-1 text-right text-[13px] focus:border-foreground/40 focus:outline-none";

export function BulkProductionDay({
  date, today, products, batches, ingredients, kgPerLitre, history,
}: {
  date: string;
  today: string;
  products: BulkProduct[];
  batches: Batch[];
  ingredients: IngredientOption[];
  kgPerLitre: number;
  history: ProductionDaySummary[];
}) {
  const router = useRouter();
  const active = products.filter((p) => p.is_active || batches.some((b) => b.bulk_product_id === p.id));
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(active.map((p) => {
      const b = batches.find((x) => x.bulk_product_id === p.id);
      if (!b) return [p.id, blankRow()];
      return [p.id, {
        output_qty: str(b.output_qty), milk_litre: str(b.milk_litre), milk_fat_pct: str(b.milk_fat_pct),
        milk_snf_pct: str(b.milk_snf_pct), labour_workers: str(b.labour_workers), labour_hours: str(b.labour_hours),
        labour_cost: str(b.labour_cost),
        ingredients: b.ingredients.map((i) => ({ ingredient_id: i.ingredient_id, name: i.name, qty: String(Number(i.qty)), unit: i.unit })),
      }];
    })),
  );
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);   // product whose ingredients are open
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (id: string, patch: Partial<Row>) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
    setDirty(true);
    setSavedAt(null);
  };

  const kg = (r: Row, pct: "milk_fat_pct" | "milk_snf_pct") => kgOfSolid(val(r.milk_litre) ?? 0, val(r[pct]), kgPerLitre) ?? 0;
  const totals = useMemo(() => {
    const all = Object.values(rows);
    const sum = (f: (r: Row) => number) => all.reduce((s, r) => s + f(r), 0);
    return {
      milk: sum((r) => val(r.milk_litre) ?? 0),
      kgFat: sum((r) => kg(r, "milk_fat_pct")),
      kgSnf: sum((r) => kg(r, "milk_snf_pct")),
      workerHours: sum((r) => (val(r.labour_workers) ?? 0) * (val(r.labour_hours) ?? 0)),
      labour: sum((r) => val(r.labour_cost) ?? 0),
      made: all.filter((r) => (val(r.output_qty) ?? 0) > 0 || (val(r.milk_litre) ?? 0) > 0).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, kgPerLitre]);

  function save() {
    const payload: DayRow[] = active.map((p) => {
      const r = rows[p.id];
      return {
        bulk_product_id: p.id,
        output_qty: val(r.output_qty), milk_litre: val(r.milk_litre), milk_fat_pct: val(r.milk_fat_pct),
        milk_snf_pct: val(r.milk_snf_pct), labour_workers: val(r.labour_workers), labour_hours: val(r.labour_hours),
        labour_cost: val(r.labour_cost), notes: null,
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
          { label: "Products made", value: `${totals.made}`, unit: `of ${active.length}` },
          { label: "Milk used", value: formatNumber(totals.milk, 0), unit: "L" },
          { label: "Kg fat · kg SNF", value: `${formatNumber(totals.kgFat, 1)} · ${formatNumber(totals.kgSnf, 1)}`, unit: "kg" },
          { label: "Worker-hours", value: formatNumber(totals.workerHours, 1), unit: "h" },
          { label: "Labour", value: `₹${formatNumber(totals.labour, 0)}`, unit: "" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
            <div className="text-[11px] font-medium text-muted-foreground">{s.label}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-[20px] font-bold text-foreground">{s.value}</span>
              <span className="text-[12px] text-muted-foreground">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <Section
        title={`Bulk production · ${date}`}
        description="Every product made in bulk, before packing into sizes. Click a product to enter today's ingredient quantities; fill in milk, output and labour, then Save day - a product left at 0 wasn't made."
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
              <Th>Milk L</Th>
              <Th>Fat %</Th>
              <Th>SNF %</Th>
              <Th>Kg fat</Th>
              <Th>Kg SNF</Th>
              <Th>Output</Th>
              <Th>Per 100 L milk</Th>
              <Th align="left">Ingredients</Th>
              <Th>Workers</Th>
              <Th>Hours</Th>
              <Th>Labour ₹</Th>
            </THead>
            <tbody>
              {active.map((p) => {
                const r = rows[p.id];
                const milk = val(r.milk_litre) ?? 0;
                const out = val(r.output_qty) ?? 0;
                const used = milk > 0 || out > 0 || r.ingredients.length > 0;
                return (
                  <tr key={p.id} className={`border-b border-border/70 ${used ? "" : "text-muted-foreground"}`}>
                    <td className="px-3 py-1.5">
                      <button onClick={() => setEditing(p.id)} className="text-left font-semibold text-foreground hover:underline" title={`Ingredients for ${p.name}`}>
                        {p.name}
                      </button>
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">{p.unit}</span>
                    </td>
                    {NUM_FIELDS.slice(0, 3).map((f) => (
                      <td key={f} className="px-1.5 py-1 text-right">
                        <input inputMode="decimal" value={r[f]} onFocus={(e) => e.target.select()}
                          onChange={(e) => set(p.id, { [f]: e.target.value })} className={cell} aria-label={`${p.name} ${f}`} />
                      </td>
                    ))}
                    <td className="num px-3 py-1.5 text-right">{formatNumber(kg(r, "milk_fat_pct"), 1)}</td>
                    <td className="num px-3 py-1.5 text-right">{formatNumber(kg(r, "milk_snf_pct"), 1)}</td>
                    <td className="px-1.5 py-1 text-right">
                      <span className="inline-flex items-center gap-1">
                        <input inputMode="decimal" value={r.output_qty} onFocus={(e) => e.target.select()}
                          onChange={(e) => set(p.id, { output_qty: e.target.value })} className={cell} aria-label={`${p.name} output`} />
                        <span className="w-4 text-left text-[11px] text-muted-foreground">{p.unit}</span>
                      </span>
                    </td>
                    <td className="num px-3 py-1.5 text-right text-muted-foreground">
                      {milk > 0 && out > 0 ? `${formatNumber((out / milk) * 100, 1)} ${p.unit}` : "—"}
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
                    {NUM_FIELDS.slice(4).map((f) => (
                      <td key={f} className="px-1.5 py-1 text-right">
                        <input inputMode="decimal" value={r[f]} onFocus={(e) => e.target.select()}
                          onChange={(e) => set(p.id, { [f]: e.target.value })} className={cell} aria-label={`${p.name} ${f}`} />
                      </td>
                    ))}
                  </tr>
                );
              })}
              {active.length === 0 ? <Empty colSpan={12}>No products yet - add them below.</Empty> : null}
            </tbody>
            {active.length ? (
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="num px-3 py-2 text-right">{formatNumber(totals.milk, 0)}</td>
                  <td colSpan={2} />
                  <td className="num px-3 py-2 text-right">{formatNumber(totals.kgFat, 1)}</td>
                  <td className="num px-3 py-2 text-right">{formatNumber(totals.kgSnf, 1)}</td>
                  <td colSpan={4} />
                  <td className="num px-3 py-2 text-right text-muted-foreground">{formatNumber(totals.workerHours, 1)} h</td>
                  <td className="num px-3 py-2 text-right">{formatNumber(totals.labour, 0)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </Section>

      <IngredientsDialog
        product={editingProduct}
        lines={editingProduct ? rows[editingProduct.id].ingredients : []}
        options={ingredients}
        onSave={(lines) => { if (editingProduct) set(editingProduct.id, { ingredients: lines }); setEditing(null); }}
        onClose={() => setEditing(null)}
      />

      <div className="max-w-2xl">
        <Section title="Recent production days">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-[13px]">
              <THead>
                <Th align="left">Date</Th>
                <Th>Products</Th>
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
                    <td className="num px-3 py-1.5 text-right">{formatNumber(d.milk_litre, 0)}</td>
                    <td className="num px-3 py-1.5 text-right">{formatNumber(d.labour_hours, 1)}</td>
                    <td className="num px-3 py-1.5 text-right">{formatNumber(d.labour_cost, 0)}</td>
                  </tr>
                ))}
                {history.length === 0 ? <Empty colSpan={5}>No production saved yet.</Empty> : null}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
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
          How much of each went into today&apos;s {product.name}. Leave 0 for anything not used. Save day afterwards.
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
