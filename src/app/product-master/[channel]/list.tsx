"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AppChannel, AppProduct } from "@/lib/products/app-products";
import { cn } from "@/lib/utils";
import {
  addCategoryAction, addPhotoAction, addToListAction, categoryIconAction, createProductAction, descriptionAction, makeFirstPhotoAction,
  moveCategoryAction, moveProductAction, photosAction, removeFromListAction, removePhotoAction, renameCategoryAction, setPricesAction, updateProductAction,
} from "../actions";

export type Line = AppProduct & { rate: number | null };
type Addable = { uid: string; sku: string; name: string; category: string; mrp: number; active: boolean };
type Res = { ok: true } | { ok: false; error: string };

const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const input = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-foreground";

/** Runs a change, refreshes the page after it, and keeps its error. */
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Res | { ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setError(null);
        after?.();
        router.refresh();
      } else setError(("error" in r && r.error) || "That did not work.");
    });
  return { run, pending, error, setError };
}

export function ProductList({ channel, categories, icons, lines, addable, canEdit }: {
  channel: AppChannel;
  categories: string[];
  /** category name -> its icon link (only categories that have one) */
  icons: Record<string, string>;
  lines: Line[];
  addable: Addable[];
  canEdit: boolean;
}) {
  const { run, pending, error, setError } = useRun();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Line | null>(null);
  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState<string | null>(null);

  const term = q.trim().toLowerCase();
  const shown = term ? lines.filter((l) => `${l.name} ${l.size ?? ""} ${l.sku} ${l.category} ${l.masterName}`.toLowerCase().includes(term)) : lines;
  const groups = categories.map((c) => ({ name: c, lines: shown.filter((l) => l.category === c) })).filter((g) => g.lines.length || (!term && canEdit));
  const visibleCount = lines.filter((l) => l.visible && l.active).length;

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU or category" className={cn(input, "pl-8")} />
        </div>
        <p className="text-[13px] text-tertiary-foreground">
          {visibleCount} of {lines.length} products show in the app · {categories.length} categories
        </p>
        {canEdit ? (
          <div className="flex gap-2 md:ml-auto">
            <Button variant="outline" onClick={() => setNewCategory("")}><Plus className="size-4" /> Category</Button>
            <Button variant="primary" onClick={() => setAdding(true)}><Plus className="size-4" /> Add product</Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss"><X className="size-4" /></button>
        </div>
      ) : null}

      {groups.map((g) => (
        <section key={g.name} className={cn("overflow-hidden rounded-lg border border-border bg-card", pending && "opacity-80")}>
          <CategoryHeader
            channel={channel}
            name={g.name}
            icon={icons[g.name] ?? null}
            count={g.lines.length}
            first={categories[0] === g.name}
            last={categories[categories.length - 1] === g.name}
            canEdit={canEdit && !term}
            run={run}
          />
          {g.lines.length === 0 ? (
            <p className="border-t border-border px-4 py-3 text-[13px] text-tertiary-foreground">No products yet - change a product&apos;s category to move it here.</p>
          ) : (
            <ul>
              {g.lines.map((l, i) => (
                <ProductRow
                  key={l.uid}
                  channel={channel}
                  line={l}
                  categories={categories}
                  first={i === 0}
                  last={i === g.lines.length - 1}
                  canEdit={canEdit}
                  canMove={canEdit && !term}
                  run={run}
                  onEdit={() => setEditing(l)}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
      {groups.length === 0 ? <p className="py-10 text-center text-muted-foreground">No products match.</p> : null}

      {editing ? <EditDialog channel={channel} line={editing} categories={categories} onClose={() => setEditing(null)} /> : null}
      {adding ? <AddDialog channel={channel} addable={addable} categories={categories} onClose={() => setAdding(false)} /> : null}
      <Dialog open={newCategory !== null} onOpenChange={(o) => { if (!o) setNewCategory(null); }}>
        <DialogContent className="p-5">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>It goes at the end; move it up from its heading, and move products into it from their category box.</DialogDescription>
          </DialogHeader>
          <input autoFocus value={newCategory ?? ""} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Sweets" className={cn(input, "mt-3")} />
          <DialogFooter className="mt-4">
            <Button variant="primary" disabled={pending} onClick={() => run(() => addCategoryAction(channel, newCategory ?? ""), () => setNewCategory(null))}>Add category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Run = ReturnType<typeof useRun>["run"];

function CategoryHeader({ channel, name, icon, count, first, last, canEdit, run }: {
  channel: AppChannel; name: string; icon: string | null; count: number; first: boolean; last: boolean; canEdit: boolean; run: Run;
}) {
  const [renaming, setRenaming] = useState(false);
  const [text, setText] = useState(name);
  const file = useRef<HTMLInputElement>(null);
  const setIcon = (f: File | null) => {
    const form = new FormData();
    form.set("channel", channel);
    form.set("name", name);
    if (f) form.set("icon", f);
    run(() => categoryIconAction(form));
  };
  return (
    <div className="flex items-center gap-2 bg-muted/50 px-3 py-2">
      {/* the category's icon in the app; without one the app shows the first product's photo */}
      <div className="group relative size-9 shrink-0 overflow-hidden rounded-full border border-border bg-white">
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- category icons come from our own icon route
          <img src={icon} alt="" className="size-full object-contain p-1" />
        ) : (
          <span className="flex size-full items-center justify-center text-[9px] leading-tight text-tertiary-foreground text-center">no icon</span>
        )}
        {canEdit ? (
          <div className="absolute inset-0 hidden items-center justify-center gap-0.5 bg-white/90 group-hover:flex">
            <button type="button" title={icon ? "Change category icon" : "Add category icon"} onClick={() => file.current?.click()}><ImagePlus className="size-3.5" /></button>
            {icon ? <button type="button" title="Remove category icon" onClick={() => { if (confirm(`Remove the ${name} icon?`)) setIcon(null); }}><Trash2 className="size-3.5" /></button> : null}
          </div>
        ) : null}
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) setIcon(f);
          }}
        />
      </div>
      {canEdit ? (
        <div className="flex">
          <Button variant="ghost" size="icon-sm" disabled={first} title="Move category up" onClick={() => run(() => moveCategoryAction(channel, name, -1))}><ArrowUp /></Button>
          <Button variant="ghost" size="icon-sm" disabled={last} title="Move category down" onClick={() => run(() => moveCategoryAction(channel, name, 1))}><ArrowDown /></Button>
        </div>
      ) : null}
      {renaming ? (
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); run(() => renameCategoryAction(channel, name, text), () => setRenaming(false)); }}
        >
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} className={cn(input, "h-8 max-w-60")} />
          <Button type="submit" size="sm" variant="primary">Save</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setRenaming(false); setText(name); }}>Cancel</Button>
        </form>
      ) : (
        <>
          <h2 className="text-sm font-semibold">{name}</h2>
          <span className="text-[12px] text-tertiary-foreground">{count}</span>
          {canEdit ? <Button variant="ghost" size="icon-xs" title="Rename category" onClick={() => setRenaming(true)}><Pencil /></Button> : null}
        </>
      )}
    </div>
  );
}

