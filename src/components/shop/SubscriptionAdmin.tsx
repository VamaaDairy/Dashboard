"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSubscriptionOrdersAction } from "@/lib/shop/actions";

export function CreateOrdersButton({ day, label }: { day: string; label: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createSubscriptionOrdersAction(day);
            setMsg(r.ok ? (r.created ? `Created ${r.created} order(s), ${r.items} item(s).` : "Nothing new to create - already done.") : r.error ?? "Could not create the orders.");
          })
        }
        className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Creating..." : label}
      </button>
      {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------- the office managing one customer's subscriptions

type Freq = "daily" | "alternate" | "weekdays" | "every_n" | "skip_n";
type Sub = { id: number; sku: string; name: string; qty: number; frequency: Freq; weekdays: number[]; everyN: number | null; startDate: string; endDate: string | null; status: "active" | "paused" | "cancelled"; outOfStock?: boolean };
type Day = { day: string; items: { subscriptionId: number; name: string; qty: number; planQty: number; changed: boolean }[]; state: string; editable: boolean; orderNo?: string };
type Result = { ok: true; message?: string } | { ok: false; error: string };

const FREQ: { value: Freq; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "alternate", label: "Alternate days" },
  { value: "weekdays", label: "Chosen weekdays" },
  { value: "every_n", label: "Every N days" },
  { value: "skip_n", label: "Skip every Nth day" },
];
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
const input = "h-8 rounded-md border border-foreground/15 bg-background px-2 text-[13px]";
const btn = "h-8 rounded-md border border-foreground/15 px-3 text-[13px] font-medium hover:bg-foreground/[0.04] disabled:opacity-50";

