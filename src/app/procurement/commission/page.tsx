import { HandCoins } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Centers } from "@/components/procurement/Centers";
import { getCenters, getRateCharts, getSachivEarnings } from "@/lib/procurement/data";

export const dynamic = "force-dynamic";

/**
 * An entry page: the centres and what each one earns. The commission totals
 * are on the procurement overview.
 */
export default async function CommissionPage() {
  const [centers, charts, earnings] = await Promise.all([
    getCenters(), getRateCharts(), getSachivEarnings(),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-white p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={HandCoins}
          title="Sachiv commission"
          subtitle="The societies collect the milk for us, and earn on what they hand over."
        />

        <Centers centers={centers} charts={charts} earnings={earnings} />
      </div>
    </div>
  );
}
