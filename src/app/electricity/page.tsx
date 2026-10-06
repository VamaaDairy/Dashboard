import { Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ElectricityDay } from "@/components/daily/HeadDayEntry";
import { getElectricityRates, getHeadDay, getHeadDays } from "@/lib/daily/heads";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Electricity day by day: units used, at the price per unit in force that day. */
export default async function ElectricityPage({ searchParams }: PageProps<"/electricity">) {
  const { date: raw } = await searchParams;
  const now = today();
  const date = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : now;
  const [entry, rates, history] = await Promise.all([getHeadDay("electricity", date), getElectricityRates(), getHeadDays("electricity")]);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full max-w-5xl space-y-5">
        <PageHeader
          icon={Zap}
          title="Electricity"
          subtitle="Units used each day at the price per unit. Divided across that day's production by milk processed."
        />
        {/* keyed by date so the entry starts from that day's saved values */}
        <ElectricityDay key={date} date={date} today={now} entry={entry} rates={rates} history={history} />
      </div>
    </div>
  );
}
