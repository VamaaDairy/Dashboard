import { LineChart } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SalesDashboard } from "@/components/d2c/SalesDashboard";
import { periodFrom } from "@/lib/dash/period";
import { ordersByStatus, salesByArea, salesByCategory, salesByCustomer, salesByDay, salesByPayment, salesByProduct, salesSummary } from "@/lib/d2c/sales";
import { STATUS_LABEL } from "@/lib/shop/pricing";

export const dynamic = "force-dynamic";

/** The same number of days just before [from, to]. */
function previous(from: string, to: string) {
  const day = 86_400_000;
  const f = Date.parse(`${from}T00:00:00Z`), t = Date.parse(`${to}T00:00:00Z`);
  const len = Math.round((t - f) / day) + 1;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { from: iso(f - len * day), to: iso(f - day) };
}

/** D2C sales dashboard: revenue, orders and customers over a period, with where the money comes from. */
export default async function D2cSalesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { from, to, today } = periodFrom(await searchParams);
  const p = previous(from, to);
  const [s, prev, days, categories, products, buyers, areas, statuses, payments] = await Promise.all([
    salesSummary(from, to), salesSummary(p.from, p.to), salesByDay(from, to), salesByCategory(from, to), salesByProduct(from, to),
    salesByCustomer(from, to), salesByArea(from, to), ordersByStatus(from, to), salesByPayment(from, to),
  ]);
  const byMethod = new Map<string, number>();
  for (const x of payments) byMethod.set(x.method, (byMethod.get(x.method) ?? 0) + x.revenue);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <PageHeader icon={LineChart} title="Sales dashboard · D2C" subtitle="Gaia Dairy app sales: revenue, orders, customers, products and areas over the period." />
        <SalesDashboard
          from={from} to={to} today={today} s={s} prev={prev} days={days} categories={categories} products={products} buyers={buyers} areas={areas}
          statuses={statuses.map((x) => ({ ...x, label: STATUS_LABEL[x.status] ?? x.status }))}
          payments={[...byMethod].map(([m, revenue]) => ({ label: m === "online" ? "Online" : "Cash on delivery", revenue }))}
        />
      </div>
    </div>
  );
}
