"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { saveBulkProduct, saveProductIngredients } from "@/app/daily/bulk-actions";
import { ActionForm, Empty, Field, Section, SubmitButton, Text, THead, Th } from "@/components/tanks/ui";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BulkProduct, IngredientOption } from "@/lib/production/data";

const UNITS = ["kg", "g", "L", "ml", "pcs"];

/** The product master: every product made in bulk, and the ingredients each one is made with. */
export function BulkProductMaster({ products, options }: { products: BulkProduct[]; options: IngredientOption[] }) {
  const [editing, setEditing] = useState<BulkProduct | null>(null);

  return (
    <>
      <Section
        title="Products made in bulk"
        description="Each product's ingredient list is what the daily Production table asks quantities for. Ingredients themselves (names, rates, units) are managed under Rates & masters → Ingredients."
      >
        <ActionForm action={saveBulkProduct} resetOnSuccess className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
          <Field label="New product" width="w-56"><Text name="name" placeholder="e.g. Butter" required /></Field>
          <Field label="Unit" width="w-20">
            <select name="unit" defaultValue="kg" className="w-full rounded-lg border border-border bg-input/30 px-2 py-2 text-[13px]">
              <option value="kg">kg</option><option value="L">L</option>
            </select>
          </Field>
          <input type="hidden" name="is_active" value="on" />
          <SubmitButton>Add product</SubmitButton>
        </ActionForm>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <THead>
              <Th align="left">Product</Th>
              <Th align="left">Unit</Th>
              <Th align="left">Ingredients</Th>
              <Th />
            </THead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={`border-b border-border/70 hover:bg-muted/60 ${p.is_active ? "" : "text-muted-foreground"}`}>
                  <td className="px-3 py-2.5 font-semibold text-foreground">
                    {p.name}
                    {p.is_active ? null : <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">inactive</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.unit}</td>
                  <td className="px-3 py-2">
                    {p.ingredients.length ? (
                      <div className="flex flex-wrap gap-1">
                        {p.ingredients.map((i) => (
                          <span key={i.ingredient_id} className="rounded-md bg-muted px-2 py-0.5 text-[12px] text-foreground">
                            {i.name} <span className="text-muted-foreground">{i.unit}</span>
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-[12px] text-muted-foreground">No ingredients set</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => setEditing(p)} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">Edit</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 ? <Empty colSpan={4}>No products yet - add one above.</Empty> : null}
            </tbody>
          </table>
        </div>
      </Section>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          {editing ? <EditProduct key={editing.id} product={editing} options={options} onDone={() => setEditing(null)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditProduct({ product, options, onDone }: { product: BulkProduct; options: IngredientOption[]; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [unit, setUnit] = useState(product.unit);
  const [active, setActive] = useState(product.is_active);
  const [lines, setLines] = useState(product.ingredients.map((i) => ({ ingredient_id: i.ingredient_id, name: i.name, unit: i.unit })));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const available = options.filter((o) => !lines.some((l) => l.ingredient_id === o.id));

  function save() {
    start(async () => {
      const form = new FormData();
      form.set("id", product.id);
      form.set("name", name);
      form.set("unit", unit);
      if (active) form.set("is_active", "on");
      const a = await saveBulkProduct(form);
      if (!a.ok) { setError(a.error); return; }
      const b = await saveProductIngredients(product.id, lines.map((l) => ({ ingredient_id: l.ingredient_id, unit: l.unit })));
      if (!b.ok) { setError(b.error); return; }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <DialogHeader>
        <DialogTitle>{product.name}</DialogTitle>
        <DialogDescription>Its name and unit, and the ingredients it&apos;s made with. Quantities are entered each day on Production.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 text-[12px] font-semibold text-muted-foreground">
            Name
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9" required />
          </label>
          <label className="text-[12px] font-semibold text-muted-foreground">
            Unit
            <select value={unit} onChange={(e) => setUnit(e.target.value as "kg" | "L")} className="mt-1 block h-9 rounded-lg border border-border bg-white px-2 text-[13px]">
              <option value="kg">kg</option><option value="L">L</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-[12px] font-semibold text-muted-foreground">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
          </label>
        </div>

        <div>
          <div className="mb-1.5 text-[12px] font-semibold text-muted-foreground">Ingredients</div>
          <div className="space-y-1.5">
            {lines.map((l, i) => (
              <div key={l.ingredient_id} className="flex items-center gap-2">
                <span className="flex-1 truncate text-[13px] text-foreground">{l.name}</span>
                <select
                  value={l.unit}
                  onChange={(e) => setLines((ls) => ls.map((x, k) => (k === i ? { ...x, unit: e.target.value } : x)))}
                  className="h-8 w-16 rounded-lg border border-border bg-white px-1.5 text-[13px]"
                  aria-label={`${l.name} unit`}
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <button type="button" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title={`Remove ${l.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {lines.length === 0 ? <p className="text-[12px] text-muted-foreground">None yet.</p> : null}
          </div>
          <select
            value=""
            onChange={(e) => {
              const o = options.find((x) => x.id === e.target.value);
              if (o) setLines((ls) => [...ls, { ingredient_id: o.id, name: o.name, unit: o.unit && UNITS.includes(o.unit) ? o.unit : "kg" }]);
            }}
            className="mt-2 h-8 w-full rounded-lg border border-dashed border-border bg-white px-2 text-[13px] text-muted-foreground"
            aria-label="Add an ingredient"
          >
            <option value="">+ Add an ingredient…</option>
            {available.map((o) => <option key={o.id} value={o.id}>{o.name}{o.unit ? ` (${o.unit})` : ""}</option>)}
          </select>
        </div>
        {error ? <p className="text-[12px] font-semibold text-destructive">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending} className="bg-foreground text-background hover:bg-foreground/85">
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
