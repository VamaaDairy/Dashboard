import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PeriodBar } from "@/components/dash/Dash";
import { periodFrom } from "@/lib/dash/period";
import { cell, REPORTS, reportOf } from "@/lib/d2c/reports";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** D2C sales reports: one table per view (product, category, date, customer, payment, area) over a period. */
export default async function D2cReportPage({ params, searchParams }: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const def = reportOf((await params).kind);
  if (!def) notFound();
  const { from, to, today } = periodFrom(await searchParams);
  const rows = await def.load(from, to);
  const range = `from=${from}&to=${to}`;
  const totals = Object.fromEntries(def.cols.filter((c) => c.total).map((c) => [c.key, rows.reduce((s, r) => s + Number(r[c.key] ?? 0), 0)]));
  const right = (kind: string) => kind === "int" || kind === "money";

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <PageHeader
          icon={FileBarChart}
          title={`Sales report · ${def.label}`}
          subtitle={def.description}
          actions={
            <a href={`/d2c/reports/${def.key}/export?${range}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <Download className="h-4 w-4" /> Download CSV
            </a>
          }
        />
        <div className="flex flex-wrap gap-1.5 text-sm">
          {REPORTS.map((r) => (
            <Link
              key={r.key}
              href={`/d2c/reports/${r.key}?${range}`}
              className={cn("rounded-full border px-3 py-1", r.key === def.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
            >
              {r.label}
            </Link>
          ))}
        </div>
        <PeriodBar from={from} to={to} today={today} />

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {def.cols.map((c) => (
                  <th key={c.key} className={cn("whitespace-nowrap px-3 py-2 font-semibold", right(c.kind) && "text-right")}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/40">
                  {def.cols.map((c) => (
                    <td key={c.key} className={cn("whitespace-nowrap px-3 py-2", right(c.kind) && "num text-right", c.kind === "mono" && "font-mono text-xs")}>
                      {def.key === "customers" && c.key === "name" && r.id ? (
                        <Link href={`/d2c/customers/${r.id}`} className="font-medium text-primary hover:underline">{cell(c.kind, r[c.key])}</Link>
                      ) : (
                        cell(c.kind, r[c.key])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={def.cols.length} className="px-3 py-10 text-center text-muted-foreground">No sales in this period.</td></tr>
              ) : (
                <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                  {def.cols.map((c, i) => (
                    <td key={c.key} className={cn("whitespace-nowrap px-3 py-2", right(c.kind) && "num text-right")}>
                      {i === 0 ? `Total · ${rows.length} ${rows.length === 1 ? "row" : "rows"}` : c.total ? cell(c.kind, totals[c.key]) : ""}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
