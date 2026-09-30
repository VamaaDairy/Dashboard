import { Cloud } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { VamaaDateNav } from "@/components/procurement/VamaaDateNav";
import { VamaaCollectionsTable } from "@/components/procurement/VamaaData";
import { kgPerLitre } from "@/lib/procurement/data";
import { getCollectionTanks, getTanks } from "@/lib/tanks/data";
import { ensureDays, storedCollections } from "@/lib/vamaa/sync";

export const dynamic = "force-dynamic";

export default async function VamaaPage({ params }: PageProps<"/procurement/vamaa/[date]">) {
  const { date } = await params;
  const shortName = process.env.VAMAA_CENTER_SHORT_NAME;
  const [k, tanks, inTank] = await Promise.all([kgPerLitre(), getTanks(), getCollectionTanks(date)]);

  // Read from the local database; the app is only asked for a day that isn't stored (or is recent and stale).
  let notice: string | null = null;
  if (!shortName) {
    notice = "VAMAA_CENTER_SHORT_NAME is not set in .env - nothing to show yet.";
  } else {
    try {
      await ensureDays(date, date);
    } catch (e) {
      notice = `Couldn't reach the Vamaa app, so this shows what's saved locally: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  const collections = shortName ? await storedCollections(date) : [];

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Cloud}
          title="Milk in"
          subtitle={`Collections at centre ${shortName ?? "—"}, saved from the Vamaa app. Pick a tank on each collection to put it into that tank.`}
          actions={<VamaaDateNav date={date} />}
        />

        {notice ? (
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-[13px] font-semibold text-foreground">
            {notice}
          </div>
        ) : null}

        <VamaaCollectionsTable
          date={date}
          rows={collections}
          kgPerLitre={k}
          tanks={tanks.filter((t) => t.is_active).map((t) => ({ id: t.id, name: t.name }))}
          inTank={inTank}
        />
      </div>
    </div>
  );
}
