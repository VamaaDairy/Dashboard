"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import type { Target } from "@/lib/price-list";
import { addCustomerAction, createListAction, findCustomersAction, removeCustomerAction, savePriceAction, updateListAction } from "./actions";

const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

/**
 * A price you can click to change: Enter or leaving the box saves, Esc cancels. On a party list an empty
 * box takes the product off the list (the customer then pays the fallback shown in grey).
 */
export function PriceCell({ target, productUid, value, fallback, canEdit, clearable }: {
  target: Target;
  productUid: string;
  value: number | null;
  fallback?: number | null;
  canEdit: boolean;
  clearable?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(value);
  const [seen, setSeen] = useState(value);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  // a fresh value from the server (after a save, or someone else's) replaces what is shown
  if (value !== seen) {
    setSeen(value);
    setShown(value);
  }
  useEffect(() => { if (editing) input.current?.select(); }, [editing]);

  const save = () => {
    setEditing(false);
    const t = text.trim();
    const next = t === "" ? null : Number(t.replace(/[₹,\s]/g, ""));
    if (next === shown || (next !== null && !Number.isFinite(next))) return;
    if (next === null && !clearable) return;
    const was = shown;
    setShown(next);
    start(async () => {
      const r = await savePriceAction(target, productUid, next);
      if (r.ok) { setError(null); router.refresh(); } else { setShown(was); setError(r.error); }
    });
  };

  if (editing) {
    return (
      <input
        ref={input}
        autoFocus
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className="num h-8 w-24 rounded-md border border-primary bg-background px-2 text-right text-sm outline-none"
        placeholder={clearable ? "empty = off" : ""}
      />
    );
  }
  return (
    <button
      type="button"
      disabled={!canEdit || pending}
      title={error ?? (canEdit ? "Click to change" : undefined)}
      onClick={() => { setText(shown === null ? "" : String(shown)); setEditing(true); }}
      className={`num inline-flex h-8 min-w-24 items-center justify-end rounded-md px-2 text-sm ${canEdit ? "hover:bg-muted hover:ring-1 hover:ring-border" : ""} ${error ? "text-destructive ring-1 ring-destructive" : ""} ${pending ? "opacity-50" : ""}`}
    >
      {shown !== null ? (
        <span className="font-semibold">{money(shown)}</span>
      ) : fallback ? (
        <span className="text-tertiary-foreground" title="No price on this list - the customer pays this">{money(fallback)}</span>
      ) : (
        <span className="text-tertiary-foreground">-</span>
      )}
    </button>
  );
}

/** Search customers by code or name and put one on this list. */
export function CustomerPicker({ listUid }: { listUid: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Awaited<ReturnType<typeof findCustomersAction>>>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => { findCustomersAction(q).then(setHits); }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const add = (uid: string) =>
    start(async () => {
      const r = await addCustomerAction(listUid, uid);
      if (r.ok) {
        setMsg("moved" in r && r.moved ? `Added - moved off ${r.moved}.` : "Added.");
        setQ("");
        setHits([]);
        router.refresh();
      } else setMsg(r.error);
    });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setMsg(null); if (e.target.value.trim().length < 2) setHits([]); }}
          placeholder="Add a customer: code or name"
          className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus:border-primary"
        />
      </div>
      {hits.length > 0 ? (
        <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border text-[13px]">
          {hits.map((h) => (
            <li key={h.uid} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{h.name}</div>
                <div className="truncate text-[11px] text-tertiary-foreground">
                  <span className="font-mono">{h.code}</span> · {[h.channel, h.city].filter(Boolean).join(", ")}{h.active ? "" : " · inactive"}
                  {h.list ? ` · on ${h.list}` : ""}
                </div>
              </div>
              <button type="button" disabled={pending} onClick={() => add(h.uid)} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-xs font-semibold hover:bg-muted">
                <Plus className="size-3.5" /> Add
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {msg ? <p className="text-[12px] text-tertiary-foreground">{msg}</p> : null}
    </div>
  );
}

export function RemoveCustomer({ listUid, firmUid, name }: { listUid: string; firmUid: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title={`Take ${name} off this list`}
      onClick={() => {
        if (!window.confirm(`Take ${name} off this list? They will pay their channel price.`)) return;
        start(async () => { await removeCustomerAction(listUid, firmUid); router.refresh(); });
      }}
      className="rounded p-1 text-tertiary-foreground hover:bg-muted hover:text-destructive"
    >
      <X className="size-3.5" />
    </button>
  );
}

/** New party price list: a name and its group (MFS, Institution, ...). */
export function NewList({ groups }: { groups: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grp, setGrp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm font-medium hover:bg-muted">
        <Plus className="size-4" /> New price list
      </button>
    );
  return (
    <form
      className="space-y-2 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createListAction(name, grp);
          if (r.ok) { setOpen(false); setName(""); router.push(`/price-list?list=${r.uid}`); } else setError(r.error);
        });
      }}
    >
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Reliance Retail" className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" />
      <input value={grp} onChange={(e) => setGrp(e.target.value)} list="price-list-groups" placeholder="Group, e.g. MFS / Institution" className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" />
      <datalist id="price-list-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="h-8 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">Create</button>
        <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
      </div>
    </form>
  );
}

