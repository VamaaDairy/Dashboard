"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { saveIngredient } from "@/app/c/ingredient/actions";
import { savePackagingDetail } from "@/app/c/packaging/actions";
import { ActionForm, Empty, Field, Section, SubmitButton, Text, THead, Th } from "@/components/tanks/ui";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import type { PackagingRow } from "@/lib/packaging/data";

const num = (s: string) => {
  const v = Number(s.replace(/,/g, "").trim());
  return s.trim() === "" || !Number.isFinite(v) ? null : v;
};

/** The packaging master: each item's rate and the particulars it is built from. */
export function PackagingMaster({ items }: { items: PackagingRow[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<PackagingRow | null>(null);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort(), [items]);
  const needle = q.trim().toLowerCase();
  const rows = items.filter((i) =>
    (!category || (category === "—" ? !i.category : i.category === category)) &&
    (!needle || [i.name, i.spec, i.supplier, i.category].some((t) => t?.toLowerCase().includes(needle))));
  const noRate = items.filter((i) => i.rate <= 0).length;

  return (
    <>
      <Section
        title="Packing material"
        description={`${items.length} items · ${items.length - noRate} with a rate. Rates include GST and freight. Open an item to see how its rate is built and where it is used.`}
        actions={
          <div className="flex items-center gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 rounded-lg border border-border bg-white px-2 text-[12px]" aria-label="Category">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="—">No category</option>
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search material" className="h-8 w-52 pl-8" />
            </div>
          </div>
        }
      >
        <ActionForm action={saveIngredient} resetOnSuccess className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
          <input type="hidden" name="kind" value="packaging" />
          <Field label="New item" width="w-64"><Text name="name" placeholder="e.g. Sealing wad 63 mm" required /></Field>
          <Field label="Unit" width="w-24">
            <select name="unit" className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[13px]" aria-label="Unit">
              <option value="pc">pc</option><option value="kg">kg</option>
            </select>
          </Field>
          <SubmitButton>Add item</SubmitButton>
        </ActionForm>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <THead>
              <Th align="left">Item</Th>
              <Th align="left">Category</Th>
              <Th align="left">Spec</Th>
              <Th align="left">Supplier</Th>
              <Th>Base</Th>
              <Th>GST</Th>
              <Th>Freight</Th>
              <Th>Rate</Th>
              <Th>Used in</Th>
              <Th />
            </THead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-b border-border/70 hover:bg-muted/60">
                  <td className="px-4 py-2 font-semibold text-foreground">{i.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{i.category ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{i.spec ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{i.supplier ?? "—"}</td>
                  <td className="num px-4 py-2 text-right text-muted-foreground">{i.base_rate === null ? "—" : formatNumber(i.base_rate, 2)}</td>
                  <td className="num px-4 py-2 text-right text-muted-foreground">{i.base_rate === null ? "—" : `${formatNumber(i.gst_pct, 0)}%`}</td>
                  <td className="num px-4 py-2 text-right text-muted-foreground">{i.base_rate === null ? "—" : formatNumber(i.freight, 2)}</td>
                  <td className={`num px-4 py-2 text-right font-semibold ${i.rate > 0 ? "text-foreground" : "text-destructive"}`}>
                    ₹{formatNumber(i.rate, 2)}<span className="text-[11px] font-normal text-muted-foreground"> /{i.unit ?? "unit"}</span>
                  </td>
                  <td className="num px-4 py-2 text-right text-muted-foreground">{i.used_in.length ? `${i.used_in.length} SKU${i.used_in.length > 1 ? "s" : ""}` : "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setEditing(i)} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">Details</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? <Empty colSpan={10}>{needle || category ? "No packing material matches." : "No packing material yet."}</Empty> : null}
            </tbody>
          </table>
        </div>
      </Section>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          {editing ? <EditPackaging key={editing.id} row={editing} categories={categories} onDone={() => setEditing(null)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditPackaging({ row, categories, onDone }: { row: PackagingRow; categories: string[]; onDone: () => void }) {
  const router = useRouter();
  const s = (v: number | null) => (v === null ? "" : String(v));
  const [f, setF] = useState({
    name: row.name, unit: row.unit === "kg" ? "kg" : "pc", category: row.category ?? "", spec: row.spec ?? "", supplier: row.supplier ?? "",
    base_rate: s(row.base_rate), gst_pct: String(row.gst_pct), freight: String(row.freight), rate: String(row.rate), note: row.note ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const base = num(f.base_rate);
  const worked = base === null ? null : base * (1 + (num(f.gst_pct) ?? 0) / 100) + (num(f.freight) ?? 0);
  const label = "mb-1 block text-[11px] font-medium text-muted-foreground";

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const form = new FormData();
      form.set("id", row.id);
      for (const [k, v] of Object.entries(f)) form.set(k, v);
      start(async () => {
        const res = await savePackagingDetail(form);
        if (!res.ok) { setError(res.error); return; }
        router.refresh();
        onDone();
      });
    }}>
      <DialogHeader>
        <DialogTitle>{row.name}</DialogTitle>
        <DialogDescription>Particulars and how the rate is built. Give a base rate and the rate is worked out; leave it blank to type the rate directly.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className={label}>Name</span><Input value={f.name} onChange={set("name")} className="h-9" required /></label>
        <label><span className={label}>Category</span>
          <Input value={f.category} onChange={set("category")} list="pack-cats" placeholder="e.g. Film, Carton" className="h-9" />
          <datalist id="pack-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label><span className={label}>Unit</span>
          <select value={f.unit} onChange={set("unit")} className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[13px]"><option value="pc">per piece</option><option value="kg">per kg</option></select>
        </label>
        <label><span className={label}>Spec</span><Input value={f.spec} onChange={set("spec")} placeholder="e.g. 80 mic, 63 mm" className="h-9" /></label>
        <label><span className={label}>Supplier</span><Input value={f.supplier} onChange={set("supplier")} className="h-9" /></label>
        <label><span className={label}>Base rate (₹ before GST)</span><Input inputMode="decimal" value={f.base_rate} onChange={set("base_rate")} className="h-9 text-right" /></label>
        <label><span className={label}>GST %</span><Input inputMode="decimal" value={f.gst_pct} onChange={set("gst_pct")} className="h-9 text-right" /></label>
        <label><span className={label}>Freight (₹ per unit)</span><Input inputMode="decimal" value={f.freight} onChange={set("freight")} className="h-9 text-right" /></label>
        <label>
          <span className={label}>Rate used (incl. GST + freight)</span>
          {worked !== null
            ? <div className="num flex h-9 items-center justify-end rounded-lg border border-border bg-muted/50 px-2.5 text-[13px] font-semibold">₹{formatNumber(worked, 4)}</div>
            : <Input inputMode="decimal" value={f.rate} onChange={set("rate")} className="h-9 text-right" />}
        </label>
        <label className="sm:col-span-2"><span className={label}>Note</span>
          <textarea value={f.note} onChange={set("note")} rows={2} className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-[13px]" />
        </label>
        <div className="sm:col-span-2">
          <span className={label}>Used in</span>
          <p className="text-[12px] text-foreground">{row.used_in.length ? row.used_in.join(" · ") : "No SKU packing list uses it yet."}</p>
        </div>
        {error ? <p className="text-[12px] font-semibold text-destructive sm:col-span-2">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending} className="bg-foreground text-background hover:bg-foreground/85">{pending ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </form>
  );
}
