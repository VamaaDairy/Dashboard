import Link from "next/link";
import { ArrowRight, CalendarDays, Droplets, Home } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { NewDayForm } from "@/components/NewDayForm";
import { formatNumber } from "@/lib/format";
import { getClasses } from "@/lib/data";
import { getDays } from "@/lib/daily/data";
import { getDays as getProcurementDays } from "@/lib/procurement/data";

export const dynamic = "force-dynamic";

/**
 * The landing page is the day's work, not the cost model. Two jobs get done
 * here every day - milk comes in, and product goes out - so each is one card
 * with today's state on it and one button into it. Everything else about the
 * model is a click away in the sidebar, not spread across this page.
 */
export default async function TodayPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [days, procurementDays, classes] = await Promise.all([
    getDays(14), getProcurementDays(14), getClasses(),
  ]);

  const todayProduction = days.find((d) => d.day === today) ?? null;
  const todayMilk = procurementDays.find((d) => d.collected_on === today) ?? null;
  const pretty = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="flex flex-col flex-1 bg-background p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader icon={Home} title="Today" subtitle={pretty} />

        {/* Nothing has been defined yet - say so once, here, with the way in. */}
        {classes.length === 0 ? (
          <div className="rounded-lg border border-primary/30 bg-accent px-5 py-4">
            <h2 className="font-bold text-foreground">Set up what you make</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              There are no products or rates in here yet. Define the kinds of things you cost and
              the columns they carry, then production entry has something to record against.
            </p>
            <Link
              href="/schema"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 font-semibold text-foreground hover:bg-accent"
            >
              Open setup
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {/* ---------------- milk in ---------------- */}
          <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 text-foreground">
              <Droplets className="h-4 w-4" />
              <h2 className="font-bold">Milk in</h2>
            </div>

            {todayMilk ? (
              <>
                <div className="num mt-3 text-[30px] font-black leading-none text-foreground">
                  {formatNumber(todayMilk.qty_litre, 0)}
                  <span className="ml-1 text-sm font-bold text-muted-foreground">litres</span>
                </div>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  {todayMilk.batch_count} collection(s) from {todayMilk.center_count} centre(s)
                  {todayMilk.landed_per_litre
                    ? ` · ₹${formatNumber(todayMilk.landed_per_litre, 2)} landed per litre`
                    : ""}
                </p>
              </>
            ) : (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Nothing collected today yet.
              </p>
            )}

            <Link
              href="/procurement/vamaa"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 font-semibold text-foreground hover:bg-accent"
            >
              {todayMilk ? "Open collections" : "View collections"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          {/* ---------------- production out ---------------- */}
          <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 text-foreground">
              <CalendarDays className="h-4 w-4" />
              <h2 className="font-bold">Production</h2>
            </div>

            {todayProduction ? (
              <>
                <div className="num mt-3 text-[30px] font-black leading-none text-foreground">
                  {formatNumber(todayProduction.milk_processed_l, 0)}
                  <span className="ml-1 text-sm font-bold text-muted-foreground">litres processed</span>
                </div>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  {todayProduction.products_made} product(s)
                  {todayProduction.cost_per_litre
                    ? ` · ₹${formatNumber(todayProduction.cost_per_litre, 2)} per litre`
                    : ""}
                </p>
                <Link
                  href={`/daily/${todayProduction.day}`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 font-semibold text-foreground hover:bg-accent"
                >
                  Open today
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <p className="mt-3 text-[13px] text-muted-foreground">
                  Today has not been started. Enter the milk processed to open it.
                </p>
                <div className="mt-4">
                  <NewDayForm bare cta="Start today" />
                </div>
              </>
            )}
          </section>
        </div>

        {/* ---------------- the last two weeks, four columns, nothing more ---------------- */}
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-bold text-foreground">Recent days</h2>
            <Link href="/reports" className="text-[12px] font-semibold text-foreground hover:underline">
              Cost by product →
            </Link>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-secondary text-[10px] font-mono uppercase tracking-wide text-tertiary-foreground">
                <th className="px-4 py-2 text-left font-bold">Date</th>
                <th className="px-3 py-2 text-right font-bold">Milk (L)</th>
                <th className="px-3 py-2 text-right font-bold">Products</th>
                <th className="px-3 py-2 text-right font-bold">Cost ₹/L</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day_id} className="border-b border-border/70 hover:bg-muted">
                  <td className="px-4 py-1.5">
                    <Link href={`/daily/${d.day}`} className="font-semibold text-foreground hover:underline">
                      {d.day}
                    </Link>
                  </td>
                  <td className="num px-3 py-1.5 text-right">{formatNumber(d.milk_processed_l, 0)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{d.products_made}</td>
                  <td className="num px-3 py-1.5 text-right font-semibold">
                    {formatNumber(d.cost_per_litre, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {days.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              No days recorded yet.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
