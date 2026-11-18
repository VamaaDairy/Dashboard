"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { confirmRowsAction, removeProductAction, setCellAction } from "./sheet-actions";

/** The route sheet's editing pieces: a quantity cell, Confirm buttons, taking a product off a day, live refresh. */

/** While someone is typing in a cell the page is not refreshed under them. */
let editing = 0;

/** Reloads the page's data every [seconds] (not while a cell is open, nor when the tab is hidden). */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [at, setAt] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => {
      if (editing > 0 || document.hidden) return;
      router.refresh();
      setAt(new Date());
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground" title={`Refreshes every ${seconds} s`}>
      <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>
      Live · {at.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

const fmt = (pieces: number, pack: number) => {
  if (pack <= 1) return String(Number(pieces.toFixed(2)));
  const whole = Math.floor((pieces + 1e-9) / pack);
  return `${whole} + ${Number((pieces - whole * pack).toFixed(2))}`;
};

/**
 * One customer's quantity of one product. Click to change it: cases and pieces (or pieces for a product sold singly),
 * Save, or Remove (0). Read-only when the cell spans several orders or the order can no longer be changed here.
 */
export function QtyCell({ uids, sku, name, customer, qty, pack, locked }: {
  uids: string[]; sku: string; name: string; customer: string; qty: number; pack: number;
  /** why it cannot be changed here (several orders, billed, on a trip); null when it can */
  locked: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cs, setCs] = useState("");
  const [pc, setPc] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const first = useRef<HTMLInputElement>(null);
  const p = pack > 1 ? pack : 1;

  const show = () => {
    if (locked) return;
    const whole = p > 1 ? Math.floor((qty + 1e-9) / p) : 0;
    setCs(p > 1 ? String(whole) : "");
    setPc(String(p > 1 ? Number((qty - whole * p).toFixed(2)) : qty || ""));
    setError("");
    setOpen(true);
    editing++;
    setTimeout(() => first.current?.select(), 0);
  };
  const close = () => {
    setOpen(false);
    editing = Math.max(0, editing - 1);
  };
  const save = (total: number, packs: number | null) =>
    start(async () => {
      const r = await setCellAction(uids, sku, total, packs);
      if (!r.ok) return setError(r.error);
      close();
      router.refresh();
    });
  const submit = () => {
    const c = cs.trim() === "" ? 0 : Number(cs), l = pc.trim() === "" ? 0 : Number(pc);
    if (!Number.isInteger(c) || !Number.isInteger(l) || c < 0 || l < 0) return setError("Whole numbers only.");
    save(c * p + l, p > 1 ? c : null);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={show}
        disabled={!!locked && !qty}
        title={locked ?? `Change ${name} for ${customer}`}
        className={cn("num w-full rounded px-1 text-right", locked ? "cursor-default" : "hover:bg-primary/10 hover:text-primary", !qty && !locked && "text-transparent hover:text-muted-foreground")}
      >
        {qty ? fmt(qty, p) : locked ? "" : "+"}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-60 rounded-lg border border-border bg-popover p-3 text-left shadow-lg" onKeyDown={(e) => { if (e.key === "Escape") close(); if (e.key === "Enter") submit(); }}>
          <div className="text-[12px] font-semibold">{name}</div>
          <div className="mb-2 truncate text-[11px] text-muted-foreground">{customer}</div>
          <div className="flex items-end gap-2">
            {p > 1 ? (
              <label className="flex-1 text-[11px] text-muted-foreground">Cases of {p}
                <input ref={first} inputMode="numeric" value={cs} onChange={(e) => setCs(e.target.value.replace(/\D/g, ""))} className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" />
              </label>
            ) : null}
            <label className="flex-1 text-[11px] text-muted-foreground">{p > 1 ? "+ Pieces" : "Pieces"}
              <input ref={p > 1 ? undefined : first} inputMode="numeric" value={pc} onChange={(e) => setPc(e.target.value.replace(/\D/g, ""))} className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" />
            </label>
          </div>
          {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
          <div className="mt-2 flex items-center gap-1.5">
            <button type="button" disabled={pending} onClick={submit} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 text-[13px] font-medium text-primary-foreground disabled:opacity-60">
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Save
            </button>
            {qty ? <button type="button" disabled={pending} onClick={() => save(0, null)} className="h-8 rounded-md border border-input px-2 text-[13px] text-red-600 hover:bg-muted">Remove</button> : null}
            <button type="button" onClick={close} aria-label="Close" className="h-8 rounded-md px-1.5 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Saved on the order: the app, its invoice and history follow.</p>
        </div>
      ) : null}
    </div>
  );
}

/** Confirms the given pending orders (one customer's row, or every pending order on the sheet). */
export function ConfirmButton({ uids, label = "Confirm", big = false }: { uids: string[]; label?: string; big?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!uids.length) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => {
        const r = await confirmRowsAction(uids);
        if (!r.ok) window.alert(r.error);
        else if (r.errors.length) window.alert(`${r.confirmed} confirmed. Not confirmed: ${r.errors.join("; ")}`);
        router.refresh();
      })}
      className={cn("inline-flex items-center gap-1 rounded-md font-medium disabled:opacity-60",
        big ? "h-8 bg-primary px-3 text-sm text-primary-foreground" : "h-6 border border-amber-600/40 bg-background px-2 text-[11px] text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950")}
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} {label}
    </button>
  );
}

/** A product column's "take it off every order shown" control. */
export function RemoveProduct({ uids, sku, name, orders }: { uids: string[]; sku: string; name: string; orders: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!orders) return null;
  return (
    <button
      type="button"
      disabled={pending}
      title={`Take ${name} off all ${orders} orders shown`}
      onClick={() => {
        if (!window.confirm(`Take ${name} off all ${orders} order${orders === 1 ? "" : "s"} on this sheet?\n\nEach order is changed (an order with nothing else is cancelled) and the buyers see it in the app. Billed orders and orders on a trip are left as they are.`)) return;
        start(async () => {
          const r = await removeProductAction(uids, sku);
          if (!r.ok) window.alert(r.error);
          else window.alert(`${name}: taken off ${r.changed} order${r.changed === 1 ? "" : "s"}${r.cancelled ? `, ${r.cancelled} cancelled (it was all they had)` : ""}.${r.errors.length ? `\nNot changed: ${r.errors.join("; ")}` : ""}`);
          router.refresh();
        });
      }}
      className="mt-1 inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-normal text-red-600 hover:bg-red-50 disabled:opacity-60 dark:hover:bg-red-950/40"
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />} Cancel for day
    </button>
  );
}
