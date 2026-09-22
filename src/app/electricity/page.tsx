import { Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DailyCostTable } from "@/components/DailyCostTable";
import { getDailyCostDays } from "@/lib/daily/data";

export const dynamic = "force-dynamic";

const COLUMNS = [{ code: "electricity", label: "Electricity" }] as const;

export default async function ElectricityPage() {
  const days = await getDailyCostDays(COLUMNS.map((c) => c.code));

  return (
    <div className="flex flex-col flex-1 bg-background p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Zap}
          title="Electricity"
          subtitle="Electricity cost, day by day. Divided across that day's production by milk processed."
        />
        <DailyCostTable days={days} columns={COLUMNS} />
      </div>
    </div>
  );
}
