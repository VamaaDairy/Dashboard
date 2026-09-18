import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RateCharts } from "@/components/procurement/RateCharts";
import { Collections } from "@/components/procurement/Collections";
import { getBatches, getCenters, getRateCharts, getTrips, kgPerLitre } from "@/lib/procurement/data";

export const dynamic = "force-dynamic";

/**
 * An entry page: the rate chart you pay on, and the collections you took. The
 * totals this rolls up into live on the procurement overview rather than on
 * top of the fields you are typing into.
 */
export default async function FarmerPricePage() {
  const [charts, centers, batches, trips, k] = await Promise.all([
    getRateCharts(), getCenters(), getBatches(), getTrips(), kgPerLitre(),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-white p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Wallet}
          title="Price to the farmer"
          subtitle="Paid on the fat and SNF in the weight taken, never on the litres."
        />

        <RateCharts charts={charts} kgPerLitre={k} />
        <Collections
          batches={batches}
          centers={centers}
          charts={charts}
          trips={trips}
          kgPerLitre={k}
        />
      </div>
    </div>
  );
}
