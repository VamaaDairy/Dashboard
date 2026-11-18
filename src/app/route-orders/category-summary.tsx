import type { DayLine } from "@/lib/route-orders/data";
import { inr, kg } from "./parts";

/** The day's orders by customer category (GT, MFS, Institutional, ATP ...): customers, orders, pieces, load and value. */
export function CategorySummary({ lines }: { lines: DayLine[] }) {
  if (!lines.length) return null;
  const by = new Map<string, { customers: Set<string>; orders: Set<string>; pending: Set<string>; qty: number; kg: number; value: number }>();
  for (const l of lines) {
    const k = l.party?.channel || (l.retail ? "Retail" : "Not matched");
    const x = by.get(k) ?? { customers: new Set(), orders: new Set(), pending: new Set(), qty: 0, kg: 0, value: 0 };
    x.customers.add(l.party ? `p${l.party.id}` : l.firmUid);
    x.orders.add(l.orderUid);
    if (l.status.toLowerCase() !== "confirmed") x.pending.add(l.orderUid);
    x.qty += l.qty;
    x.kg += l.qty * Number(l.product?.weight_kg ?? 0);
    x.value += l.amount;
    by.set(k, x);
  }
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const rows = [...by].sort((a, b) => b[1].value - a[1].value);
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {rows.map(([k, x]) => (
        <div key={k} className="rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold">{k}</span>
            <span className="text-[11px] text-muted-foreground">{total ? Math.round((x.value / total) * 100) : 0}%</span>
          </div>
          <div className="num mt-0.5 text-lg font-semibold">{inr(x.value)}</div>
          <div className="text-[11px] text-muted-foreground">
            {x.customers.size} {x.customers.size === 1 ? "customer" : "customers"} · {x.orders.size} {x.orders.size === 1 ? "order" : "orders"}{x.pending.size ? ` (${x.pending.size} pending)` : ""} · {kg(x.kg)}
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${total ? (x.value / total) * 100 : 0}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