function ProductRow({ channel, line: l, categories, first, last, canEdit, canMove, run, onEdit }: {
  channel: AppChannel; line: Line; categories: string[]; first: boolean; last: boolean; canEdit: boolean; canMove: boolean; run: Run; onEdit: () => void;
}) {
  const off = !l.visible || !l.active;
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2 md:flex-nowrap">
      {canMove ? (
        <div className="flex flex-col">
          <Button variant="ghost" size="icon-xs" disabled={first} title="Move up" onClick={() => run(() => moveProductAction(channel, l.uid, -1))}><ArrowUp /></Button>
          <Button variant="ghost" size="icon-xs" disabled={last} title="Move down" onClick={() => run(() => moveProductAction(channel, l.uid, 1))}><ArrowDown /></Button>
        </div>
      ) : null}
      <div className={cn("size-12 shrink-0 overflow-hidden rounded-md border border-border bg-white", off && "opacity-40")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- product photos come from our own photo route */}
        {l.image ? <img src={l.image} alt="" className="size-full object-contain" /> : null}
      </div>
      {/* as the app shows it: the name, the size under it */}
      <button type="button" onClick={onEdit} disabled={!canEdit} className={cn("min-w-0 flex-1 text-left", off && "opacity-50")}>
        <div className="truncate font-medium text-foreground">{l.name}</div>
        <div className="truncate text-[12px] text-muted-foreground">{l.size ?? <span className="italic">no size</span>}</div>
        <div className="truncate text-[11px] text-tertiary-foreground">
          <span className="font-mono">{l.sku}</span>
          {!l.active ? <span> · switched off in the company Product Master</span> : !l.visible ? <span> · hidden in the app</span> : null}
        </div>
      </button>
      <select
        value={l.category}
        disabled={!canEdit}
        onChange={(e) => run(() => updateProductAction(channel, l.uid, { category: e.target.value }))}
        className="h-8 w-36 rounded-lg border border-input bg-background px-2 text-[13px] outline-none focus:border-foreground"
        title="Category"
      >
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <div className="w-24 text-right">
        <PriceInput label="MRP" value={l.mrp} canEdit={canEdit} onSave={(v) => run(() => setPricesAction(channel, l.uid, { mrp: v ?? 0 }))} />
      </div>
      <div className="w-28 text-right">
        {channel === "d2c" ? (
          <PriceInput label="App price" value={l.shopPrice} placeholder={l.mrp} canEdit={canEdit} clearable onSave={(v) => run(() => setPricesAction(channel, l.uid, { shopPrice: v }))} />
        ) : (
          <Link href="/price-list" title="Default price - change it on the Price list page; party lists can override it" className="block text-right hover:underline">
            <div className="text-[10px] text-tertiary-foreground">{channel === "retail" ? "Retailer price" : "Distributor price"}</div>
            <div className="num text-sm">{l.rate ? money(l.rate) : <span className="text-tertiary-foreground">none</span>}</div>
          </Link>
        )}
      </div>
      {canEdit ? (
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            title={l.visible ? "Showing in the app - click to hide" : "Hidden - click to show in the app"}
            onClick={() => run(() => updateProductAction(channel, l.uid, { visible: !l.visible }))}
          >
            {l.visible ? <Eye /> : <EyeOff className="text-tertiary-foreground" />}
          </Button>
          <Button variant="ghost" size="icon-sm" title="Edit name, size, category, photos" onClick={onEdit}><Pencil /></Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Remove from this list"
            onClick={() => {
              if (confirm(`Remove ${l.name}${l.size ? ` ${l.size}` : ""} from this list? It stays in the company Product Master and on the other lists.`)) {
                run(() => removeFromListAction(channel, l.uid));
              }
            }}
          >
            <Trash2 />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/** A price you can click to change: Enter or leaving the box saves, Esc cancels. */
function PriceInput({ label, value, placeholder, canEdit, clearable, onSave }: {
  label: string; value: number | null; placeholder?: number; canEdit: boolean; clearable?: boolean; onSave: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const save = () => {
    setEditing(false);
    const t = text.trim().replace(/[₹,\s]/g, "");
    const next = t === "" ? null : Number(t);
    if (next === value || (next !== null && !Number.isFinite(next)) || (next === null && !clearable)) return;
    onSave(next);
  };
  return (
    <div>
      <div className="text-[10px] text-tertiary-foreground">{label}</div>
      {editing ? (
        <input
          autoFocus
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          placeholder={clearable ? "= MRP" : ""}
          className="num h-7 w-full rounded-md border border-foreground bg-background px-1.5 text-right text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => { setText(value === null ? "" : String(value)); setEditing(true); }}
          className={cn("num w-full rounded-md px-1 text-right text-sm", canEdit && "hover:bg-muted")}
        >
          {value !== null ? money(value) : placeholder !== undefined ? <span className="text-tertiary-foreground">{money(placeholder)}</span> : "-"}
        </button>
      )}
    </div>
  );
}

function EditDialog({ channel, line: l, categories, onClose }: { channel: AppChannel; line: Line; categories: string[]; onClose: () => void }) {
  const { run, pending, error } = useRun();
  const [name, setName] = useState(l.own.name ?? l.name);
  const [size, setSize] = useState(l.own.size ?? l.size ?? "");
  const [category, setCategory] = useState(l.category);
  const [description, setDescription] = useState(l.description ?? "");
  const [photos, setPhotos] = useState<Array<{ uid: string; url: string }> | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const loadPhotos = () => photosAction(channel, l.uid).then(setPhotos);
  useEffect(() => {
    photosAction(channel, l.uid).then(setPhotos);
  }, [channel, l.uid]);

  const save = () =>
    run(async () => {
      const r = await updateProductAction(channel, l.uid, {
        // what equals the Product Master's own value is not stored, so a later Product Master change still flows through
        name: name.trim() === l.masterName.trim() ? null : name,
        size,
        category,
      });
      if (!r.ok || description.trim() === (l.description ?? "").trim()) return r;
      return descriptionAction(channel, l.uid, description);
    }, onClose);
  const photoRun = (fn: () => Promise<Res | { ok: boolean; error?: string }>) => run(fn, () => void loadPhotos());

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg p-5">
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{l.sku}</span> · Product Master name: {l.masterName}. Name, size and category apply to this list only; photos, description and MRP to every app.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-[13px] font-medium">
            Name in the app (without the quantity)
            <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-[13px] font-medium">
              Size (shown under the name)
              <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="500 ml, 1 Ltr, 200 g" className={input} />
            </label>
            <label className="grid gap-1 text-[13px] font-medium">
              Category
              <input list="pm-categories" value={category} onChange={(e) => setCategory(e.target.value)} className={input} />
              <datalist id="pm-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
          </div>
          <label className="grid gap-1 text-[13px] font-medium">
            <span>Description <span className="font-normal text-tertiary-foreground">shown on the product page, in every app</span></span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Thick, creamy dahi set from fresh cow milk. Keep refrigerated."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </label>
          {/* as the app will show it */}
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
            <div className="text-[10px] text-tertiary-foreground uppercase">In the app</div>
            <div className="font-semibold">{name.trim() || l.name}</div>
            <div className="text-[13px] text-muted-foreground">{size.trim() || "no size"}</div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-[13px] font-medium">
              Photos <span className="font-normal text-tertiary-foreground">first one shows in the app</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(photos ?? []).map((p, i) => (
                <div key={p.uid} className={cn("group relative size-20 overflow-hidden rounded-md border bg-white", i === 0 ? "border-foreground" : "border-border")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- product photos come from our own photo route */}
                  <img src={p.url} alt="" className="size-full object-contain" />
                  <div className="absolute inset-x-0 bottom-0 hidden justify-center gap-1 bg-white/90 py-0.5 group-hover:flex">
                    {i > 0 ? <button title="Make main photo" onClick={() => photoRun(() => makeFirstPhotoAction(channel, l.uid, p.uid))}><Star className="size-3.5" /></button> : null}
                    <button title="Delete photo" onClick={() => { if (confirm("Delete this photo from the product?")) photoRun(() => removePhotoAction(channel, l.uid, p.uid)); }}><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => file.current?.click()}
                className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-[11px] text-muted-foreground hover:bg-muted"
              >
                <ImagePlus className="size-5" /> Add photo
              </button>
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const form = new FormData();
                  form.set("channel", channel);
                  form.set("uid", l.uid);
                  form.set("photo", f);
                  form.set("first", photos?.length ? "0" : "1");
                  photoRun(() => addPhotoAction(form));
                }}
              />
            </div>
            {photos === null ? <p className="mt-1 text-[12px] text-tertiary-foreground">Loading photos…</p> : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={pending} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CHANNEL_LABEL: Record<AppChannel, string> = { d2c: "D2C", retail: "Retail", distributor: "Distributors" };

function AddDialog({ channel, addable, categories, onClose }: { channel: AppChannel; addable: Addable[]; categories: string[]; onClose: () => void }) {
  const { run, pending, error } = useRun();
  const [mode, setMode] = useState<"existing" | "new">(addable.length ? "existing" : "new");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ sku: "", name: "", size: "", category: categories[0] ?? "", mrp: "", dp: "" });
  const term = q.trim().toLowerCase();
  const shown = term ? addable.filter((a) => `${a.sku} ${a.name} ${a.category}`.toLowerCase().includes(term)) : addable;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl p-5">
        <DialogHeader>
          <DialogTitle>Add product to {CHANNEL_LABEL[channel]}</DialogTitle>
          <DialogDescription>Pick products already in the company Product Master, or make a brand-new one.</DialogDescription>
        </DialogHeader>
        <div className="mt-3 flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(["existing", "new"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("flex-1 rounded-md py-1.5", mode === m ? "bg-background font-medium shadow-xs" : "text-muted-foreground")}>
              {m === "existing" ? `From Product Master (${addable.length})` : "New product"}
            </button>
          ))}
        </div>

        {mode === "existing" ? (
          <div className="mt-3 space-y-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU or category" className={input} />
            <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {shown.map((a) => (
                <li key={a.uid}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={picked.has(a.uid)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        if (e.target.checked) next.add(a.uid); else next.delete(a.uid);
                        setPicked(next);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.name}</div>
                      <div className="text-[11px] text-tertiary-foreground">
                        <span className="font-mono">{a.sku}</span> · {a.category} · {a.mrp > 0 ? money(a.mrp) : "no MRP"}{a.active ? "" : " · switched off"}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
              {shown.length === 0 ? <li className="px-3 py-6 text-center text-[13px] text-tertiary-foreground">Every product is already on this list.</li> : null}
            </ul>
            <p className="text-[12px] text-tertiary-foreground">A product without an MRP, or switched off, is listed but does not show in the app until that is fixed.</p>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-[13px] font-medium">SKU code<input value={form.sku} onChange={set("sku")} placeholder="e.g. 1060" className={input} /></label>
              <label className="grid gap-1 text-[13px] font-medium">
                Category
                <input list="pm-new-categories" value={form.category} onChange={set("category")} className={input} />
                <datalist id="pm-new-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </label>
            </div>
            <div className="grid grid-cols-[1fr_9rem] gap-3">
              <label className="grid gap-1 text-[13px] font-medium">Name (without the quantity)<input value={form.name} onChange={set("name")} placeholder="Gaia Toned Milk" className={input} /></label>
              <label className="grid gap-1 text-[13px] font-medium">Size<input value={form.size} onChange={set("size")} placeholder="500 ml" className={input} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-[13px] font-medium">MRP (₹)<input inputMode="decimal" value={form.mrp} onChange={set("mrp")} className={input} /></label>
              <label className="grid gap-1 text-[13px] font-medium">DP (₹, optional)<input inputMode="decimal" value={form.dp} onChange={set("dp")} className={input} /></label>
            </div>
            <p className="text-[12px] text-tertiary-foreground">
              It goes on this list only; the other lists can add it from the company Product Master. Brand, tax and units are copied from another product in the same category. Add the photo with the pencil on the new product; set
              retailer and distributor prices on the Price list page.
            </p>
          </div>
        )}
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {mode === "existing" ? (
            <Button variant="primary" disabled={pending || picked.size === 0} onClick={() => run(() => addToListAction(channel, [...picked]), onClose)}>
              Add {picked.size || ""} to {CHANNEL_LABEL[channel]}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    createProductAction(
                      { sku: form.sku, name: form.name, size: form.size, category: form.category, mrp: Number(form.mrp), dp: Number(form.dp || 0) },
                      [channel],
                    ),
                  onClose,
                )
              }
            >
              Create product
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
