"use client";

import { useState, useTransition } from "react";
import {
  addCategoryAction, addItemAction, addMovementAction, addSubcategoryAction, deleteGroupAction,
  deleteMovementAction, renameAction, setItemAction,
} from "@/lib/store/actions";

const box = "h-9 rounded-lg border border-input bg-transparent px-3 text-sm";
const btn = "h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60";
const small = "h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted disabled:opacity-60";
const wrap = "flex flex-wrap items-end gap-2 rounded-lg border border-border p-3";

type Res = { ok: boolean; error?: string };

/** Runs an action, shows its error beside the form, and clears the form when it worked. */
function useRun() {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) { setError(""); onOk?.(); } else setError(r.error ?? "Could not save.");
    });
  return { error, pending, run };
}

export interface CategoryOpt { id: number; name: string }
export interface SubcategoryOpt { id: number; category_id: number; name: string }
export interface ItemOpt { id: number; name: string; unit: string; category: string; subcategory: string | null; stock: number }

export function AddCategoryForm() {
  const [name, setName] = useState("");
  const { error, pending, run } = useRun();
  return (
    <form className={wrap} onSubmit={(e) => { e.preventDefault(); run(() => addCategoryAction(name), () => setName("")); }}>
      <label className="text-xs text-muted-foreground">New category<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spares" className={`${box} mt-1 block w-48`} /></label>
      <button disabled={pending} className={btn}>Add category</button>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </form>
  );
}

export function AddSubcategoryForm({ categories }: { categories: CategoryOpt[] }) {
  const [cat, setCat] = useState("");
  const [name, setName] = useState("");
  const { error, pending, run } = useRun();
  return (
    <form className={wrap} onSubmit={(e) => { e.preventDefault(); run(() => addSubcategoryAction(Number(cat), name), () => setName("")); }}>
      <label className="text-xs text-muted-foreground">Under category
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${box} mt-1 block w-48`}>
          <option value="">Choose…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">New subcategory<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bearings" className={`${box} mt-1 block w-48`} /></label>
      <button disabled={pending} className={btn}>Add subcategory</button>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </form>
  );
}

export function AddItemForm({ categories, subcategories, units }: { categories: CategoryOpt[]; subcategories: SubcategoryOpt[]; units: readonly string[] }) {
  const [name, setName] = useState("");
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [min, setMin] = useState("0");
  const [notes, setNotes] = useState("");
  const { error, pending, run } = useRun();
  const subs = subcategories.filter((s) => String(s.category_id) === cat);
  return (
    <form
      className={wrap}
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addItemAction({ name, categoryId: Number(cat), subcategoryId: sub ? Number(sub) : null, unit, minStock: Number(min || 0), notes }),
          () => { setName(""); setNotes(""); setMin("0"); },
        );
      }}
    >
      <label className="text-xs text-muted-foreground">Item name<input value={name} onChange={(e) => setName(e.target.value)} className={`${box} mt-1 block w-56`} /></label>
      <label className="text-xs text-muted-foreground">Category
        <select value={cat} onChange={(e) => { setCat(e.target.value); setSub(""); }} className={`${box} mt-1 block w-44`}>
          <option value="">Choose…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">Subcategory
        <select value={sub} onChange={(e) => setSub(e.target.value)} disabled={!subs.length} className={`${box} mt-1 block w-44`}>
          <option value="">{subs.length ? "None" : "—"}</option>
          {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">Unit
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className={`${box} mt-1 block w-28`}>
          {units.map((u) => <option key={u}>{u}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">Low-stock level<input value={min} inputMode="decimal" onChange={(e) => setMin(e.target.value)} className={`${box} num mt-1 block w-28`} /></label>
      <label className="text-xs text-muted-foreground">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${box} mt-1 block w-48`} /></label>
      <button disabled={pending} className={btn}>Add item</button>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </form>
  );
}

/** Rename / remove a category or subcategory. */
export function GroupActions({ kind, id, name, items }: { kind: "category" | "subcategory"; id: number; name: string; items: number }) {
  const { pending, run } = useRun();
  const alertErr = (fn: () => Promise<Res>) => run(async () => { const r = await fn(); if (!r.ok && r.error) window.alert(r.error); return r; });
  return (
    <span className="ml-2 inline-flex gap-1 align-middle">
      <button disabled={pending} className="text-xs text-muted-foreground underline hover:text-foreground"
        onClick={() => { const v = window.prompt(`Rename ${kind}`, name); if (v && v.trim() !== name) alertErr(() => renameAction(kind, id, v)); }}>Rename</button>
      {items === 0 ? (
        <button disabled={pending} className="text-xs text-red-600 underline"
          onClick={() => { if (window.confirm(`Remove ${kind} "${name}"?`)) alertErr(() => deleteGroupAction(kind, id)); }}>Remove</button>
      ) : null}
    </span>
  );
}

