import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TanksDashboard } from "@/components/dash/Dashboards";
import { getTankFlows, getTankLevels, getTankStock } from "@/lib/dash/data";
import { periodFrom } from "@/lib/dash/period";

export const dynamic = "force-dynamic";

/** Milk through the tanks over a period: what came in, from where, its blend and cost, and what production drew. */
export default async function TanksDashboardPage({ searchParams }: PageProps<"/tanks/dashboard">) {
  const { from, to, today } = periodFrom(await searchParams);
  const [flows, stock, levels] = await Promise.all([getTankFlows(from, to), getTankStock(to), getTankLevels(to)]);
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader icon={LayoutDashboard} title="Tanks · Dashboard" subtitle="Milk into and out of the tanks - farmers and tankers in, production out - with its fat, SNF and cost." />
        <TanksDashboard from={from} to={to} today={today} flows={flows} stock={stock} levels={levels} />
      </div>
    </div>
  );
}
