import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MilkInDashboard, MilkTransport } from "@/components/dash/Dashboards";
import { getFarmerTransport, getMilkInDays, getMilkQuality, getTransportDays } from "@/lib/dash/data";
import { periodFrom } from "@/lib/dash/period";

export const dynamic = "force-dynamic";

/** Milk collected over a period, every centre: litres, fat, SNF and price. */
export default async function MilkInDashboardPage({ searchParams }: PageProps<"/procurement/dashboard">) {
  const { from, to, today } = periodFrom(await searchParams);
  const [rows, quality, transport, runs] = await Promise.all([
    getMilkInDays(from, to), getMilkQuality(from, to), getFarmerTransport(from, to), getTransportDays(from, to),
  ]);
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader icon={LayoutDashboard} title="Milk in · Dashboard" subtitle="What every centre collected - litres, fat, SNF, what it cost, and the transport that brought it in, shared equally per farmer." />
        <MilkInDashboard from={from} to={to} today={today} rows={rows} quality={quality} />
        <MilkTransport from={from} to={to} rows={transport} runs={runs} />
      </div>
    </div>
  );
}
