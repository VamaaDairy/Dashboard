import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CnDashboard } from "@/components/cn/CnDashboard";
import { CnPeriod } from "@/components/cn/CnPeriod";
import { listComplaints } from "@/lib/cn/data";
import { periodFrom } from "@/lib/dash/period";

export const dynamic = "force-dynamic";

/** Complaints registered in a period (default last 30 days): volume, TAT, value, repeats and CAPA. */
export default async function CnDashboardPage({ searchParams }: PageProps<"/cn/dashboard">) {
  const { from, to, today } = periodFrom(await searchParams);
  const all = await listComplaints();
  const inPeriod = all.filter((c) => c.complaint_date >= from && c.complaint_date <= to);
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <PageHeader icon={LayoutDashboard} title="CN Management · Dashboard" subtitle="Complaint volume, turnaround, credit note value, repeat complaints and CAPA follow-up." />
        <CnPeriod from={from} to={to} today={today} />
        <CnDashboard all={all} rows={inPeriod} today={today} />
      </div>
    </div>
  );
}
