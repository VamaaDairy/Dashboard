import { Cloud } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { VamaaDateNav } from "@/components/procurement/VamaaDateNav";
import { VamaaCollectionsTable, VamaaFarmersTable } from "@/components/procurement/VamaaData";
import { fetchCollections, fetchFarmers, type VamaaCollection, type VamaaFarmer } from "@/lib/vamaa/client";
import { kgPerLitre } from "@/lib/procurement/data";
import { getCollectionTanks, getTanks } from "@/lib/tanks/data";

export const dynamic = "force-dynamic";

export default async function VamaaPage({ params }: PageProps<"/procurement/vamaa/[date]">) {
  const { date } = await params;
  const shortName = process.env.VAMAA_CENTER_SHORT_NAME;

  let collections: VamaaCollection[] = [];
  let farmers: VamaaFarmer[] = [];
  let error: string | null = null;
  const [k, tanks, inTank] = await Promise.all([kgPerLitre(), getTanks(), getCollectionTanks(date)]);

  if (!shortName) {
    error = "VAMAA_CENTER_SHORT_NAME is not set in .env - nothing to fetch yet.";
  } else {
    try {
      [collections, farmers] = await Promise.all([
        fetchCollections(shortName, date),
        fetchFarmers(shortName),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Cloud}
          title="Vamaa live data"
          subtitle={`Straight from the mobile-dairy API for centre ${shortName ?? "—"}. Pick a tank on each collection to put it into that tank.`}
          actions={<VamaaDateNav date={date} />}
        />

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-red-700">
            {error}
          </div>
        ) : (
          <>
            <VamaaCollectionsTable
              date={date}
              rows={collections}
              kgPerLitre={k}
              tanks={tanks.filter((t) => t.is_active).map((t) => ({ id: t.id, name: t.name }))}
              inTank={inTank}
            />
            <VamaaFarmersTable rows={farmers} />
          </>
        )}
      </div>
    </div>
  );
}
