import { LayoutDashboard } from "lucide-react";
import { inr, label, Panel, Stat, TD, TH } from "@/components/orders/common";
import { SectionShell } from "@/components/orders/SectionShell";
import { getDashboard } from "@/lib/orders/insights";

export const dynamic = "force-dynamic";

export default async function Page() {
  const d = await getDashboard();
  const max = Math.max(1, ...d.trend.map((t) => t.total));

  return (
    <SectionShell icon={LayoutDashboard} title="Orders overview" subtitle="Sales, field activity, stock and support at a glance.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Sales today" value={inr(d.salesToday)} />
        <Stat title="Sales this month" value={inr(d.salesMonth)} hint={`${d.ordersMonth} orders`} />
        <Stat title="Open orders" value={String(d.openOrders)} hint="created, approved or invoiced" />
        <Stat title="Out of stock" value={String(d.outOfStock)} hint="products at zero or below" />
        <Stat title="Active customers" value={String(d.customers)} />
        <Stat title="Active employees" value={String(d.activeStaff)} hint={`${d.presentToday} present today`} />
        <Stat title="Visits today" value={String(d.visitsToday)} hint={`${d.visitsMonth} this month`} />
        <Stat title="To follow up" value={String(d.openTickets + d.pendingExpenses)} hint={`${d.openTickets} tickets · ${d.pendingExpenses} expense claims`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Sales - last 6 months">
          <div className="flex h-44 items-end gap-3 px-4 pt-4 pb-2">
            {d.trend.map((t) => (
              <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-muted-foreground">{t.total ? inr(Math.round(t.total / 1000)) + "k" : ""}</span>
                <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(2, (t.total / max) * 100)}px` }} />
                <span className="text-[11px] text-muted-foreground">{t.month}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="This month by order type">
          <Table head={["Type", "Orders", "Value"]} rows={d.byKind.map((k) => [label(k.kind), String(k.orders), inr(k.total)])} empty="No orders this month." />
        </Panel>
        <Panel title="Top products this month">
          <Table head={["Product", "Qty", "Value"]} rows={d.topProducts.map((p) => [p.name, String(p.qty), inr(p.amount)])} empty="No sales yet." />
        </Panel>
        <Panel title="Top customers this month">
          <Table head={["Customer", "Orders", "Value"]} rows={d.topCustomers.map((c) => [c.name, String(c.orders), inr(c.amount)])} empty="No sales yet." />
        </Panel>
      </div>

      <Panel title="Employee ranking this month">
        <Table head={["Employee", "Orders", "Sales", "Visits"]} rows={d.ranking.map((r) => [r.name, String(r.orders), inr(r.amount), String(r.visits)])} empty="No employees yet." />
      </Panel>
    </SectionShell>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border bg-muted/40">
          <tr>{head.map((h, i) => <th key={h} className={`${TH} ${i > 0 ? "text-right" : ""}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/70">
              {r.map((c, j) => <td key={j} className={`${TD} ${j === 0 ? "font-medium text-foreground" : "text-right tabular-nums text-muted-foreground"}`}>{c}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={head.length} className="px-4 py-8 text-center text-muted-foreground">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
