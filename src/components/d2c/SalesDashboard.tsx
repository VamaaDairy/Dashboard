"use client";

import Link from "next/link";
import { BarList, ColumnChart, Donut, GAIA, TrendChart, shortDate } from "@/components/farmers/charts";
import { Panel, PeriodBar, Tiles } from "@/components/dash/Dash";

interface Day { day: string; orders: number; revenue: number; items: number; cod: number; online: number }
interface Summary { revenue: number; orders: number; items: number; customers: number; newCustomers: number; cancelled: number; online: number; subscriptionRevenue: number }

const rs = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (now: number, before: number) => {
  if (!before) return now ? "new this period" : undefined;
  const d = ((now - before) / before) * 100;
  return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(0)}% vs previous period`;
};
const PALETTE = [GAIA.blue, GAIA.green, GAIA.orange, "#6676c6", "#72bd81", "#f2a07b", "#97a3dc", "#898781"];

/** The D2C sales picture for a period: the numbers, the trend, and where the money comes from. */
export function SalesDashboard({ from, to, today, s, prev, days, categories, products, buyers, areas, statuses, payments }: {
  from: string;
  to: string;
  today: string;
  s: Summary;
  prev: Summary;
  days: Day[];
  categories: { category: string; revenue: number; qty: number }[];
  products: { name: string; revenue: number; qty: number }[];
  buyers: { id: number | null; name: string; revenue: number; orders: number }[];
  areas: { pincode: string; revenue: number; orders: number }[];
  statuses: { status: string; label: string; orders: number }[];
  payments: { label: string; revenue: number }[];
}) {
  const aov = s.orders ? s.revenue / s.orders : 0;
  const prevAov = prev.orders ? prev.revenue / prev.orders : 0;
  const catTotal = categories.reduce((t, c) => t + c.revenue, 0);

  return (
    <div className="space-y-4">
      <PeriodBar from={from} to={to} today={today} />
      <Tiles
        items={[
          { label: "Revenue", value: rs(s.revenue), note: pct(s.revenue, prev.revenue) },
          { label: "Orders", value: s.orders.toLocaleString("en-IN"), note: pct(s.orders, prev.orders) },
          { label: "Average order", value: rs(aov), note: pct(aov, prevAov) },
          { label: "Items sold", value: s.items.toLocaleString("en-IN"), note: pct(s.items, prev.items) },
          { label: "Customers who bought", value: s.customers.toLocaleString("en-IN"), note: `${s.newCustomers} new sign-ups` },
          { label: "Paid online", value: s.revenue ? `${Math.round((s.online / s.revenue) * 100)}%` : "—", note: `${rs(s.online)} online · ${s.cancelled} cancelled` },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Revenue by day" description="Orders that weren't cancelled, by the day they were placed." className="lg:col-span-2">
          <TrendChart
            points={days.map((d) => ({ day: d.day, value: d.revenue }))}
            color={GAIA.blue}
            unit="₹"
            decimals={0}
            emptyLabel="no sales"
            extraTip={(day) => {
              const d = days.find((x) => x.day === day);
              return d ? [{ label: "Orders", value: String(d.orders) }, { label: "Cash", value: rs(d.cod) }, { label: "Online", value: rs(d.online) }] : [];
            }}
          />
        </Panel>
        <Panel title="By category" description="Share of revenue.">
          <Donut
            slices={categories.slice(0, 8).map((c, i) => ({ label: c.category, value: c.revenue, color: PALETTE[i % PALETTE.length], note: `${c.qty} sold` }))}
            centre={rs(catTotal)}
            centreLabel="item sales"
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Orders by day" className="lg:col-span-2">
          <ColumnChart
            data={days.map((d) => ({ key: d.day, label: shortDate(d.day), value: d.orders, tip: [{ label: "Revenue", value: rs(d.revenue) }, { label: "Items", value: String(d.items) }] }))}
            color={GAIA.green}
            unit="orders"
          />
        </Panel>
        <Panel title="How they paid">
          <BarList items={payments.map((p) => ({ label: p.label, value: p.revenue }))} color={GAIA.blue} format={rs} />
          <div className="mt-4 border-t border-border pt-3">
            <BarList items={[{ label: "Subscriptions", value: s.subscriptionRevenue }, { label: "One-time orders", value: s.revenue - s.subscriptionRevenue }]} color={GAIA.green} format={rs} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Top products" description="By revenue.">
          <BarList items={products.slice(0, 10).map((p) => ({ label: p.name, value: p.revenue, note: `${p.qty} sold` }))} color={GAIA.blue} format={rs} />
          <Link href={`/d2c/reports/products?from=${from}&to=${to}`} className="mt-3 inline-block text-[12px] font-semibold text-primary hover:underline">All products →</Link>
        </Panel>
        <Panel title="Top customers" description="By what they spent.">
          <ul className="space-y-2 text-[13px]">
            {buyers.slice(0, 10).map((b, i) => (
              <li key={`${b.id}-${i}`} className="flex justify-between gap-3">
                {b.id ? <Link href={`/d2c/customers/${b.id}`} className="truncate text-primary hover:underline">{b.name}</Link> : <span className="truncate">{b.name}</span>}
                <span className="num shrink-0 text-muted-foreground">{b.orders} · <span className="font-semibold text-foreground">{rs(b.revenue)}</span></span>
              </li>
            ))}
            {buyers.length === 0 ? <li className="text-muted-foreground">No sales in this period.</li> : null}
          </ul>
          <Link href={`/d2c/reports/customers?from=${from}&to=${to}`} className="mt-3 inline-block text-[12px] font-semibold text-primary hover:underline">All customers →</Link>
        </Panel>
        <Panel title="Top areas" description="By delivery pincode.">
          <BarList items={areas.slice(0, 10).map((a) => ({ label: a.pincode, value: a.revenue, note: `${a.orders} orders` }))} color={GAIA.green} format={rs} />
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 text-[12px] font-semibold text-muted-foreground">Orders placed, where they stand now</div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
              {statuses.map((st) => <li key={st.status} className="flex justify-between"><span className="text-muted-foreground">{st.label}</span><span className="num font-semibold">{st.orders}</span></li>)}
            </ul>
          </div>
        </Panel>
      </div>
    </div>
  );
}
