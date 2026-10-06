import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FuelDashboard } from "@/components/dash/Dashboards";
import { getMilkProcessed, getPlantFuelUse, getTransportDays } from "@/lib/dash/data";
import { periodFrom } from "@/lib/dash/period";

export const dynamic = "force-dynamic";

/** Fuel and transport over a period: every transporter in both sections, and fuel burned in the plant. */
export default async function FuelDashboardPage({ searchParams }: PageProps<"/fuel/dashboard">) {
  const { from, to, today } = periodFrom(await searchParams);
  const [runs, plant, milk] = await Promise.all([getTransportDays(from, to), getPlantFuelUse(from, to), getMilkProcessed(from, to)]);
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader icon={LayoutDashboard} title="Fuel · Dashboard" subtitle="Milk to plant, delivery and fuel burned in the plant - by transporter and per litre of milk processed." />
        <FuelDashboard from={from} to={to} today={today} runs={runs} plant={plant} milk={milk} />
      </div>
    </div>
  );
}
