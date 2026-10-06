import { Grid3x3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/tanks/ui";
import { getChart, getCharts } from "@/lib/procurement/rate-chart";
import { formatNumber } from "@/lib/format";
import { kgPerLitre } from "@/lib/procurement/data";
import { perLitreToPerKg } from "@/lib/units";

export const dynamic = "force-dynamic";

/** The stored milk rate chart: ₹ per litre for every fat % (rows) and CLR (columns). */
export default async function RateChartPage({ searchParams }: PageProps<"/procurement/rate-chart">) {
  const { id, unit } = await searchParams;
  const perKg = unit === "kg";
  const k = await kgPerLitre();
  const charts = await getCharts();
  const chart = await getChart(typeof id === "string" ? { id } : {});

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Grid3x3}
          title="Rate chart"
          subtitle="What a litre of milk is paid at, by fat % and CLR. From the date a chart applies, every collection on Milk in is priced from it."
        />

        {!chart ? (
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-[13px]">
            No rate chart is stored yet. Load the revised chart with <code>npm run db:seed:rate-chart</code>.
          </div>
        ) : (
          <Section
            title={`${chart.name} · applies from ${chart.effective_from}`}
            description={`${perKg ? `₹ per kg (₹ per litre ÷ ${formatNumber(k, 2)} kg/L)` : "₹ per litre"}. Find the farmer's fat % down the side and CLR across the top. Fat is read to the nearest 0.1 and CLR to the nearest 0.5; readings outside fat ${chart.fats[0]}–${chart.fats[chart.fats.length - 1]} or CLR ${chart.clrs[0]}–${chart.clrs[chart.clrs.length - 1]} have no price. Before ${charts[charts.length - 1]?.effective_from}, prices are kept as the Vamaa app sent them.`}
            actions={
              <div className="flex flex-wrap items-center gap-3 text-[12px]">
                {charts.length > 1 ? (
                  <div className="flex gap-1">
                    {charts.map((c) => (
                      <a key={c.id} href={`?id=${c.id}${perKg ? "&unit=kg" : ""}`} className={`rounded-md px-2 py-1 font-semibold ${c.id === chart.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}>
                        from {c.effective_from}
                      </a>
                    ))}
                  </div>
                ) : null}
                <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
                  {[{ v: "L", label: "₹ / L" }, { v: "kg", label: "₹ / kg" }].map((u) => (
                    <a
                      key={u.v}
                      href={`?${typeof id === "string" ? `id=${id}&` : ""}unit=${u.v}`}
                      className={`rounded-md px-2.5 py-1 font-semibold ${(u.v === "kg") === perKg ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      {u.label}
                    </a>
                  ))}
                </div>
              </div>
            }
          >
            <div className="max-h-[70vh] overflow-auto">
              <table className="text-[12px]">
                <thead className="sticky top-0 z-10 bg-secondary">
                  <tr>
                    <th className="sticky left-0 z-20 bg-secondary px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-wide text-tertiary-foreground">
                      Fat % ↓ · CLR →
                    </th>
                    {chart.clrs.map((c) => (
                      <th key={c} className="num px-3 py-2 text-right font-semibold text-foreground">{formatNumber(c, 1)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="num">
                  {chart.fats.map((f) => (
                    <tr key={f} className="border-b border-border/60 hover:bg-muted/60">
                      <th className="sticky left-0 bg-card px-3 py-1 text-left font-semibold text-foreground">{formatNumber(f, 1)}</th>
                      {chart.clrs.map((c) => (
                        <td key={c} className="px-3 py-1 text-right text-foreground">
                          {formatNumber(perKg ? perLitreToPerKg(chart.cells[`${f.toFixed(1)}|${c.toFixed(1)}`], k) : chart.cells[`${f.toFixed(1)}|${c.toFixed(1)}`], 2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
