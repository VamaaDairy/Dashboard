import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { getProductTotals, getRangeSummary } from "@/lib/daily/data";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const sp = await searchParams;
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  const from = typeof sp.from === "string" ? sp.from : iso(monthAgo);
  const to = typeof sp.to === "string" ? sp.to : iso(today);

  const [totals, summary] = await Promise.all([
    getProductTotals(from, to),
    getRangeSummary(from, to),
  ]);

  const grandTotal = totals.reduce((s, t) => s + Number(t.total_cost ?? 0), 0);

  return (
    <div className="flex flex-col flex-1 bg-background p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={BarChart3}
          title="Production by product"
          subtitle="Total produced and what it cost, per SKU, over the days you have entered."
          actions={
            <Badge variant="outline" className="border-blue-200 bg-accent/60 text-foreground font-mono font-bold text-xs">
              {summary?.days ?? 0} day{summary?.days === 1 ? "" : "s"} in range
            </Badge>
          }
        />

        <form className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">From</span>
            <input type="date" name="from" defaultValue={from}
              className="rounded-lg border border-border bg-input/30 px-3 py-2 focus:border-primary focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">To</span>
            <input type="date" name="to" defaultValue={to}
              className="rounded-lg border border-border bg-input/30 px-3 py-2 focus:border-primary focus:outline-none" />
          </label>
          <button className="rounded-lg border border-border bg-white px-4 py-2 font-semibold text-foreground hover:bg-accent">
            Show
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Milk processed", value: `${formatNumber(summary?.milk ?? 0, 0)} L` },
            { label: "Shared costs", value: `₹${formatNumber(summary?.overhead ?? 0, 0)}` },
            { label: "Production cost", value: `₹${formatNumber(grandTotal, 0)}` },
            {
              label: "Cost per litre",
              value: summary?.milk
                ? `₹${formatNumber(grandTotal / Number(summary.milk), 2)}`
                : "—",
            },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border border-border bg-card px-4 py-4 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </div>
              <div className="num mt-1 text-[22px] font-black text-primary">{card.value}</div>
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-secondary text-[10px] font-mono uppercase tracking-wide text-tertiary-foreground">
                <th className="px-4 py-2 text-left font-bold">Product</th>
                <th className="px-3 py-2 text-right font-bold">Days</th>
                <th className="px-3 py-2 text-right font-bold">Total produced</th>
                <th className="px-3 py-2 text-right font-bold">Kg / L made</th>
                <th className="px-3 py-2 text-right font-bold">Milk used (L)</th>
                <th className="px-3 py-2 text-right font-bold">Avg cost / unit</th>
                <th className="px-3 py-2 text-right font-bold">Avg cost / kg</th>
                <th className="px-3 py-2 text-right font-bold">Lowest</th>
                <th className="px-3 py-2 text-right font-bold">Highest</th>
                <th className="px-3 py-2 text-right font-bold">Total cost ₹</th>
                <th className="px-3 py-2 text-right font-bold">Share</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t) => (
                <tr key={t.code} className="border-b border-border/70 hover:bg-muted">
                  <td className="px-4 py-1.5">{t.name}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{t.days}</td>
                  <td className="num px-3 py-1.5 text-right font-semibold">{formatNumber(t.qty, 0)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{formatNumber(t.product_kg, 1)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{formatNumber(t.milk_used, 0)}</td>
                  <td className="num px-3 py-1.5 text-right font-semibold">{formatNumber(t.avg_unit_cost, 2)}</td>
                  <td className="num px-3 py-1.5 text-right font-bold text-foreground">{formatNumber(t.avg_cost_per_kg, 2)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{formatNumber(t.min_unit_cost, 2)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{formatNumber(t.max_unit_cost, 2)}</td>
                  <td className="num px-3 py-1.5 text-right font-semibold">{formatNumber(t.total_cost, 0)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">
                    {grandTotal > 0 ? `${((Number(t.total_cost) / grandTotal) * 100).toFixed(1)}%` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totals.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              Nothing produced in this range yet. Enter a day under Daily production.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
