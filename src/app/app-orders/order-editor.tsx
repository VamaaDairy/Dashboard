"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rupees } from "@/lib/shop/pricing";
import { editOrderAction, reopenOrderAction } from "./edit-actions";

/** split: as the buyer ordered it, e.g. "2 CRT + 5 PCS" (qty is always the total in pieces). */
type Line = { sku: string; name: string; qty: number; rate: number; split?: string | null };

/**
 * On a pending direct order: change quantities, remove products or add new ones (priced for this buyer).
 * Saving re-prices the order on the server, updates its invoice, logs the change and tells the buyer.
 */
export function OrderEditor({ uid, lines, products }: { uid: string; lines: Line[]; products: Array<{ sku: string; name: string; rate: number }> }) {
  const router = useRouter();
  const start0 = () => lines.map((l) => ({ ...l, qty: Number(l.qty), rate: Number(l.rate) }));
  const [rows, setRows] = useState<Line[]>(start0);
  const [note, setNote] = useState("");
  const [add, setAdd] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const original = useMemo(() => new Map(lines.map((l) => [l.sku, Number(l.qty)])), [lines]);
  const dirty = rows.some((r) => (original.get(r.sku) ?? 0) !== r.qty);
  const total = rows.reduce((s, r) => s + r.qty * r.rate, 0);
  const addable = products.filter((p) => !rows.some((r) => r.sku === p.sku));

  const set = (sku: string, qty: number) => setRows((rs) => rs.map((r) => (r.sku === sku ? { ...r, qty: Math.max(0, Math.min(9999, Math.round(qty) || 0)) } : r)));

  const save = () =>
    start(async () => {
      const r = await editOrderAction(uid, rows.map((x) => ({ sku: x.sku, qty: x.qty })), note);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: "Saved. The buyer has been told what changed." });
      setNote("");
      router.refresh();
    });

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">Product</th>
              <th className="px-4 py-2 text-right font-semibold">Ordered</th>
              <th className="px-4 py-2 text-center font-semibold">Quantity</th>
              <th className="px-4 py-2 text-right font-semibold">Rate</th>
              <th className="px-4 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const was = original.get(r.sku) ?? 0;
              return (
                <tr key={r.sku} className={`border-t border-border ${r.qty === 0 ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2">
                    <div className={r.qty === 0 ? "line-through" : ""}>{r.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.sku}{was === 0 ? " · added" : ""}</div>
                    {r.split ? (
                      <div className="text-[11px] font-semibold text-muted-foreground" title="Changing the quantity re-splits it into whole crates / boxes and loose pieces">
                        Ordered as {r.split}
                      </div>
                    ) : null}
                  </td>
                  <td className="num px-4 py-2 text-right text-muted-foreground">{was || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" aria-label="Less" onClick={() => set(r.sku, r.qty - 1)} className="size-7 rounded-md border border-border hover:bg-muted">−</button>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        aria-label={`Quantity of ${r.name}`}
                        value={r.qty}
                        onChange={(e) => set(r.sku, Number(e.target.value))}
                        className={`h-7 w-16 rounded-md border px-1 text-center ${was !== r.qty ? "border-amber-500 bg-amber-50" : "border-border"}`}
                      />
                      <button type="button" aria-label="More" onClick={() => set(r.sku, r.qty + 1)} className="size-7 rounded-md border border-border hover:bg-muted">+</button>
                      <button type="button" onClick={() => set(r.sku, 0)} className="ml-1 text-xs text-destructive hover:underline">Remove</button>
                    </div>
                  </td>
                  <td className="num px-4 py-2 text-right">{rupees(r.rate)}</td>
                  <td className="num px-4 py-2 text-right font-medium">{rupees(r.qty * r.rate)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-border">
            <tr className="font-semibold"><td colSpan={4} className="px-4 py-2 text-right">Order value</td><td className="num px-4 py-2 text-right">{rupees(total)}</td></tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <select aria-label="Product to add" value={add} onChange={(e) => setAdd(e.target.value)} className="h-8 min-w-64 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">Add a product…</option>
          {addable.map((p) => (
            <option key={p.sku} value={p.sku}>{p.name} · {rupees(p.rate)}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!add}
          onClick={() => {
            const p = products.find((x) => x.sku === add);
            if (p) setRows((rs) => [...rs, { sku: p.sku, name: p.name, rate: p.rate, qty: 1 }]);
            setAdd("");
          }}
          className="h-8 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="Note for the buyer (optional), e.g. Gold Milk short today"
          className="h-9 min-w-72 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <button type="button" disabled={busy || !dirty} onClick={() => setRows(start0())} className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-40">
          Undo
        </button>
        <button type="button" disabled={busy || !dirty} onClick={save} className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
          {busy ? "Saving…" : "Save changes"}
        </button>
        {msg ? <span className={`w-full text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</span> : null}
      </div>
    </div>
  );
}

/** Puts a confirmed (not yet billed) order back to pending so it can be changed. */
export function ReopenButton({ uid, orderId }: { uid: string; orderId: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {err ? <span className="max-w-56 text-xs text-destructive">{err}</span> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const reason = window.prompt(`Why reopen order ${orderId}? It goes back to pending so it can be changed.`);
          if (reason === null) return;
          start(async () => {
            const r = await reopenOrderAction(uid, reason);
            if (!r.ok) setErr(r.error);
            else router.refresh();
          });
        }}
        className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-40"
      >
        Reopen
      </button>
    </span>
  );
}

/** Tick boxes on the order list: confirm the selected pending orders together. */
export function BulkConfirm({ formId }: { formId: string }) {
  return (
    <button
      type="submit"
      form={formId}
      onClick={(e) => {
        const n = document.querySelectorAll(`input[form="${formId}"][name="uid"]:checked`).length;
        if (!n) {
          e.preventDefault();
          window.alert("Tick the pending orders to confirm first.");
        } else if (!window.confirm(`Confirm ${n} order${n === 1 ? "" : "s"}? The buyers get a notification and the orders lock.`)) e.preventDefault();
      }}
      className="h-8 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:opacity-90"
    >
      Confirm selected
    </button>
  );
}
