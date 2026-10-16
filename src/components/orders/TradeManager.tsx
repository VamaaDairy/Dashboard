"use client";

import { Fragment, useState, useTransition } from "react";
import { Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import {
  deleteOrderAction, deletePurchaseAction, orderStatusAction, purchaseStatusAction, saveOrderAction, savePurchaseAction,
} from "@/app/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ORDER_FLOW, PO_FLOW } from "@/lib/orders/flow";
import type { Option } from "@/lib/orders/crud";
import type { DocLine } from "@/lib/orders/trade";
import { inr, label, StatusChip, TD, TH } from "./common";

export type DocKind = "primary" | "secondary" | "counter" | "purchase";

export interface DocRow {
  id: string; no: string; date: string; status: string; lines: number; total: number; notes: string | null;
  customer_id: string | null; customer_name: string | null; party: string | null; staff_id: string | null; staff: string | null;
}
export interface ProductOpt { id: string; sku: string; name: string; rate: number }

interface EditLine { product_id: string; qty: string; rate: string; discount_pct: string }

const FIELD = "h-8 w-full rounded-lg border border-border bg-background px-2 text-[13px] outline-none focus:border-primary";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const num = (s: string) => { const n = Number(s.replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };

const NOUN: Record<DocKind, string> = { primary: "primary order", secondary: "secondary order", counter: "counter sale", purchase: "purchase order" };
const PARTY: Record<DocKind, string> = { primary: "Distributor", secondary: "Retailer", counter: "Customer", purchase: "Supplier" };

export function TradeManager({ kind, rows, lineMap, parties, staff, products, canEdit }: {
  kind: DocKind; rows: DocRow[]; lineMap: Record<string, DocLine[]>;
  parties: Option[]; staff: Option[]; products: ProductOpt[]; canEdit: boolean;
}) {
  const isPo = kind === "purchase";
  const flow = isPo ? PO_FLOW : ORDER_FLOW;
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<DocRow | "new" | null>(null);
  const [f, setF] = useState({ party: "", name: "", staff: "", date: today(), notes: "", supplier: "" });
  const [lines, setLines] = useState<EditLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const product = (id: string) => products.find((p) => p.id === id);

  function begin(row: DocRow | "new") {
    setError(null);
    if (row === "new") {
      setF({ party: "", name: "", staff: "", date: today(), notes: "", supplier: "" });
      setLines([{ product_id: "", qty: "1", rate: "", discount_pct: "0" }]);
    } else {
      setF({ party: row.customer_id ?? "", name: row.customer_name ?? "", staff: row.staff_id ?? "", date: row.date, notes: row.notes ?? "", supplier: row.party ?? "" });
      setLines((lineMap[row.id] ?? []).map((l) => ({ product_id: l.product_id, qty: String(l.qty), rate: String(l.rate), discount_pct: String(l.discount_pct) })));
    }
    setEditing(row);
  }

  const setLine = (i: number, patch: Partial<EditLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const pick = (i: number, id: string) => setLine(i, { product_id: id, rate: id ? String(product(id)?.rate ?? "") : "" });
  const lineAmount = (l: EditLine) => num(l.qty) * num(l.rate) * (1 - num(l.discount_pct) / 100);
  const subtotal = lines.reduce((s, l) => s + lineAmount(l), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = editing === "new" || !editing ? null : editing.id;
    const items = lines.filter((l) => l.product_id).map((l) => ({
      product_id: l.product_id, qty: num(l.qty), rate: num(l.rate), discount_pct: num(l.discount_pct),
    }));
    start(async () => {
      const res = isPo
        ? await savePurchaseAction({ id, supplier: f.supplier, po_date: f.date, notes: f.notes || null, items: items.map((l) => ({ product_id: l.product_id, qty: l.qty, rate: l.rate })) })
        : await saveOrderAction({
            id, kind, customer_id: f.party || null, customer_name: f.name || null, staff_id: f.staff || null,
            order_date: f.date, notes: f.notes || null, items,
          });
      if (res.ok) setEditing(null); else setError(res.error);
    });
  }

  function move(row: DocRow, status: string) {
    start(async () => {
      const res = isPo ? await purchaseStatusAction(row.id, status) : await orderStatusAction(kind as Exclude<DocKind, "purchase">, row.id, status);
      if (!res.ok) alert(res.error);
    });
  }

  function remove(row: DocRow) {
    if (!confirm(`Delete ${row.no}?`)) return;
    start(async () => {
      const res = isPo ? await deletePurchaseAction(row.id) : await deleteOrderAction(kind as Exclude<DocKind, "purchase">, row.id);
      if (!res.ok) alert(res.error);
    });
  }

  return (
    <>
      {canEdit && (
        <div className="flex justify-end border-b border-border px-4 py-2">
          <Button variant="primary" size="sm" onClick={() => begin("new")}><Plus /> New {NOUN[kind]}</Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className={TH} />
              <th className={TH}>{isPo ? "PO no" : "Order no"}</th>
              <th className={TH}>Date</th>
              <th className={TH}>{PARTY[kind]}</th>
              {!isPo && <th className={TH}>Salesman</th>}
              <th className={`${TH} text-right`}>Lines</th>
              <th className={`${TH} text-right`}>Total</th>
              <th className={TH}>Status</th>
              {!isPo && <th className={TH} />}
              {canEdit && <th className={TH} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const expanded = open === r.id;
              const editable = r.status !== "delivered" && r.status !== "received" && r.status !== "cancelled";
              return (
                <Fragment key={r.id}>
                  <tr className="border-b border-border/70 hover:bg-muted/50">
                    <td className="w-8 pl-3">
                      <button onClick={() => setOpen(expanded ? null : r.id)} aria-label="Show lines" className="text-muted-foreground">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className={`${TD} font-medium text-foreground`}>{r.no}</td>
                    <td className={`${TD} text-muted-foreground`}>{r.date}</td>
                    <td className={`${TD} text-muted-foreground`}>{r.party ?? "—"}</td>
                    {!isPo && <td className={`${TD} text-muted-foreground`}>{r.staff ?? "—"}</td>}
                    <td className={`${TD} text-right tabular-nums text-muted-foreground`}>{r.lines}</td>
                    <td className={`${TD} text-right tabular-nums font-medium text-foreground`}>{inr(r.total)}</td>
                    <td className={TD}><StatusChip value={r.status} /></td>
                    {!isPo && <td className={TD}><a href={`/orders/print?id=${r.id}`} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">Print</a></td>}
                    {canEdit && (
                      <td className={`${TD} whitespace-nowrap text-right`}>
                        {(flow[r.status] ?? []).map((s) => (
                          <button key={s} disabled={pending} onClick={() => move(r, s)}
                            className={`mr-1.5 rounded-md border border-border px-2 py-0.5 text-[11px] font-medium hover:bg-muted ${s === "cancelled" ? "text-destructive" : "text-foreground"}`}>
                            {s === "cancelled" ? "Cancel" : `Mark ${label(s).toLowerCase()}`}
                          </button>
                        ))}
                        {editable && <button onClick={() => begin(r)} className="mr-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Edit</button>}
                        {r.status !== "delivered" && r.status !== "received" && (
                          <button onClick={() => remove(r)} aria-label="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 className="inline h-3.5 w-3.5" /></button>
                        )}
                      </td>
                    )}
                  </tr>
                  {expanded && (
                    <tr className="border-b border-border/70 bg-muted/30">
                      <td />
                      <td colSpan={canEdit ? 9 : 8} className="px-4 py-2">
                        <table className="w-full max-w-2xl text-[12px]">
                          <tbody>
                            {(lineMap[r.id] ?? []).map((l) => (
                              <tr key={l.product_id}>
                                <td className="py-0.5 pr-4 text-foreground">{l.name}</td>
                                <td className="py-0.5 pr-4 text-right tabular-nums text-muted-foreground">{l.qty} × {inr(l.rate)}{l.discount_pct ? ` − ${l.discount_pct}%` : ""}</td>
                                <td className="py-0.5 text-right tabular-nums text-foreground">{inr(l.qty * l.rate * (1 - l.discount_pct / 100))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {r.notes && <p className="mt-1 text-[12px] text-muted-foreground">Note: {r.notes}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing === "new" ? "New" : "Edit"} {NOUN[kind]}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {isPo ? (
                <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Supplier *
                  <input className={FIELD} value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
                </label>
              ) : (
                <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">{PARTY[kind]}{kind !== "counter" && " *"}
                  <select className={FIELD} value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })}>
                    <option value="">{kind === "counter" ? "Walk-in (type a name)" : "Pick one…"}</option>
                    {parties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>
              )}
              {kind === "counter" && !f.party && (
                <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Name
                  <input className={FIELD} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                </label>
              )}
              {!isPo && (
                <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Salesman
                  <select className={FIELD} value={f.staff} onChange={(e) => setF({ ...f, staff: e.target.value })}>
                    <option value="">—</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Date
                <input type="date" className={FIELD} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/40">
                  <tr>
                    <th className={TH}>Product</th><th className={`${TH} w-24`}>Qty</th><th className={`${TH} w-28`}>Rate</th>
                    {!isPo && <th className={`${TH} w-20`}>Disc %</th>}
                    <th className={`${TH} w-28 text-right`}>Amount</th><th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t border-border/70">
                      <td className="px-2 py-1">
                        <select className={FIELD} value={l.product_id} onChange={(e) => pick(i, e.target.value)}>
                          <option value="">Pick product…</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1"><input className={FIELD} inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
                      <td className="px-2 py-1"><input className={FIELD} inputMode="decimal" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} /></td>
                      {!isPo && <td className="px-2 py-1"><input className={FIELD} inputMode="decimal" value={l.discount_pct} onChange={(e) => setLine(i, { discount_pct: e.target.value })} /></td>}
                      <td className="px-2 py-1 text-right tabular-nums">{inr(lineAmount(l))}</td>
                      <td className="px-1"><button type="button" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <Button type="button" size="sm" onClick={() => setLines((ls) => [...ls, { product_id: "", qty: "1", rate: "", discount_pct: "0" }])}><Plus /> Add line</Button>
                <span className="text-[13px] font-semibold">Subtotal {inr(subtotal)} <span className="font-normal text-muted-foreground">(GST added on save)</span></span>
              </div>
            </div>

            <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Notes
              <input className={FIELD} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </label>
            {error && <p className="text-[12px] text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