export function ItemActions({ id, active, minStock }: { id: number; active: boolean; minStock: number }) {
  const { pending, run } = useRun();
  const go = (patch: { active?: boolean; minStock?: number }) => run(async () => { const r = await setItemAction(id, patch); if (!r.ok && r.error) window.alert(r.error); return r; });
  return (
    <div className="flex gap-2">
      <button disabled={pending} className={small} onClick={() => { const v = window.prompt("Low-stock level (flagged at or below this)", String(minStock)); if (v !== null && v.trim() !== "") go({ minStock: Number(v) }); }}>Low level</button>
      <button disabled={pending} className={small} onClick={() => go({ active: !active })}>{active ? "Deactivate" : "Activate"}</button>
    </div>
  );
}

/** One form for both directions: a purchase coming in, or an issue going out. */
export function MovementForm({ direction, items, today, defaultItem }: { direction: "in" | "out"; items: ItemOpt[]; today: string; defaultItem?: number }) {
  const isIn = direction === "in";
  const [item, setItem] = useState(defaultItem ? String(defaultItem) : "");
  const [day, setDay] = useState(today);
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [party, setParty] = useState("");
  const [refNo, setRefNo] = useState("");
  const [notes, setNotes] = useState("");
  const { error, pending, run } = useRun();
  const picked = items.find((i) => String(i.id) === item);
  const total = isIn && qty && rate ? Number(qty) * Number(rate) : null;
  return (
    <form
      className={wrap}
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addMovementAction({ direction, itemId: Number(item), day, qty: Number(qty), rate: isIn && rate.trim() !== "" ? Number(rate) : null, party, refNo, notes }),
          () => { setQty(""); setRate(""); setRefNo(""); setNotes(""); },
        );
      }}
    >
      <label className="text-xs text-muted-foreground">Date<input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className={`${box} mt-1 block w-40`} /></label>
      <label className="text-xs text-muted-foreground">Item
        <select value={item} onChange={(e) => setItem(e.target.value)} className={`${box} mt-1 block w-72`}>
          <option value="">Choose…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>{i.category}{i.subcategory ? ` › ${i.subcategory}` : ""} › {i.name} ({i.stock} {i.unit})</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">Quantity{picked ? ` (${picked.unit})` : ""}<input value={qty} inputMode="decimal" onChange={(e) => setQty(e.target.value)} className={`${box} num mt-1 block w-28`} /></label>
      {isIn ? <label className="text-xs text-muted-foreground">Rate / unit (₹)<input value={rate} inputMode="decimal" onChange={(e) => setRate(e.target.value)} className={`${box} num mt-1 block w-28`} /></label> : null}
      <label className="text-xs text-muted-foreground">{isIn ? "Supplier" : "Issued to / used for"}<input value={party} onChange={(e) => setParty(e.target.value)} className={`${box} mt-1 block w-48`} /></label>
      <label className="text-xs text-muted-foreground">{isIn ? "Bill / challan no." : "Slip no."}<input value={refNo} onChange={(e) => setRefNo(e.target.value)} className={`${box} mt-1 block w-36`} /></label>
      <label className="text-xs text-muted-foreground">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${box} mt-1 block w-48`} /></label>
      <button disabled={pending} className={btn}>{isIn ? "Add to stock" : "Issue from stock"}</button>
      {total != null && Number.isFinite(total) ? <span className="text-sm text-muted-foreground">Amount ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span> : null}
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </form>
  );
}

export function DeleteMovement({ id }: { id: number }) {
  const { pending, run } = useRun();
  return (
    <button disabled={pending} className="text-xs text-red-600 underline disabled:opacity-60"
      onClick={() => { if (window.confirm("Remove this entry?")) run(async () => { const r = await deleteMovementAction(id); if (!r.ok && r.error) window.alert(r.error); return r; }); }}>
      Remove
    </button>
  );
}
