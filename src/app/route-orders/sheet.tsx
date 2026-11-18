"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PackageX, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-50" /><span className="relative inline-flex size-2 rounded-full bg-primary" /></span>
      {/* a clock: the server's second and the browser's differ, which is expected */}
      <span suppressHydrationWarning>Live · {at.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
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
          {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}
          <div className="mt-2 flex items-center gap-1.5">
            <button type="button" disabled={pending} onClick={submit} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 text-[13px] font-medium text-primary-foreground disabled:opacity-60">
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Save
            </button>
            {qty ? <button type="button" disabled={pending} onClick={() => save(0, null)} className="h-8 rounded-md border border-input px-2 text-[13px] text-destructive hover:bg-muted">Remove</button> : null}
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
        big ? "h-8 bg-primary px-3 text-sm text-primary-foreground" : "h-6 border border-border bg-background px-2 text-[11px] text-foreground shadow-xs hover:bg-muted")}
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} {label}
    </button>
  );
}

export interface CancelProduct {
  sku: string;
  name: string;
  image: string | null;
  pack: number;
  orders: Array<{
    uid: string; orderId: number; customer: string; route: string; qty: number; confirmed: boolean;
    /** the only product on it: taking it off cancels the order */
    only: boolean;
    /** why it cannot be changed here (billed, on a trip); null when it can */
    locked: string | null;
  }>;
}

/**
 * "Cancel a product": one button on top of the sheet. It opens a review: pick the product, see every order of the day
 * it is on (untick any to keep it there; billed or on-trip orders are shown but locked), give a reason, confirm - and
 * see what was done.
 */
export function CancelProductButton({ products }: { products: CancelProduct[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState<string | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ changed: number; cancelled: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const p = products.find((x) => x.sku === sku) ?? null;
  const chosen = p ? p.orders.filter((o) => !o.locked && !off.has(o.uid)) : [];
  const cancels = chosen.filter((o) => o.only).length;
  const qty = chosen.reduce((s, o) => s + o.qty, 0);

  const reset = () => { setSku(null); setOff(new Set()); setReason(""); setResult(null); setError(""); };
  const close = (o: boolean) => {
    setOpen(o);
    if (o) { editing++; return; }
    editing = Math.max(0, editing - 1);
    if (result) router.refresh();
    reset();
  };
  const go = () =>
    start(async () => {
      if (!p) return;
      const r = await removeProductAction(chosen.map((o) => o.uid), p.sku, reason);
      if (!r.ok) return setError(r.error);
      setResult({ changed: r.changed, cancelled: r.cancelled, errors: r.errors });
    });

  if (!products.length) return null;
  return (
    <Dialog open={open} onOpenChange={close}>
      <button type="button" onClick={() => close(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium shadow-xs hover:bg-muted">
        <PackageX className="size-4 text-muted-foreground" /> Cancel a product
      </button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{result ? "Done" : p ? `Cancel ${p.name}` : "Cancel a product for the day"}</DialogTitle>
          <DialogDescription>
            {result ? "The orders are changed; buyers see it in the app."
              : p ? "It is taken off every ticked order. An order with nothing else on it is cancelled."
                : "Pick the product. You will see every order it is on before anything changes."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-secondary px-4 py-3"><div className="text-[12px] text-muted-foreground">Orders changed</div><div className="num text-xl font-semibold">{result.changed}</div></div>
              <div className="rounded-lg border border-border bg-secondary px-4 py-3"><div className="text-[12px] text-muted-foreground">Orders cancelled</div><div className="num text-xl font-semibold">{result.cancelled}</div></div>
            </div>
            {result.errors.length ? (
              <div className="rounded-lg border border-border bg-secondary px-4 py-3 text-[13px]">
                <div className="mb-1 font-medium">Not changed</div>
                <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            ) : null}
          </div>
        ) : !p ? (
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto px-2 py-2">
            {products.map((x) => (
              <li key={x.sku}>
                <button type="button" onClick={() => setSku(x.sku)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted">
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {x.image ? <img src={x.image} alt="" className="size-9 object-contain" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{x.name}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">{x.sku}</span>
                  </span>
                  <span className="text-right text-[12px] text-muted-foreground">
                    <span className="num block font-semibold text-foreground">{fmt(x.orders.reduce((s, o) => s + o.qty, 0), x.pack)}</span>
                    {x.orders.length} {x.orders.length === 1 ? "order" : "orders"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-3 px-5 py-4">
            <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-secondary text-left text-[11px] text-muted-foreground">
                  <tr>
                    <th className="w-8 px-3 py-2"><input type="checkbox" aria-label="All" className="size-4 accent-primary"
                      checked={p.orders.filter((o) => !o.locked).every((o) => !off.has(o.uid))}
                      onChange={(e) => setOff(e.target.checked ? new Set() : new Set(p.orders.map((o) => o.uid)))} /></th>
                    <th className="px-2 py-2 font-medium">Customer</th>
                    <th className="px-2 py-2 font-medium">Order</th>
                    <th className="px-2 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Then</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {p.orders.map((o) => {
                    const on = !o.locked && !off.has(o.uid);
                    return (
                      <tr key={o.uid} className={o.locked ? "text-muted-foreground" : ""}>
                        <td className="px-3 py-2"><input type="checkbox" disabled={!!o.locked} checked={on} aria-label={o.customer} className="size-4 accent-primary"
                          onChange={() => setOff((s) => { const n = new Set(s); if (n.has(o.uid)) n.delete(o.uid); else n.add(o.uid); return n; })} /></td>
                        <td className="px-2 py-2"><div className="font-medium">{o.customer}</div><div className="text-[11px] text-muted-foreground">{o.route}</div></td>
                        <td className="px-2 py-2 font-mono text-[12px]">#{o.orderId}<div className="font-sans text-[11px] text-muted-foreground">{o.confirmed ? "Confirmed" : "Pending"}</div></td>
                        <td className="num px-2 py-2 text-right">{fmt(o.qty, p.pack)}</td>
                        <td className="px-3 py-2 text-[12px] text-muted-foreground">{o.locked ?? (!on ? "Kept" : o.only ? "Order cancelled" : "Product removed")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <label className="block text-[12px] text-muted-foreground">Reason (optional, the buyer sees it)
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Not produced today" className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground" />
            </label>
            <div className="rounded-lg border border-border bg-secondary px-4 py-2.5 text-[13px] shadow-[inset_3px_0_0_var(--primary)]">
              {chosen.length
                ? <>Removes <b className="num">{fmt(qty, p.pack)}</b> of {p.name} from <b>{chosen.length}</b> {chosen.length === 1 ? "order" : "orders"}{cancels ? <>; <b>{cancels}</b> {cancels === 1 ? "order is" : "orders are"} cancelled (it is all they have)</> : null}.</>
                : "Nothing ticked."}
            </div>
            {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <button type="button" onClick={() => close(false)} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Close</button>
          ) : p ? (
            <>
              <button type="button" onClick={() => { setSku(null); setOff(new Set()); setError(""); }} className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-muted">Back</button>
              <button type="button" disabled={pending || !chosen.length} onClick={go} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-destructive px-4 text-sm font-medium text-white disabled:opacity-50">
                {pending ? <Loader2 className="size-4 animate-spin" /> : null} Cancel on {chosen.length} {chosen.length === 1 ? "order" : "orders"}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => close(false)} className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-muted">Close</button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
