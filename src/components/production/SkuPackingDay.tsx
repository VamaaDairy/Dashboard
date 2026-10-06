"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Package, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { saveSku, saveSkuDay, type MaterialLine } from "@/app/daily/sku-actions";
import { Empty, Section, THead, Th } from "@/components/tanks/ui";
import { DateBar } from "@/components/tanks/TankDayBoard";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import type { BulkProduct } from "@/lib/production/data";
import type { BulkYield, PackMaterial, PackagingOption, SkuDayRow, SkuHistoryDay } from "@/lib/production/sku";

type Entry = { cases: string; loose_pcs: string };
type MLine = MaterialLine & { custom?: boolean };
const toLine = (m: PackMaterial): MLine => ({ packaging_id: m.packaging_id, name: m.name, qty: String(Number(m.qty)), unit: m.unit, price: String(Number(m.price)) });
const lineAmount = (l: MLine) => val(l.qty) * val(l.price);
const materialCost = (ls: MLine[]) => ls.reduce((t, l) => t + lineAmount(l), 0);

const val = (s: string) => {
  const v = Number(s.replace(/,/g, "").trim());
  return s.trim() === "" || !Number.isFinite(v) ? 0 : v;
};
const cell = "w-20 rounded-md border border-border bg-white px-1.5 py-1 text-right text-[13px] focus:border-foreground/40 focus:outline-none disabled:bg-muted/50 disabled:text-tertiary-foreground";

