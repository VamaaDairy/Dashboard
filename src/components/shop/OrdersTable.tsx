"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Columns3, Package, Printer, Route as RouteIcon } from "lucide-react";
import { assignRiderAction, setStatusAction } from "@/lib/shop/actions";
import { cn } from "@/lib/utils";

export interface OrderRow {
  id: number;
  orderNo: string;
  placed: string;
  /** "Subscription · 9 Nov" or "Regular" */
  type: string;
  subscription: boolean;
  name: string;
  phone: string;
  nth: number;
  address: string;
  pincode: string | null;
  noPin: boolean;
  note: string | null;
  items: Array<{ name: string; image: string | null; qty: number }>;
  qty: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  payMethod: string;
  paid: { label: string; tone: "good" | "wait" | "bad" };
  status: string;
  statusLabel: string;
  tracking: { step: number | null; text: string; live: boolean; late: number | null; route: boolean };
  rider: string | null;
  stop: string | null;
}

type Col = "placed" | "customer" | "address" | "items" | "total" | "status" | "tracking" | "rider";
const COLS: Array<[Col, string]> = [
  ["placed", "Placed"], ["customer", "Customer"], ["address", "Address"], ["items", "Items"],
  ["total", "Amount and payment"], ["status", "Status"], ["tracking", "Tracking"], ["rider", "Rider"],
];
const STORE = "d2c-orders-hidden-cols";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ordinal = (n: number) => (n === 1 ? "first order" : `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"} order`);
const STATUS_DOT: Record<string, string> = {
  awaiting_payment: "bg-warning", placed: "bg-foreground/40", confirmed: "bg-foreground/60",
  out_for_delivery: "bg-primary", delivered: "bg-emerald-600", cancelled: "bg-destructive",
};
const PAID_DOT = { good: "bg-emerald-600", wait: "bg-warning", bad: "bg-destructive" } as const;
const initials = (s: string) => s.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^gaia$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

/**
 * The D2C orders table. Each row opens the order's page; tick rows to give them to a rider, change their status
 * or print delivery slips together. Columns can be hidden (remembered in this browser).
 */
