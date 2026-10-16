"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { fpCreateDoc, type DocKind } from "@/app/fp/actions";
import { Button } from "@/components/ui/button";
import type { Option } from "@/lib/fp/crud";

export interface ProductOpt { id: string; label: string; dp: number; mrp: number }
const FIELD = "h-8 w-full rounded-lg border border-border bg-background px-2 text-[13px] outline-none focus:border-primary";
const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

const COPY: Record<DocKind, { from: string; to: string | null; save: string; price: "dp" | "mrp"; reason?: boolean }> = {
  "order-primary": { from: "Ordering (distributor)", to: "Order from", save: "Place purchase order", price: "dp" },
  "order-secondary": { from: "Ordering (retailer)", to: "Order from (distributor)", save: "Book order", price: "dp" },
  "counter-sale": { from: "Selling firm", to: null, save: "Record counter sale", price: "mrp" },
  "sales-return": { from: "Returned by (customer)", to: "Returned to", save: "Create sales return", price: "dp", reason: true },
  "purchase-return": { from: "Returning firm", to: "Returned to (supplier)", save: "Create purchase return", price: "dp", reason: true },
  "stock-transfer": { from: "From firm", to: "To employee", save: "Transfer stock", price: "dp" },
};

/** The document form behind order / counter sale / return / stock transfer screens. */
export function DocEditor({ routeKey, kind, fromOptions, toOptions, staff, products, listHref }: {
  routeKey: string; kind: DocKind; fromOptions: Option[]; toOptions: Option[]; staff: Option[]; products: ProductOpt[]; listHref: string;
}) {
  const c = COPY[kind];
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [by, setBy] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Array<{ product: string; qty: string }>>([{ product: "", qty: "1" }]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const price = (id: string) => { const p = products.find((x) => x.id === id); return p ? (c.price === "mrp" ? p.mrp : p.dp) : 0; };
  const total = lines.reduce((s, l) => s + price(l.product) * (Number(l.qty) || 0), 0);
  const set = (i: number, patch: Partial<(typeof lines)[number]>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await fpCreateDoc(routeKey, {
        kind, from, to, staff: kind === "stock-transfer" ? null : by || null, reason,
        lines: lines.filter((l) => l.product).map((l) => ({ productUid: l.product, qty: Number(l.qty) || 0 })),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Saved." });
        setLines([{ product: "", qty: "1" }]);
      } else setMsg({ ok: false, text: res.error });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">{c.from} *
          <select className={FIELD} value={from} onChange={(e) => setFrom(e.target.value)} required>
            <option value="">Pick one…</option>{fromOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        {c.to && (
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">{c.to} *
            <select className={FIELD} value={to} onChange={(e) => setTo(e.target.value)} required>
              <option value="">Pick one…</option>{toOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        )}
        {kind !== "stock-transfer" && (
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Employee
            <select className={FIELD} value={by} onChange={(e) => setBy(e.target.value)}>
              <option value="">—</option>{staff.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        )}
        {c.reason && (
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Return reason
            <input className={FIELD} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Leaked packs" />
          </label>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Product</th>
              <th className="w-28 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Qty</th>
              <th className="w-28 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{c.price === "mrp" ? "MRP" : "DP"}</th>
              <th className="w-32 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Value</th><th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-border/70">
                <td className="px-2 py-1"><select className={FIELD} value={l.product} onChange={(e) => set(i, { product: e.target.value })}><option value="">Pick product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></td>
                <td className="px-2 py-1"><input className={FIELD} inputMode="decimal" value={l.qty} onChange={(e) => set(i, { qty: e.target.value })} /></td>
                <td className="px-3 py-1 text-right tabular-nums text-muted-foreground">{l.product ? inr(price(l.product)) : "—"}</td>
                <td className="px-3 py-1 text-right tabular-nums">{inr(price(l.product) * (Number(l.qty) || 0))}</td>
                <td className="px-1"><button type="button" aria-label="Remove line" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <Button type="button" size="sm" onClick={() => setLines((ls) => [...ls, { product: "", qty: "1" }])}><Plus /> Add product</Button>
          <span className="text-[13px] font-semibold">Total {inr(total)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : c.save}</Button>
        <Link href={listHref} className="text-[13px] text-muted-foreground hover:text-foreground">View list</Link>
        {msg && <span className={`text-[13px] ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