export function SkuPackingDay({
  date, today, skus, bulkProducts, yields, history, materials, lastMaterials, packaging,
}: {
  date: string;
  today: string;
  skus: SkuDayRow[];
  bulkProducts: BulkProduct[];
  yields: BulkYield[];
  history: SkuHistoryDay[];
  materials: Record<string, PackMaterial[]>;
  lastMaterials: Record<string, { day: string; lines: PackMaterial[] }>;
  packaging: PackagingOption[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(skus.map((s) => [s.sku_id, { cases: String(Number(s.cases)), loose_pcs: String(Number(s.loose_pcs)) }])));
  const [mats, setMats] = useState<Record<string, MLine[]>>(() =>
    Object.fromEntries(skus.map((s) => [s.sku_id, (materials[s.sku_id] ?? []).map(toLine)])));
  const [packing, setPacking] = useState<SkuDayRow | null>(null);   // SKU whose packing material is open
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [setup, setSetup] = useState<SkuDayRow | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (id: string, patch: Partial<Entry>) => {
    setEntries((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
    setDirty(true);
    setSavedAt(null);
  };

  const pcsOf = (s: SkuDayRow) => val(entries[s.sku_id].cases) * s.pcs_per_case + val(entries[s.sku_id].loose_pcs);
  const bulkOf = (s: SkuDayRow) => (s.bulk_qty_per_pc === null ? null : pcsOf(s) * Number(s.bulk_qty_per_pc));
  const productById = useMemo(() => new Map(bulkProducts.map((p) => [p.id, p])), [bulkProducts]);
  const categories = useMemo(() => ["All", ...new Set(skus.map((s) => s.category))], [skus]);

  const shown = skus.filter((s) =>
    (category === "All" || s.category === category)
    && (!filter.trim() || `${s.code} ${s.name}`.toLowerCase().includes(filter.trim().toLowerCase())));
  const groups = categories.slice(1)
    .map((c) => ({ category: c, rows: shown.filter((s) => s.category === c) }))
    .filter((g) => g.rows.length);

  const totals = useMemo(() => {
    const packed = skus.filter((s) => pcsOf(s) > 0);
    return {
      packed: packed.length,
      pcs: packed.reduce((t, s) => t + pcsOf(s), 0),
      cases: packed.reduce((t, s) => t + val(entries[s.sku_id].cases), 0),
      material: skus.reduce((t, s) => t + materialCost(mats[s.sku_id]), 0),
      noMaterial: packed.filter((s) => mats[s.sku_id].length === 0).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, mats, skus]);

  // packed against yield, per bulk product: what the SKUs took (in the bulk unit) vs what the batch gave
  const reconcile = useMemo(() => {
    const byProduct = new Map<string, { packed: number; skus: number }>();
    let unlinked = 0;
    for (const s of skus) {
      if (pcsOf(s) <= 0) continue;
      const b = bulkOf(s);
      if (!s.bulk_product_id || b === null) { unlinked += 1; continue; }
      const r = byProduct.get(s.bulk_product_id) ?? { packed: 0, skus: 0 };
      r.packed += b;
      r.skus += 1;
      byProduct.set(s.bulk_product_id, r);
    }
    const ids = new Set([...yields.map((y) => y.bulk_product_id), ...byProduct.keys()]);
    const lines = bulkProducts.filter((p) => ids.has(p.id)).map((p) => {
      const y = yields.find((x) => x.bulk_product_id === p.id);
      const r = byProduct.get(p.id);
      const yieldQty = y?.output_qty == null ? null : Number(y.output_qty);
      return { id: p.id, name: p.name, unit: p.unit, yieldQty, batch: Boolean(y), packed: r?.packed ?? 0, skus: r?.skus ?? 0 };
    });
    return { lines, unlinked };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, skus, yields, bulkProducts]);

  function save() {
    start(async () => {
      const res = await saveSkuDay(date, skus.map((s) => ({
        sku_id: s.sku_id, ...entries[s.sku_id],
        materials: mats[s.sku_id].map(({ packaging_id, name, qty, unit, price }) => ({ packaging_id, name, qty, unit, price })),
      })));
      if (!res.ok) { setError(res.error); return; }
      setError(null);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString("en-IN"));
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateBar date={date} today={today} basePath="/daily/sku" />
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted-foreground">
            {error ? <span className="font-semibold text-destructive">{error}</span>
              : savedAt ? `Saved at ${savedAt}` : dirty ? "Unsaved changes" : skus.some((s) => s.saved) ? "Saved" : "Nothing packed for this day yet"}
          </span>
          <Button onClick={save} disabled={pending || !dirty} className="bg-foreground text-background hover:bg-foreground/85">
            {pending ? "Saving…" : "Save day"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "SKUs packed", value: `${totals.packed}`, unit: `of ${skus.length}` },
          { label: "Cases", value: formatNumber(totals.cases, 0), unit: "" },
          { label: "Pieces", value: formatNumber(totals.pcs, 0), unit: "pcs" },
          { label: "Packing material", value: `₹${formatNumber(totals.material, 0)}`, unit: totals.noMaterial ? `${totals.noMaterial} SKU${totals.noMaterial > 1 ? "s" : ""} without` : "" },
          { label: "Bulk batches today", value: `${yields.length}`, unit: yields.length ? `${yields.filter((y) => y.output_qty !== null && Number(y.output_qty) > 0).length} with yield` : "" },
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
        title={`SKU packing · ${date}`}
        description="Every SKU, by category. Enter full cases and any loose pieces packed today, and the packing material used - item, quantity, per kg or per piece, and price. A SKU left at 0 wasn't packed. Save day when done."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find SKU or code"
                className="h-8 w-44 rounded-lg border border-border bg-white pr-2 pl-7 text-[12px] focus:border-foreground/40 focus:outline-none" />
            </div>
          </div>
        }
      >
        <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5">
          {categories.map((c) => {
            const n = c === "All" ? skus.length : skus.filter((s) => s.category === c).length;
            return (
              <button key={c} onClick={() => setCategory(c)}
                className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${category === c ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {c} <span className="font-normal opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead>
              <Th align="left">Code</Th>
              <Th align="left">SKU</Th>
              <Th align="left">Case</Th>
              <Th>Cases</Th>
              <Th>Loose pcs</Th>
              <Th>Total pcs</Th>
              <Th>Bulk used</Th>
              <Th align="left">From bulk</Th>
              <Th align="left">Packing material</Th>
              <Th>Material ₹</Th>
              <Th />
            </THead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g.category} category={g.category} rows={g.rows}>
                  {g.rows.map((s) => {
                    const e = entries[s.sku_id];
                    const pcs = pcsOf(s);
                    const bulk = bulkOf(s);
                    const product = s.bulk_product_id ? productById.get(s.bulk_product_id) : undefined;
                    const single = s.pcs_per_case === 1;
                    return (
                      <tr key={s.sku_id} className={`border-b border-border/70 hover:bg-muted/40 ${pcs > 0 ? "" : "text-muted-foreground"}`}>
                        <td className="num px-3 py-1.5 text-[12px]">{s.code}</td>
                        <td className="max-w-80 truncate px-3 py-1.5 font-semibold text-foreground" title={s.name}>{s.name}</td>
                        <td className="px-3 py-1.5 text-[12px]">
                          {single ? s.case_unit : `${s.case_unit} · ${s.pcs_per_case} pcs`}
                        </td>
                        <td className="px-1.5 py-1 text-right">
                          <input inputMode="decimal" value={e.cases} onFocus={(ev) => ev.target.select()}
                            onChange={(ev) => set(s.sku_id, { cases: ev.target.value })} className={cell} aria-label={`${s.name} cases`} />
                        </td>
                        <td className="px-1.5 py-1 text-right">
                          <input inputMode="decimal" value={single ? "—" : e.loose_pcs} disabled={single} onFocus={(ev) => ev.target.select()}
                            onChange={(ev) => set(s.sku_id, { loose_pcs: ev.target.value })} className={cell}
                            title={single ? "Counted one piece at a time - enter it under Cases" : undefined} aria-label={`${s.name} loose pieces`} />
                        </td>
                        <td className="num px-3 py-1.5 text-right font-semibold text-foreground">{pcs > 0 ? formatNumber(pcs, 0) : "—"}</td>
                        <td className="num px-3 py-1.5 text-right">
                          {bulk !== null && pcs > 0 ? `${formatNumber(bulk, 1)} ${product?.unit ?? ""}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-[12px]">
                          {product ? product.name : (
                            <button onClick={() => setSetup(s)} className="font-semibold text-foreground underline decoration-dashed underline-offset-2">
                              Not linked · set
                            </button>
                          )}
                        </td>
                        <td className="max-w-60 px-3 py-1.5">
                          <button onClick={() => setPacking(s)}
                            className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-border px-2 py-1 text-left text-[12px] hover:bg-muted"
                            title={mats[s.sku_id].map((l) => `${l.name} ${l.qty} ${l.unit} @ ₹${l.price}`).join("\n") || "Add packing material"}>
                            <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {mats[s.sku_id].length
                              ? <span className="truncate font-semibold text-foreground">{mats[s.sku_id].map((l) => `${l.name} ${formatNumber(val(l.qty), l.unit === "kg" ? 2 : 0)} ${l.unit}`).join(" · ")}</span>
                              : <span className="text-muted-foreground">{pcs > 0 ? "Add items" : "None"}</span>}
                          </button>
                        </td>
                        <td className="num px-3 py-1.5 text-right">{mats[s.sku_id].length ? formatNumber(materialCost(mats[s.sku_id]), 0) : "—"}</td>
                        <td className="px-2 py-1 text-right">
                          <button onClick={() => setSetup(s)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title={`Set up ${s.name}`}>
                            <Settings2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </GroupRows>
              ))}
              {groups.length === 0 ? <Empty colSpan={11}>No SKU matches.</Empty> : null}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-semibold">
                <td className="px-3 py-2" colSpan={3}>Total · {totals.packed} SKUs packed</td>
                <td className="num px-3 py-2 text-right">{formatNumber(totals.cases, 0)}</td>
                <td />
                <td className="num px-3 py-2 text-right">{formatNumber(totals.pcs, 0)}</td>
                <td colSpan={3} />
                <td className="num px-3 py-2 text-right">{formatNumber(totals.material, 0)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Section
          title="Packed against yield"
          description="What the SKUs took out of each bulk product today, against the batch's yield on Daily batches."
        >
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-[13px]">
              <THead>
                <Th align="left">Bulk product</Th>
                <Th>Yield</Th>
                <Th>Packed</Th>
                <Th>Left unpacked</Th>
                <Th>SKUs</Th>
              </THead>
              <tbody>
                {reconcile.lines.map((l) => {
                  const left = l.yieldQty === null ? null : l.yieldQty - l.packed;
                  return (
                    <tr key={l.id} className="border-b border-border/70">
                      <td className="px-3 py-1.5 font-semibold text-foreground">{l.name}</td>
                      <td className="num px-3 py-1.5 text-right">
                        {l.yieldQty !== null && l.yieldQty > 0 ? `${formatNumber(l.yieldQty, 1)} ${l.unit}`
                          : <Link href={`/daily?date=${date}`} className="text-[12px] text-muted-foreground underline">{l.batch ? "Yield not entered" : "No batch"}</Link>}
                      </td>
                      <td className="num px-3 py-1.5 text-right">{formatNumber(l.packed, 1)} {l.unit}</td>
                      <td className={`num px-3 py-1.5 text-right ${left !== null && left < -0.05 ? "font-semibold text-destructive" : ""}`}>
                        {left === null || !l.yieldQty ? "—" : left < -0.05 ? `${formatNumber(-left, 1)} ${l.unit} over` : `${formatNumber(left, 1)} ${l.unit}`}
                      </td>
                      <td className="num px-3 py-1.5 text-right text-muted-foreground">{l.skus}</td>
                    </tr>
                  );
                })}
                {reconcile.lines.length === 0 ? <Empty colSpan={5}>No batch or packing for this day yet.</Empty> : null}
              </tbody>
            </table>
          </div>
          {reconcile.unlinked ? (
            <p className="border-t border-border px-4 py-2 text-[12px] text-muted-foreground">
              {reconcile.unlinked} packed SKU{reconcile.unlinked > 1 ? "s aren't" : " isn't"} linked to a bulk product, so {reconcile.unlinked > 1 ? "they're" : "it's"} not counted above.
            </p>
          ) : null}
        </Section>

        <Section title="Recent packing days">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-[13px]">
              <THead>
                <Th align="left">Date</Th>
                <Th>SKUs</Th>
                <Th>Pieces</Th>
                <Th>Material ₹</Th>
              </THead>
              <tbody>
                {history.map((d) => (
                  <tr key={d.day} className={`border-b border-border/70 hover:bg-muted/60 ${d.day === date ? "bg-muted/60" : ""}`}>
                    <td className="px-3 py-1.5">
                      <Link href={`/daily/sku?date=${d.day}`} className="font-semibold text-foreground hover:underline">{d.day}</Link>
                    </td>
                    <td className="num px-3 py-1.5 text-right">{d.skus}</td>
                    <td className="num px-3 py-1.5 text-right">{formatNumber(Number(d.pcs), 0)}</td>
                    <td className="num px-3 py-1.5 text-right">{Number(d.material) ? formatNumber(Number(d.material), 0) : "—"}</td>
                  </tr>
                ))}
                {history.length === 0 ? <Empty colSpan={4}>No packing saved yet.</Empty> : null}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Dialog open={packing !== null} onOpenChange={(o) => { if (!o) setPacking(null); }}>
        <DialogContent className="sm:max-w-3xl">
          {packing ? (
            <MaterialBody
              key={packing.sku_id}
              sku={packing}
              pcs={pcsOf(packing)}
              lines={mats[packing.sku_id]}
              last={lastMaterials[packing.sku_id] ?? null}
              packaging={packaging}
              onSave={(lines) => {
                setMats((m) => ({ ...m, [packing.sku_id]: lines }));
                setDirty(true);
                setSavedAt(null);
                setPacking(null);
              }}
              onClose={() => setPacking(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={setup !== null} onOpenChange={(o) => { if (!o) setSetup(null); }}>
        <DialogContent className="sm:max-w-lg">
          {setup ? <SkuSetup key={setup.sku_id} sku={setup} bulkProducts={bulkProducts} onDone={() => { setSetup(null); router.refresh(); }} onClose={() => setSetup(null)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A category's heading row, then its SKUs. */
function GroupRows({ category, rows, children }: { category: string; rows: SkuDayRow[]; children: React.ReactNode }) {
  return (
    <>
      <tr className="bg-muted/40">
        <td colSpan={11} className="px-3 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {category} <span className="font-normal normal-case tracking-normal">· {rows.length} SKU{rows.length > 1 ? "s" : ""}</span>
        </td>
      </tr>
      {children}
    </>
  );
}

/** One SKU's setup: case size, the bulk product it is filled from, and how much one piece holds. */
function SkuSetup({
  sku, bulkProducts, onDone, onClose,
}: {
  sku: SkuDayRow;
  bulkProducts: BulkProduct[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [pcs, setPcs] = useState(String(sku.pcs_per_case));
  const [bulk, setBulk] = useState(sku.bulk_product_id ?? "");
  const [perPc, setPerPc] = useState(sku.bulk_qty_per_pc === null ? "" : String(Number(sku.bulk_qty_per_pc)));
  const [active, setActive] = useState(sku.is_active);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const unit = bulkProducts.find((p) => p.id === bulk)?.unit ?? "kg / L";
  const label = "mb-1 block text-[11px] font-medium text-muted-foreground";

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const res = await saveSku(sku.sku_id, { pcs_per_case: pcs, bulk_product_id: bulk, bulk_qty_per_pc: perPc, is_active: active });
        if (!res.ok) { setError(res.error); return; }
        onDone();
      });
    }}>
      <DialogHeader>
        <DialogTitle>{sku.name}</DialogTitle>
        <DialogDescription>SKU {sku.code} · {sku.category}{sku.shelf_life_days ? ` · shelf life ${sku.shelf_life_days} days` : ""}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <label>
          <span className={label}>Pieces per {sku.case_unit}</span>
          <Input inputMode="numeric" value={pcs} onChange={(e) => setPcs(e.target.value)} className="h-9" />
        </label>
        <label>
          <span className={label}>Filled from bulk product</span>
          <select value={bulk} onChange={(e) => setBulk(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-[13px]">
            <option value="">Not linked</option>
            {bulkProducts.filter((p) => p.is_active || p.id === bulk).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={label}>Bulk product in one piece ({unit})</span>
          <Input inputMode="decimal" value={perPc} onChange={(e) => setPerPc(e.target.value)} placeholder="e.g. 0.5" className="h-9 sm:w-40" />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            How much of the bulk product goes into one piece - 0.5 for a 500 ml pouch of milk, 0.2 for a 200 g cup.
          </span>
        </label>
        <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          On the packing list
        </label>
        {error ? <p className="text-[12px] font-semibold text-destructive sm:col-span-2">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending} className="bg-foreground text-background hover:bg-foreground/85">{pending ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </form>
  );
}

/**
 * The packing material one SKU used today: each item, how much, whether it is
 * counted per kg or per piece, and its price per that unit. Items come from the
 * Packaging master (with the last price used) or are typed in.
 */
function MaterialBody({
  sku, pcs, lines: saved, last, packaging, onSave, onClose,
}: {
  sku: SkuDayRow;
  pcs: number;
  lines: MLine[];
  last: { day: string; lines: PackMaterial[] } | null;
  packaging: PackagingOption[];
  onSave: (lines: MLine[]) => void;
  onClose: () => void;
}) {
  const blank = (): MLine => ({ packaging_id: null, name: "", qty: "", unit: "pcs", price: "" });
  const [lines, setLines] = useState<MLine[]>(() => (saved.length ? saved : [blank()]));
  const update = (i: number, patch: Partial<MLine>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const used = new Set(lines.map((l) => l.packaging_id).filter(Boolean));
  const total = materialCost(lines);
  const label = "mb-1 block text-[11px] font-medium text-muted-foreground";
  const field = "h-9 w-full rounded-lg border border-border bg-white px-2.5 text-[13px] focus:border-foreground/40 focus:outline-none";
  const keep = lines.filter((l) => l.name.trim() || val(l.qty) > 0);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(keep); }}>
      <DialogHeader>
        <DialogTitle>{sku.name} · packing material</DialogTitle>
        <DialogDescription>
          What went into packing today&apos;s {sku.name}{pcs > 0 ? ` (${formatNumber(pcs, 0)} pcs)` : ""}: each item, the quantity,
          whether it&apos;s counted per kg or per piece, and the price. Save day afterwards.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[65vh] space-y-3 overflow-auto px-5 py-4">
        {last && saved.length === 0 ? (
          <button type="button"
            onClick={() => setLines(last.lines.map(toLine))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
            <Copy className="h-3.5 w-3.5" /> Same as {last.day} · {last.lines.map((l) => l.name).join(", ")}
          </button>
        ) : null}

        {lines.map((l, i) => {
          const custom = !l.packaging_id && (l.custom || Boolean(l.name));
          return (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <div>
                  <span className={label}>Item</span>
                  <select
                    value={l.packaging_id ?? (custom ? "__other" : "")}
                    onChange={(e) => {
                      const o = packaging.find((x) => x.id === e.target.value);
                      if (o) {
                        update(i, {
                          packaging_id: o.id, name: o.name, custom: false, unit: o.unit,
                          price: l.price || (o.last_price === null ? "" : String(Number(o.last_price))),
                        });
                      } else {
                        update(i, { packaging_id: null, custom: e.target.value === "__other", name: "" });
                      }
                    }}
                    className={field} aria-label="Item">
                    <option value="">Choose item</option>
                    {packaging.filter((o) => o.id === l.packaging_id || !used.has(o.id)).map((o) => (
                      <option key={o.id} value={o.id}>{o.name} (per {o.unit === "kg" ? "kg" : "piece"})</option>
                    ))}
                    <option value="__other">Other - type a name</option>
                  </select>
                  {custom ? (
                    <Input value={l.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Item name, e.g. Label" className="mt-2 h-9" autoFocus />
                  ) : null}
                </div>
                <label>
                  <span className={label}>Unit</span>
                  <div className="flex h-9 overflow-hidden rounded-lg border border-border text-[12px] font-semibold">
                    {(["pcs", "kg"] as const).map((u) => (
                      <button key={u} type="button" onClick={() => update(i, { unit: u })}
                        className={`flex-1 ${l.unit === u ? "bg-foreground text-background" : "bg-white text-muted-foreground hover:text-foreground"}`}>
                        {u === "kg" ? "Per kg" : "Per piece"}
                      </button>
                    ))}
                  </div>
                </label>
                <label>
                  <span className={label}>Quantity ({l.unit === "kg" ? "kg" : "pcs"})</span>
                  <input inputMode="decimal" value={l.qty} onFocus={(e) => e.target.select()} onChange={(e) => update(i, { qty: e.target.value })}
                    placeholder={l.unit === "pcs" && pcs > 0 ? String(pcs) : "0"} className={`${field} text-right`} aria-label="Quantity" />
                </label>
                <label>
                  <span className={label}>Price ₹ / {l.unit === "kg" ? "kg" : "piece"}</span>
                  <input inputMode="decimal" value={l.price} onFocus={(e) => e.target.select()} onChange={(e) => update(i, { price: e.target.value })}
                    placeholder="0.00" className={`${field} text-right`} aria-label="Price" />
                </label>
                <button type="button" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}
                  className="justify-self-end rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Remove item">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-muted/60 px-3 py-2">
                <span className="text-[12px] text-muted-foreground">
                  {formatNumber(val(l.qty), l.unit === "kg" ? 3 : 0)} {l.unit === "kg" ? "kg" : "pcs"} × ₹{formatNumber(val(l.price), 2)}
                  {pcs > 0 && lineAmount(l) > 0 ? ` · ₹${formatNumber(lineAmount(l) / pcs, 3)} per SKU piece` : ""}
                </span>
                <span className="num text-[15px] font-bold text-foreground">₹{formatNumber(lineAmount(l), 2)}</span>
              </div>
            </div>
          );
        })}

        <button type="button" onClick={() => setLines((ls) => [...ls, blank()])}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Another item
        </button>

        {keep.length ? (
          <div className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-foreground/15 bg-muted/40 px-4 py-3">
            <span className="text-[12px] font-semibold text-muted-foreground">
              Total packing material · {keep.length} item{keep.length > 1 ? "s" : ""}
              {pcs > 0 ? ` · ₹${formatNumber(total / pcs, 3)} per piece of ${sku.name}` : ""}
            </span>
            <span className="num text-[18px] font-bold text-foreground">₹{formatNumber(total, 2)}</span>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" className="bg-foreground text-background hover:bg-foreground/85">Done</Button>
      </DialogFooter>
    </form>
  );
}