export function SubscriptionManager({
  customerId, subscriptions, days, firstEditableDay, products, actions,
}: {
  customerId: number;
  subscriptions: Sub[];
  days: Day[];
  firstEditableDay: string;
  products: { sku: string; name: string; price: number }[];
  actions: {
    updatePlan: (c: number, id: number, body: Record<string, unknown>) => Promise<Result>;
    setStatus: (c: number, id: number, s: "active" | "paused" | "cancelled") => Promise<Result>;
    vacation: (c: number, from: string, to: string, skip: boolean) => Promise<Result>;
    setDay: (c: number, id: number, day: string, qty: number | null) => Promise<Result>;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (f: () => Promise<Result>, okText = "Saved.") =>
    start(async () => {
      const r = await f();
      setMsg(r.ok ? { ok: true, text: r.message ?? okText } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  const [from, setFrom] = useState(firstEditableDay);
  const [to, setTo] = useState(firstEditableDay);

  return (
    <div className="space-y-4 border-b border-foreground/10 px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-foreground">Manage subscription</h3>
        <span className="text-[12px] text-foreground/70">Changes apply from {dayLabel(firstEditableDay)} (they close at 9 PM the day before). The customer gets a notification.</span>
      </div>
      {msg ? <div className={`rounded-md px-3 py-2 text-[13px] ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-destructive/10 text-destructive"}`}>{msg.text}</div> : null}

      {subscriptions.map((s) => (
        <PlanEditor key={`${s.id}-${s.sku}-${s.qty}-${s.frequency}-${s.status}-${s.endDate}`} sub={s} products={products} firstEditableDay={firstEditableDay} pending={pending}
          onSave={(body) => run(() => actions.updatePlan(customerId, s.id, body))}
          onStatus={(st) => {
            if (st === "cancelled" && !window.confirm(`Cancel ${s.name}? This cannot be undone; the customer would need to subscribe again.`)) return;
            run(() => actions.setStatus(customerId, s.id, st), st === "active" ? "Resumed." : st === "paused" ? "Paused." : "Cancelled.");
          }} />
      ))}

      <div className="rounded-lg border border-foreground/10 bg-card p-3">
        <div className="text-[13px] font-semibold text-foreground">Vacation</div>
        <p className="mt-0.5 text-[12px] text-foreground/70">No deliveries on any of this customer&apos;s subscriptions between these days (at most 90 days).</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
          <label className="flex items-center gap-1.5">From <input type="date" className={input} min={firstEditableDay} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="flex items-center gap-1.5">To <input type="date" className={input} min={from} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className={btn} disabled={pending} onClick={() => run(() => actions.vacation(customerId, from, to, true))}>Skip these days</button>
          <button className={btn} disabled={pending} onClick={() => run(() => actions.vacation(customerId, from, to, false))}>Bring them back</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-foreground/10 bg-card">
        <div className="border-b border-foreground/10 px-3 py-2 text-[13px] font-semibold text-foreground">Next 14 days</div>
        <table className="w-full text-[13px]">
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-b border-foreground/[0.06] align-top last:border-0">
                <td className="w-32 whitespace-nowrap px-3 py-2 text-foreground">{dayLabel(d.day)}</td>
                <td className="w-28 px-3 py-2 text-[12px] text-foreground/70">
                  {d.orderNo ? `Order ${d.orderNo}` : d.state === "skipped" ? "Skipped" : d.state === "changed" ? "Changed" : d.state === "none" ? "No delivery" : "As planned"}
                </td>
                <td className="px-3 py-2">
                  {d.items.length === 0 ? <span className="text-foreground/50">—</span> : null}
                  {d.items.map((it) => (
                    <DayItem key={it.subscriptionId} item={it} editable={d.editable} pending={pending}
                      onSet={(q) => run(() => actions.setDay(customerId, it.subscriptionId, d.day, q), q === 0 ? "Day skipped." : "Day changed.")} />
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanEditor({ sub, products, firstEditableDay, pending, onSave, onStatus }: {
  sub: Sub; products: { sku: string; name: string; price: number }[]; firstEditableDay: string; pending: boolean;
  onSave: (body: Record<string, unknown>) => void; onStatus: (s: "active" | "paused" | "cancelled") => void;
}) {
  const [sku, setSku] = useState(sub.sku);
  const [qty, setQty] = useState(sub.qty);
  const [freq, setFreq] = useState<Freq>(sub.frequency);
  const [weekdays, setWeekdays] = useState<number[]>(sub.weekdays);
  const [n, setN] = useState(sub.everyN ?? 2);
  const [startDate, setStart] = useState(sub.startDate);
  const [endDate, setEnd] = useState(sub.endDate ?? "");
  const startEditable = sub.startDate >= firstEditableDay;

  const body = () => {
    const b: Record<string, unknown> = {};
    if (sku !== sub.sku) b.sku = sku;
    if (qty !== sub.qty) b.qty = qty;
    if (freq !== sub.frequency || freq === "weekdays" || freq === "every_n" || freq === "skip_n") {
      b.frequency = freq;
      if (freq === "weekdays") b.weekdays = weekdays;
      if (freq === "every_n" || freq === "skip_n") b.everyN = n;
    }
    if (startEditable && startDate !== sub.startDate) b.startDate = startDate;
    if ((endDate || null) !== sub.endDate) b.endDate = endDate || null;
    return b;
  };

  return (
    <div className="rounded-lg border border-foreground/10 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-foreground">
          {sub.name} <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${sub.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-foreground/[0.06] text-foreground/70"}`}>{sub.status === "active" ? "Active" : "Paused"}</span>
          {sub.outOfStock ? <span className="ml-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">Out of stock: on hold until it is back</span> : null}
        </div>
        <div className="flex gap-2">
          {sub.status === "active"
            ? <button className={btn} disabled={pending} onClick={() => onStatus("paused")}>Pause</button>
            : <button className={btn} disabled={pending} onClick={() => onStatus("active")}>Resume</button>}
          <button className={`${btn} border-destructive/40 text-destructive hover:bg-destructive/10`} disabled={pending} onClick={() => onStatus("cancelled")}>Cancel subscription</button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3 text-[13px]">
        <label className="flex flex-col gap-1">Product
          <select className={`${input} min-w-56`} value={sku} onChange={(e) => setSku(e.target.value)}>
            {!products.some((p) => p.sku === sub.sku) ? <option value={sub.sku}>{sub.name}</option> : null}
            {products.map((p) => <option key={p.sku} value={p.sku}>{p.name} · ₹{p.price}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Quantity
          <input type="number" min={1} max={20} className={`${input} w-20`} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
        </label>
        <label className="flex flex-col gap-1">How often
          <select className={input} value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>
            {FREQ.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        {freq === "every_n" || freq === "skip_n" ? (
          <label className="flex flex-col gap-1">N (days)
            <input type="number" min={2} max={30} className={`${input} w-20`} value={n} onChange={(e) => setN(Number(e.target.value) || 2)} />
          </label>
        ) : null}
        <label className="flex flex-col gap-1">Start
          <input type="date" className={input} min={firstEditableDay} value={startDate} disabled={!startEditable} title={startEditable ? "" : "It has already started"} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">End (optional)
          <input type="date" className={input} min={firstEditableDay} value={endDate} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <button className="h-8 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground disabled:opacity-50" disabled={pending} onClick={() => onSave(body())}>Save plan</button>
      </div>
      {freq === "weekdays" ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
          {WEEK.map((w, i) => {
            const v = i + 1, on = weekdays.includes(v);
            return (
              <button key={w} type="button" onClick={() => setWeekdays((x) => (on ? x.filter((y) => y !== v) : [...x, v].sort()))}
                className={`h-7 rounded-full border px-3 ${on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/15"}`}>{w}</button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function DayItem({ item, editable, pending, onSet }: { item: Day["items"][number]; editable: boolean; pending: boolean; onSet: (qty: number | null) => void }) {
  const [q, setQ] = useState(item.qty);
  return (
    <div className="flex flex-wrap items-center gap-2 py-0.5">
      <span className={item.qty === 0 ? "text-foreground/50 line-through" : "text-foreground"}>{item.name}</span>
      {editable ? (
        <>
          <input type="number" min={0} max={20} aria-label={`Quantity of ${item.name}`} className={`${input} h-7 w-16`} value={q} onChange={(e) => setQ(Math.max(0, Math.min(20, Number(e.target.value) || 0)))} />
          <button className={`${btn} h-7 px-2 text-[12px]`} disabled={pending || q === item.qty} onClick={() => onSet(q)}>Set</button>
          {item.qty !== 0 ? <button className={`${btn} h-7 px-2 text-[12px]`} disabled={pending} onClick={() => onSet(0)}>Skip</button> : null}
          {item.changed ? <button className={`${btn} h-7 px-2 text-[12px]`} disabled={pending} onClick={() => onSet(null)}>Back to plan ({item.planQty})</button> : null}
        </>
      ) : (
        <span className="tabular-nums text-foreground/70">× {item.qty}</span>
      )}
    </div>
  );
}