/** Rename / regroup / remove a party list. */
export function ListSettings({ uid, name, grp }: { uid: string; name: string; grp: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (patch: { name?: string; grp?: string; active?: boolean }) =>
    start(async () => {
      const r = await updateListAction(uid, patch);
      if (!r.ok && r.error) window.alert(r.error);
      else if (patch.active === false) router.push("/price-list");
      else router.refresh();
    });
  const btn = "h-8 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50";
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending} className={btn} onClick={() => { const n = window.prompt("Price list name", name); if (n && n !== name) run({ name: n }); }}>Rename</button>
      <button type="button" disabled={pending} className={btn} onClick={() => { const g = window.prompt("Group (MFS, Institution, Admin, OD ...)", grp ?? ""); if (g !== null && g !== grp) run({ grp: g }); }}>Group</button>
      <button type="button" disabled={pending} className={`${btn} text-destructive`} onClick={() => { if (window.confirm(`Remove ${name}? Its customers go back to their channel price.`)) run({ active: false }); }}>Remove list</button>
    </div>
  );
}

/** Jump between the standard prices and the party lists (grouped), or pick a customer to check. */
export function ListPicker({ lists, current, q }: { lists: Array<{ uid: string; name: string; grp: string | null; customers: number }>; current?: string; q?: string }) {
  const router = useRouter();
  const groups = new Map<string, typeof lists>();
  for (const l of lists) groups.set(l.grp ?? "Other", [...(groups.get(l.grp ?? "Other") ?? []), l]);
  return (
    <select
      value={current ?? ""}
      onChange={(e) => {
        const p = new URLSearchParams();
        if (e.target.value) p.set("list", e.target.value);
        if (q) p.set("q", q);
        router.push(p.size ? `/price-list?${p}` : "/price-list");
      }}
      aria-label="Price list"
      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium md:w-80"
    >
      <option value="">Standard prices (MRP, Retailer, Distributor)</option>
      {[...groups].map(([g, ls]) => (
        <optgroup key={g} label={g}>
          {ls.map((l) => (
            <option key={l.uid} value={l.uid}>{l.name} ({l.customers} customer{l.customers === 1 ? "" : "s"})</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Customer search that opens the price check for the one picked. */
export function CustomerCheckPicker({ current }: { current?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Awaited<ReturnType<typeof findCustomersAction>>>([]);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => { findCustomersAction(q).then(setHits); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="relative w-full md:w-96">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) setHits([]); }}
        placeholder={current ? "Check another customer: code or name" : "Check a customer's prices: code or name"}
        className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus:border-primary"
      />
      {hits.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-72 w-full divide-y divide-border overflow-y-auto rounded-lg border border-border bg-popover text-[13px] shadow-lg">
          {hits.map((h) => (
            <li key={h.uid}>
              <button
                type="button"
                onClick={() => { setQ(""); setHits([]); router.push(`/price-list/overview?customer=${h.uid}`); }}
                className="block w-full px-3 py-2 text-left hover:bg-muted"
              >
                <div className="truncate font-medium">{h.name}</div>
                <div className="truncate text-[11px] text-tertiary-foreground">
                  <span className="font-mono">{h.code}</span> · {[h.channel, h.city].filter(Boolean).join(", ")}{h.active ? "" : " · inactive"}{h.list ? ` · ${h.list}` : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
