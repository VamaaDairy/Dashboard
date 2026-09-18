import { HandCoins } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleNav } from "@/components/procurement/ModuleNav";
import { Centers } from "@/components/procurement/Centers";
import { Stat } from "@/components/procurement/ui";
import { formatOrDash } from "@/lib/format";
import {
  getCenters, getProcurementTotals, getRateCharts, getSachivEarnings, kgPerLitre,
} from "@/lib/procurement/data";

export const dynamic = "force-dynamic";

export default async function CommissionPage() {
  const [centers, charts, earnings, totals, k] = await Promise.all([
    getCenters(), getRateCharts(), getSachivEarnings(), getProcurementTotals(), kgPerLitre(),
  ]);

  const commission = totals?.commission_amount ?? 0;
  const farmer = totals?.farmer_amount ?? 0;

  return (
    <div className="flex flex-1 flex-col bg-white p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={HandCoins}
          title="Sachiv commission"
          subtitle="The societies collect the milk for us, and earn on what they hand over."
        />

        <ModuleNav />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Commission payable"
            value={commission}
            prefix="₹"
            decimals={0}
            tone="accent"
            hint={`across ${centers.filter((c) => c.is_active).length} active centre(s)`}
          />
          <Stat
            label="Per kg collected"
            value={totals?.qty_kg ? commission / totals.qty_kg : null}
            prefix="₹"
            decimals={3}
            hint={`₹${formatOrDash(
              totals?.qty_litre ? commission / totals.qty_litre : null, 3)} per litre at ${formatOrDash(k, 2)} kg/L`}
          />
          <Stat
            label="Share of farmer payout"
            value={farmer > 0 ? (commission / farmer) * 100 : null}
            suffix="%"
            hint={`on ₹${formatOrDash(farmer, 0)} paid to farmers`}
          />
          <Stat
            label="Share of landed cost"
            value={totals?.total_cost ? (commission / totals.total_cost) * 100 : null}
            suffix="%"
            hint="of what a litre costs in the silo"
          />
        </div>

        <Centers centers={centers} charts={charts} earnings={earnings} />
      </div>
    </div>
  );
}
