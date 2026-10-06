import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MilkInDashboard } from "@/components/dash/Dashboards";
import { getMilkInDays, getMilkQuality } from "@/lib/dash/data";
import { periodFrom } from "@/lib/dash/period";

export const dynamic = "force-dynamic";

/** Milk collected over a period, every centre: litres, fat, SNF and price. */
export default async function MilkInDashboardPage({ searchParams }: PageProps<"/procurement/dashboard">) {
  const { from, to, today } = periodFrom(await searchParams);
  const [rows, quality] = await Promise.all([getMilkInDays(from, to), getMilkQuality(from, to)]);
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader icon={LayoutDashboard} title="Milk in · Dashboard" subtitle="What every centre collected - litres, fat, SNF and what it cost." />
        <MilkInDashboard from={from} to={to} today={today} rows={rows} quality={quality} />
      </div>
    </div>
  );
}
