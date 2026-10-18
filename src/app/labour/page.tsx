import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LabourDay } from "@/components/daily/HeadDayEntry";
import { getHeadDay, getHeadDays, getLabourRates, getLabourShifts } from "@/lib/daily/heads";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Labour day by day: how many labourers worked and the total paid. */
export default async function LabourPage({ searchParams }: PageProps<"/labour">) {
  const { date: raw } = await searchParams;
  const now = today();
  const date = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : now;
  const [entry, history, shifts, rates] = await Promise.all([getHeadDay("labour", date), getHeadDays("labour"), getLabourShifts(), getLabourRates()]);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full max-w-5xl space-y-5">
        <PageHeader
          icon={Users}
          title="Labour"
          subtitle="Day, night and contract labour each day. Divided across that day's production by milk processed."
        />
        {/* keyed by date so the entry starts from that day's saved values */}
        <LabourDay key={date} date={date} today={now} entry={entry} history={history} shifts={shifts} rates={rates} />
      </div>
    </div>
  );
}
