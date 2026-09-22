import { Cloud } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { VamaaDateNav } from "@/components/procurement/VamaaDateNav";
import { VamaaCollectionsTable, VamaaFarmersTable } from "@/components/procurement/VamaaData";
import { fetchCollections, fetchFarmers, type VamaaCollection, type VamaaFarmer } from "@/lib/vamaa/client";
import { kgPerLitre } from "@/lib/procurement/data";

export const dynamic = "force-dynamic";

export default async function VamaaPage({ params }: PageProps<"/procurement/vamaa/[date]">) {
  const { date } = await params;
  const shortName = process.env.VAMAA_CENTER_SHORT_NAME;

  let collections: VamaaCollection[] = [];
  let farmers: VamaaFarmer[] = [];
  let error: string | null = null;
  const k = await kgPerLitre();

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
          subtitle={`Straight from the mobile-dairy API for centre ${shortName ?? "—"} — nothing stored, nothing recalculated.`}
          actions={<VamaaDateNav date={date} />}
        />

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-red-700">
            {error}
          </div>
        ) : (
          <>
            <VamaaCollectionsTable date={date} rows={collections} kgPerLitre={k} />
            <VamaaFarmersTable rows={farmers} />
          </>
        )}
      </div>
    </div>
  );
}
