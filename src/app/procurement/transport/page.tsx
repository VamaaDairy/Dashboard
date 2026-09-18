import { Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleNav } from "@/components/procurement/ModuleNav";
import { Tankers } from "@/components/procurement/Tankers";
import { Stat } from "@/components/procurement/ui";
import { formatOrDash } from "@/lib/format";
import { getBatches, getProcurementTotals, getTrips, kgPerLitre } from "@/lib/procurement/data";

export const dynamic = "force-dynamic";

export default async function TransportPage() {
  const [trips, batches, totals, k] = await Promise.all([
    getTrips(), getBatches(), getProcurementTotals(), kgPerLitre(),
  ]);

  const transport = totals?.transport_amount ?? 0;
  const shortage = trips.reduce((t, r) => t + (Number(r.shortage_kg) || 0), 0);
  const unloaded = batches.filter((b) => !b.trip_id).length;

  return (
    <div className="flex flex-1 flex-col bg-white p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Truck}
          title="Tanker to plant"
          subtitle="What it cost to bring the milk in, shared over the collections each tanker carried."
        />

        <ModuleNav />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Transport spend"
            value={transport}
            prefix="₹"
            decimals={0}
            tone="accent"
            hint={`${trips.length} trip${trips.length === 1 ? "" : "s"}`}
          />
          <Stat
            label="Per litre landed"
            value={totals?.landed_litre ? transport / totals.landed_litre : null}
            prefix="₹"
            decimals={3}
            hint={`₹${formatOrDash(
              totals?.landed_kg ? transport / totals.landed_kg : null, 3)} per kg at ${formatOrDash(k, 2)} kg/L`}
          />
          <Stat
            label="Transit shortage"
            value={shortage}
            decimals={1}
            suffix="kg"
            tone={shortage > 0 ? "plain" : "muted"}
            hint={
              shortage > 0
                ? `${formatOrDash(shortage / k, 1)} L lost — its cost rides on the milk that arrived`
                : "loaded weight matched dock weight"
            }
          />
          <Stat
            label="Waiting to be loaded"
            value={unloaded}
            decimals={0}
            suffix={unloaded === 1 ? "collection" : "collections"}
            tone={unloaded > 0 ? "plain" : "muted"}
            hint={unloaded > 0 ? "these carry no transport cost yet" : "every collection is on a tanker"}
          />
        </div>

        <Tankers trips={trips} batches={batches} kgPerLitre={k} />
      </div>
    </div>
  );
}
