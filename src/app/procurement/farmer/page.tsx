import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleNav } from "@/components/procurement/ModuleNav";
import { RateCharts } from "@/components/procurement/RateCharts";
import { Collections } from "@/components/procurement/Collections";
import { Stat } from "@/components/procurement/ui";
import { formatOrDash } from "@/lib/format";
import {
  getBatches, getCenters, getProcurementTotals, getRateCharts, getTrips, kgPerLitre,
} from "@/lib/procurement/data";

export const dynamic = "force-dynamic";

export default async function FarmerPricePage() {
  const [charts, centers, batches, trips, totals, k] = await Promise.all([
    getRateCharts(), getCenters(), getBatches(), getTrips(), getProcurementTotals(), kgPerLitre(),
  ]);

  const farmer = totals?.farmer_amount ?? 0;

  return (
    <div className="flex flex-1 flex-col bg-white p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Wallet}
          title="Price to the farmer"
          subtitle="We take delivery of a weight and pay for the solids in it — the fat and the SNF, never the litres."
        />

        <ModuleNav />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Paid to farmers"
            value={farmer}
            prefix="₹"
            decimals={0}
            tone="accent"
            hint={`${totals?.batch_count ?? 0} collections`}
          />
          <Stat
            label="Per kg of milk"
            value={totals?.qty_kg ? farmer / totals.qty_kg : null}
            prefix="₹"
            hint={`₹${formatOrDash(
              totals?.qty_litre ? farmer / totals.qty_litre : null, 2)} per litre at ${formatOrDash(k, 2)} kg/L`}
          />
          <Stat
            label="Per kg of solids"
            value={totals?.kg_solids ? farmer / totals.kg_solids : null}
            prefix="₹"
            hint="what the rate chart is really paying"
          />
          <Stat
            label="Solids bought"
            value={totals?.kg_solids}
            decimals={0}
            suffix="kg"
            hint={`${formatOrDash(totals?.fat_pct ?? null, 2)}% fat · ${formatOrDash(
              totals?.snf_pct ?? null, 2)}% SNF on ${formatOrDash(totals?.qty_kg ?? null, 0)} kg`}
          />
        </div>

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