export function OrdersTable({ rows, riders, canEdit, footer }: {
  rows: OrderRow[];
  riders: Array<{ id: number; name: string }>;
  canEdit: boolean;
  footer: React.ReactNode;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<Col>>(new Set());
  const [picking, setPicking] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? "[]") as Col[];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved preference after mount
      if (saved.length) setHidden(new Set(saved));
    } catch { /* storage unavailable */ }
  }, []);
  const show = (c: Col) => !hidden.has(c);
  const toggleCol = (c: Col) => setHidden((h) => {
    const n = new Set(h); if (n.has(c)) n.delete(c); else n.add(c);
    try { localStorage.setItem(STORE, JSON.stringify([...n])); } catch { /* ignore */ }
    return n;
  });
  const all = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const tick = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const bulk = (label: string, run: (id: number) => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    let done = 0; const errors: string[] = [];
    for (const id of sel) {
      const r = await run(id);
      if (r.ok) done++; else errors.push(`${rows.find((x) => x.id === id)?.orderNo}: ${r.error ?? "failed"}`);
    }
    setNote(`${label}: ${done} order${done === 1 ? "" : "s"} updated${errors.length ? `. ${errors.length} not: ${errors.slice(0, 3).join("; ")}` : "."}`);
    setSel(new Set());
    router.refresh();
  });

  const th = "whitespace-nowrap border-y border-foreground/10 bg-foreground/[0.025] px-3 py-2 text-left text-[12px] font-medium text-foreground/75";
  const td = "border-b border-foreground/[0.06] px-3 py-3 align-middle";
  const visible = 2 + COLS.filter(([c]) => show(c)).length;

  return (
    <>
      {sel.size ? (
        <div className="flex flex-wrap items-center gap-2 bg-primary/[0.06] px-4 py-2 text-[13px]">
          <span className="font-semibold text-foreground">{sel.size} selected</span>
          {canEdit ? (
            <>
              <select
                disabled={pending}
                defaultValue=""
                onChange={(e) => { const v = e.target.value; e.target.value = ""; if (v) bulk("Rider", (id) => assignRiderAction(id, v === "none" ? null : Number(v))); }}
                className="h-8 rounded-lg border border-foreground/15 bg-card px-2 text-[13px] text-foreground"
                aria-label="Give to rider"
              >
                <option value="">Give to rider…</option>
                {riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                <option value="none">Take rider off</option>
              </select>
              <select
                disabled={pending}
                defaultValue=""
                onChange={(e) => { const v = e.target.value; e.target.value = ""; if (v) bulk("Status", (id) => setStatusAction(id, v)); }}
                className="h-8 rounded-lg border border-foreground/15 bg-card px-2 text-[13px] text-foreground"
                aria-label="Set status"
              >
                <option value="">Set status…</option>
                <option value="confirmed">Confirmed</option>
                <option value="out_for_delivery">Out for delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </>
          ) : null}
          <a href={`/shop-orders/slips?ids=${[...sel].join(",")}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-foreground/15 bg-card px-3 text-foreground hover:bg-foreground/[0.04]">
            <Printer className="size-4" /> Print delivery slips
          </a>
          {pending ? <span className="text-foreground/75">Updating…</span> : null}
          <button type="button" onClick={() => setSel(new Set())} className="ml-auto text-foreground/75 hover:text-foreground">Clear</button>
        </div>
      ) : note ? (
        <div className="flex items-center justify-between bg-foreground/[0.03] px-4 py-2 text-[13px] text-foreground">
          <span>{note}</span>
          <button type="button" onClick={() => setNote(null)} className="text-foreground/75 hover:text-foreground">Dismiss</button>
        </div>
      ) : null}

      <div className="relative">
        <div className={cn("absolute -top-11 right-4 z-20", (sel.size || note) && "hidden")}>
          <button type="button" onClick={() => setPicking((v) => !v)} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-foreground/15 bg-card px-2 text-[12px] text-foreground hover:bg-foreground/[0.04]" aria-expanded={picking}>
            <Columns3 className="size-3.5" /> Columns
          </button>
          {picking ? (
            <div className="absolute right-0 mt-1 w-48 rounded-lg border border-foreground/15 bg-popover p-2 shadow-lg">
              {COLS.map(([c, l]) => (
                <label key={c} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-foreground hover:bg-foreground/[0.04]">
                  <input type="checkbox" checked={show(c)} onChange={() => toggleCol(c)} className="accent-[var(--primary)]" /> {l}
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tabular-nums">
            <thead>
              <tr>
                <th className={cn(th, "w-9")}>
                  <input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all on this page" className="accent-[var(--primary)]" />
                </th>
                <th className={th}>Order</th>
                {show("placed") ? <th className={th}>Placed</th> : null}
                {show("customer") ? <th className={th}>Customer</th> : null}
                {show("address") ? <th className={th}>Address</th> : null}
                {show("items") ? <th className={th}>Items</th> : null}
                {show("total") ? <th className={th}>Amount</th> : null}
                {show("status") ? <th className={th}>Status</th> : null}
                {show("tracking") ? <th className={th}>Tracking</th> : null}
                {show("rider") ? <th className={th}>Rider</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={o.id}
                  onClick={(e) => { if (!(e.target as HTMLElement).closest("input,a,button,select")) router.push(`/app-orders/d2c/${o.id}`); }}
                  className={cn("cursor-pointer", sel.has(o.id) ? "bg-primary/[0.06]" : "hover:bg-foreground/[0.025]")}
                >
                  <td className={td}><input type="checkbox" checked={sel.has(o.id)} onChange={() => tick(o.id)} aria-label={`Select ${o.orderNo}`} className="accent-[var(--primary)]" /></td>
                  <td className={cn(td, "whitespace-nowrap")}>
                    <Link href={`/app-orders/d2c/${o.id}`} className="font-semibold text-primary hover:underline">{o.orderNo}</Link>
                    <div className={cn("mt-0.5 text-[12px]", o.subscription ? "font-medium text-primary" : "text-foreground/75")}>{o.type}</div>
                  </td>
                  {show("placed") ? (
                    <td className={cn(td, "whitespace-nowrap")}>
                      <div className="text-foreground">{o.placed.split(", ")[0]}</div>
                      <div className="text-[12px] text-foreground/75">{o.placed.split(", ")[1]}</div>
                    </td>
                  ) : null}
                  {show("customer") ? (
                    <td className={cn(td, "whitespace-nowrap")}>
                      <div className="font-medium text-foreground">{o.name}</div>
                      <div className="text-[12px] text-foreground/75">{o.phone}</div>
                      <div className="text-[12px] text-foreground/75">{ordinal(o.nth)}</div>
                    </td>
                  ) : null}
                  {show("address") ? (
                    <td className={cn(td, "max-w-44")}>
                      <div className="truncate text-foreground" title={o.address}>{o.address}</div>
                      <div className="text-[12px] text-foreground/75">
                        {o.pincode ?? "no pincode"}
                        {o.noPin ? <span className="text-amber-700"> · no map pin</span> : null}
                        {o.note ? <span title={o.note}> · note</span> : null}
                      </div>
                    </td>
                  ) : null}
                  {show("items") ? (
                    <td className={td}>
                      <div className="flex" title={o.items.map((i) => `${i.qty} × ${i.name}`).join("\n")}>
                        {o.items.slice(0, 3).map((i, k) => (
                          <span key={k} className={cn("relative size-7 overflow-hidden rounded-md bg-foreground/[0.06] ring-2 ring-card", k > 0 && "-ml-1.5")}>
                            {i.image ? (
                              // eslint-disable-next-line @next/next/no-img-element -- product photos from our own route
                              <img src={i.image} alt="" className="size-full object-cover" loading="lazy" />
                            ) : <span className="flex size-full items-center justify-center text-[9px] font-semibold text-foreground/70">{initials(i.name) || <Package className="size-3" />}</span>}
                          </span>
                        ))}
                        {o.items.length > 3 ? <span className="-ml-1.5 flex size-7 items-center justify-center rounded-md bg-foreground/[0.08] text-[10px] font-semibold text-foreground ring-2 ring-card">+{o.items.length - 3}</span> : null}
                      </div>
                      <div className="mt-0.5 whitespace-nowrap text-[12px] text-foreground/75">{o.items.length} item{o.items.length === 1 ? "" : "s"} · {o.qty} pcs</div>
                    </td>
                  ) : null}
                  {show("total") ? (
                    <td className={cn(td, "whitespace-nowrap")} title={o.deliveryFee ? `Includes ${inr(o.deliveryFee)} delivery` : undefined}>
                      <div className="font-semibold text-foreground">{inr(o.total)}</div>
                      <div className="flex items-center gap-1.5 text-[12px] text-foreground/75">
                        <span className={cn("size-1.5 rounded-full", PAID_DOT[o.paid.tone])} />{o.payMethod === "Cash on delivery" ? "COD" : o.payMethod} · {o.paid.label}
                      </div>
                    </td>
                  ) : null}
                  {show("status") ? (
                    <td className={cn(td, "whitespace-nowrap")}>
                      <span className="inline-flex items-center gap-1.5 text-foreground"><span className={cn("size-2 rounded-full", STATUS_DOT[o.status] ?? "bg-foreground/40")} />{o.statusLabel}</span>
                      {o.tracking.late ? <span className="ml-1.5 text-[12px] font-semibold text-destructive" title="Waiting longer than it should">+{o.tracking.late} min</span> : null}
                    </td>
                  ) : null}
                  {show("tracking") ? (
                    <td className={cn(td, "w-52 min-w-52")}>
                      {o.tracking.step !== null ? <Steps step={o.tracking.step} /> : null}
                      <div className="mt-1 text-[12px] leading-snug text-foreground/75">
                        {o.tracking.live ? <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-600 align-middle shadow-[0_0_0_3px_rgba(5,150,105,0.18)]" aria-label="Live" /> : null}
                        <span>{o.tracking.text}</span>
                        {o.tracking.route ? (
                          <Link href={`/app-orders/d2c/${o.id}#route`} className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-primary hover:underline"><RouteIcon className="size-3.5" /> Route</Link>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                  {show("rider") ? (
                    <td className={cn(td, "whitespace-nowrap")}>
                      {o.rider ? <><div className="text-foreground">{o.rider}</div>{o.stop ? <div className="text-[12px] text-foreground/75">{o.stop}</div> : null}</>
                        : o.status === "cancelled" || o.status === "delivered" || o.status === "awaiting_payment" ? <span className="text-foreground/75">—</span>
                        : <span className="font-medium text-amber-700">Not assigned</span>}
                    </td>
                  ) : null}
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={visible} className="px-4 py-14 text-center text-foreground/75">No orders match these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] text-foreground/75">{footer}</div>
    </>
  );
}

/** Placed → confirmed → rider → picked up → delivered, done steps filled. */
function Steps({ step }: { step: number }) {
  const names = ["Placed", "Confirmed", "Rider assigned", "Picked up", "Delivered"];
  return (
    <div className="flex items-center" title={names.map((n, i) => `${i <= step ? "✓" : "·"} ${n}`).join("\n")}>
      {names.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 ? <span className={cn("h-0.5 w-3.5", i <= step ? "bg-primary" : "bg-foreground/15")} /> : null}
          <span className={cn("rounded-full", i < step || step === 4 ? "size-2 bg-primary" : i === step ? "size-2.5 border-2 border-primary bg-card" : "size-2 bg-foreground/15")} />
        </span>
      ))}
    </div>
  );
}
