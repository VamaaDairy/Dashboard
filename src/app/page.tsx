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
    <div className="flex flex-col flex-1 bg-white p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader icon={Home} title="Today" subtitle={pretty} />

        {/* Nothing has been defined yet - say so once, here, with the way in. */}
        {classes.length === 0 ? (
          <div className="rounded-2xl border border-[#4A6FA5]/30 bg-[#F2F6FD] px-5 py-4">
            <h2 className="font-bold text-[#2B4C86]">Set up what you make</h2>
            <p className="mt-1 text-[13px] text-slate-600">
              There are no products or rates in here yet. Define the kinds of things you cost and
              the columns they carry, then production entry has something to record against.
            </p>
            <Link
              href="/schema"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#4A6FA5] px-4 py-2 font-semibold text-white hover:bg-[#3E5FA0]"
            >
              Open setup
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {/* ---------------- milk in ---------------- */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[#2B4C86]">
              <Droplets className="h-4 w-4" />
              <h2 className="font-bold">Milk in</h2>
            </div>

            {todayMilk ? (
              <>
                <div className="num mt-3 text-[30px] font-black leading-none text-slate-800">
                  {formatNumber(todayMilk.qty_litre, 0)}
                  <span className="ml-1 text-sm font-bold text-slate-400">litres</span>
                </div>
                <p className="mt-1.5 text-[12px] text-slate-500">
                  {todayMilk.batch_count} collection(s) from {todayMilk.center_count} centre(s)
                  {todayMilk.landed_per_litre
                    ? ` · ₹${formatNumber(todayMilk.landed_per_litre, 2)} landed per litre`
                    : ""}
                </p>
              </>
            ) : (
              <p className="mt-3 text-[13px] text-slate-500">
                Nothing collected today yet.
              </p>
            )}

            <Link
              href="/procurement/farmer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#4A6FA5] px-4 py-2 font-semibold text-white hover:bg-[#3E5FA0]"
            >
              {todayMilk ? "Add collections" : "Record collections"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          {/* ---------------- production out ---------------- */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[#2B4C86]">
              <CalendarDays className="h-4 w-4" />
              <h2 className="font-bold">Production</h2>
            </div>

            {todayProduction ? (
              <>
                <div className="num mt-3 text-[30px] font-black leading-none text-slate-800">
                  {formatNumber(todayProduction.milk_processed_l, 0)}
                  <span className="ml-1 text-sm font-bold text-slate-400">litres processed</span>
                </div>
                <p className="mt-1.5 text-[12px] text-slate-500">
                  {todayProduction.products_made} product(s)
                  {todayProduction.cost_per_litre
                    ? ` · ₹${formatNumber(todayProduction.cost_per_litre, 2)} per litre`
                    : ""}
                </p>
                <Link
                  href={`/daily/${todayProduction.day}`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#4A6FA5] px-4 py-2 font-semibold text-white hover:bg-[#3E5FA0]"
                >
                  Open today
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <p className="mt-3 text-[13px] text-slate-500">
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
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="font-bold text-slate-700">Recent days</h2>
            <Link href="/reports" className="text-[12px] font-semibold text-[#2B4C86] hover:underline">
              Cost by product →
            </Link>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F8FAFD] text-[10px] uppercase tracking-wider text-[#2B4C86]">
                <th className="px-4 py-2 text-left font-bold">Date</th>
                <th className="px-3 py-2 text-right font-bold">Milk (L)</th>
                <th className="px-3 py-2 text-right font-bold">Products</th>
                <th className="px-3 py-2 text-right font-bold">Cost ₹/L</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day_id} className="border-b border-slate-100 hover:bg-blue-50/40">
                  <td className="px-4 py-1.5">
                    <Link href={`/daily/${d.day}`} className="font-semibold text-[#2B4C86] hover:underline">
                      {d.day}
                    </Link>
                  </td>
                  <td className="num px-3 py-1.5 text-right">{formatNumber(d.milk_processed_l, 0)}</td>
                  <td className="num px-3 py-1.5 text-right text-slate-500">{d.products_made}</td>
                  <td className="num px-3 py-1.5 text-right font-semibold">
                    {formatNumber(d.cost_per_litre, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {days.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-slate-500">
              No days recorded yet.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
