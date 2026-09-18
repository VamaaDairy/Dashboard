import Link from "next/link";
import { Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tankers } from "@/components/procurement/Tankers";
import { getBatches, getTrips, kgPerLitre } from "@/lib/procurement/data";

export const dynamic = "force-dynamic";

/**
 * An entry page: the trips, and what each carried. The spend they add up to is
 * on the procurement overview. The one number kept here is the count of
 * collections still on no tanker, because that is work outstanding rather than
 * analysis - those collections carry no transport cost until they are loaded.
 */
export default async function TransportPage() {
  const [trips, batches, k] = await Promise.all([getTrips(), getBatches(), kgPerLitre()]);

  const unloaded = batches.filter((b) => !b.trip_id).length;

  return (
    <div className="flex flex-1 flex-col bg-white p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Truck}
          title="Tanker to plant"
          subtitle="What it cost to bring the milk in, shared over the collections each tanker carried."
        />

        {unloaded > 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
            <strong className="font-bold">{unloaded}</strong>{" "}
            collection{unloaded === 1 ? " is" : "s are"} not on a tanker yet, so they carry no
            transport cost.{" "}
            <Link href="/procurement/farmer" className="font-semibold underline">
              Open collections
            </Link>
          </p>
        ) : null}

        <Tankers trips={trips} batches={batches} kgPerLitre={k} />
      </div>
    </div>
  );
}
