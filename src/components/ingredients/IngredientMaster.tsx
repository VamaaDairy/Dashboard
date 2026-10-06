"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";
import { saveIngredient, setIngredientRate, type MasterKind } from "@/app/c/ingredient/actions";
import { ActionForm, Empty, Field, Section, SubmitButton, Text, THead, Th } from "@/components/tanks/ui";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IngredientRow } from "@/lib/ingredients/data";

/** What changes between the masters this component serves. */
const COPY: Record<MasterKind, {
  title: string; noun: string; plural: string; example: string; rate: string; units: string[]; blurb: string;
}> = {
  ingredient: {
    title: "Ingredients", noun: "ingredient", plural: "ingredients", example: "e.g. Citric Acid", rate: "Rate per unit",
    units: ["kg", "g", "L", "ml", "pcs", "U"], blurb: "Type a rate and press Enter - it saves straight away.",
  },
  packaging: {
    title: "Packaging", noun: "packaging item", plural: "packaging items", example: "e.g. Label", rate: "Rate incl. GST",
    units: ["pc", "kg"], blurb: "Rates include GST. Type a rate and press Enter - it saves straight away.",
  },
};

function UnitSelect({ name, value, onChange, units }: { name?: string; value?: string; onChange?: (v: string) => void; units: string[] }) {
  const UNITS = units;
  const extra = value && !UNITS.includes(value) ? [value] : [];
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[13px]"
      aria-label="Unit"
    >
      {[...UNITS, ...extra].map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

/** The rate box: saves when you press Enter or leave it, and says so. */
function RateInput({ row, kind }: { row: IngredientRow; kind: MasterKind }) {
  const router = useRouter();
  const [value, setValue] = useState(String(Number(row.rate)));
  const [saved, setSaved] = useState(String(Number(row.rate)));
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const commit = () => {
    if (value.trim() === saved.trim()) return;
    start(async () => {
      const res = await setIngredientRate(row.id, value, kind);
      if (!res.ok) { setState("error"); setError(res.error); return; }
      const clean = String(Number(value.replace(/,/g, "") || 0));
      setValue(clean);
      setSaved(clean);
      setError(null);
      setState("saved");
      router.refresh();
      setTimeout(() => setState("idle"), 1500);
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-[12px] text-muted-foreground">₹</span>
      <input
        inputMode="decimal"
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => { setValue(e.target.value); setState("idle"); }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        aria-label={`Rate for ${row.name}`}
        className={`num h-8 w-28 rounded-md border px-2 text-right text-[13px] focus:outline-none ${
          state === "error" ? "border-destructive" : "border-border focus:border-foreground/40"
        } ${pending ? "opacity-60" : ""}`}
      />
      <span className="w-12 text-left text-[11px] text-muted-foreground">/ {row.unit ?? "unit"}</span>
      <span className="w-4">
        {state === "saved" ? <Check className="h-4 w-4 text-foreground" aria-label="Saved" /> : null}
      </span>
      {error ? <span className="sr-only">{error}</span> : null}
    </div>
  );
}

export function IngredientMaster({ ingredients, kind = "ingredient" }: { ingredients: IngredientRow[]; kind?: MasterKind }) {
  const c = COPY[kind];
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<IngredientRow | null>(null);
  const needle = q.trim().toLowerCase();
  const rows = needle ? ingredients.filter((i) => i.name.toLowerCase().includes(needle)) : ingredients;
  const priced = ingredients.filter((i) => Number(i.rate) > 0).length;

  return (
    <>
      <Section
        title={c.title}
        description={`${ingredients.length} ${c.plural} · ${priced} with a rate. ${c.blurb}`}
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${c.plural}`} className="h-8 w-56 pl-8" />
          </div>
        }
      >
        <ActionForm action={saveIngredient} resetOnSuccess className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
          <input type="hidden" name="kind" value={kind} />
          <Field label={`New ${c.noun}`} width="w-64"><Text name="name" placeholder={c.example} required /></Field>
          <Field label="Unit" width="w-24"><UnitSelect name="unit" units={c.units} /></Field>
          <SubmitButton>{`Add ${c.noun}`}</SubmitButton>
        </ActionForm>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <THead>
              <Th align="left">{kind === "packaging" ? "Item" : "Ingredient"}</Th>
              <Th align="left">Unit</Th>
              <Th>{c.rate}</Th>
              <Th />
            </THead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-b border-border/70 hover:bg-muted/60">
                  <td className="px-4 py-2 font-semibold text-foreground">{i.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{i.unit ?? "—"}</td>
                  <td className="px-4 py-1.5"><RateInput key={`${i.id}-${i.rate}`} row={i} kind={kind} /></td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setEditing(i)} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">Edit</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? <Empty colSpan={4}>{needle ? `No ${c.noun} matches “${q}”.` : `No ${c.plural} yet.`}</Empty> : null}
            </tbody>
          </table>
        </div>
      </Section>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          {editing ? <EditIngredient key={editing.id} row={editing} kind={kind} onDone={() => setEditing(null)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditIngredient({ row, kind, onDone }: { row: IngredientRow; kind: MasterKind; onDone: () => void }) {
  const c = COPY[kind];
  const router = useRouter();
  const [name, setName] = useState(row.name);
  const [unit, setUnit] = useState(row.unit ?? c.units[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData();
        form.set("id", row.id);
        form.set("name", name);
        form.set("unit", unit);
        form.set("kind", kind);
        start(async () => {
          const res = await saveIngredient(form);
          if (!res.ok) { setError(res.error); return; }
          router.refresh();
          onDone();
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>{`Edit ${c.noun}`}</DialogTitle>
        <DialogDescription>Its name and the unit its rate is per.</DialogDescription>
      </DialogHeader>
      <div className="flex items-end gap-3 px-5 py-4">
        <label className="flex-1 text-[12px] font-semibold text-muted-foreground">
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9" required />
        </label>
        <label className="w-24 text-[12px] font-semibold text-muted-foreground">
          Unit
          <div className="mt-1"><UnitSelect value={unit} onChange={setUnit} units={c.units} /></div>
        </label>
      </div>
      {error ? <p className="px-5 pb-3 text-[12px] font-semibold text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending} className="bg-foreground text-background hover:bg-foreground/85">
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
