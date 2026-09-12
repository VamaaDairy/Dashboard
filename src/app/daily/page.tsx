import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { NewDayForm } from "@/components/NewDayForm";
import { formatNumber } from "@/lib/format";
import { getDays } from "@/lib/daily/data";

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const days = await getDays();

  return (
    <div className="flex flex-col flex-1 bg-white p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={CalendarDays}
          title="Daily production cost"
          subtitle="One row per day: milk processed, what the plant spent, and what that made each product cost."
        />

        <NewDayForm />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F8FAFD] text-[10px] uppercase tracking-wider text-[#2B4C86]">
                <th className="px-4 py-2 text-left font-bold">Date</th>
                <th className="px-3 py-2 text-right font-bold">Milk processed (L)</th>
                <th className="px-3 py-2 text-right font-bold">Shared cost ₹</th>
                <th className="px-3 py-2 text-right font-bold">Conversion ₹/L</th>
                <th className="px-3 py-2 text-right font-bold">Products</th>
                <th className="px-3 py-2 text-right font-bold">Production cost ₹</th>
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
                  <td className="num px-3 py-1.5 text-right">{formatNumber(d.milk_processed_l, 1)}</td>
                  <td className="num px-3 py-1.5 text-right">{formatNumber(d.total_overhead, 2)}</td>
                  <td className="num px-3 py-1.5 text-right font-semibold text-[#3E5FA0]">
                    {formatNumber(d.conversion_rate, 4)}
                  </td>
                  <td className="num px-3 py-1.5 text-right text-slate-500">{d.products_made}</td>
                  <td className="num px-3 py-1.5 text-right font-semibold">
                    {formatNumber(d.total_production_cost, 2)}
                  </td>
                  <td className="num px-3 py-1.5 text-right">{formatNumber(d.cost_per_litre, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {days.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-slate-500">
              No days recorded yet. Add today above to get started.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
