import { Fuel } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DailyCostTable } from "@/components/DailyCostTable";
import { getDailyCostDays } from "@/lib/daily/data";

export const dynamic = "force-dynamic";

const COLUMNS = [{ code: "fuel_production", label: "Production in plant fuel" }] as const;

/** Fuel burned inside the plant. No transporters here, just the day's amount. */
export default async function ProductionFuelPage() {
  const days = await getDailyCostDays(COLUMNS.map((c) => c.code));

  return (
    <div className="flex flex-col flex-1 bg-background p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Fuel}
          title="Fuel · Production in plant"
          subtitle="Fuel used inside the plant for production, day by day. Divided across that day's production by milk processed."
        />
        <DailyCostTable days={days} columns={COLUMNS} />
      </div>
    </div>
  );
}
