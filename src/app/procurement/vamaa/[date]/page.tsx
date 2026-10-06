import { Cloud } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { VamaaDateNav } from "@/components/procurement/VamaaDateNav";
import { VamaaCollectionsTable } from "@/components/procurement/VamaaData";
import { kgPerLitre } from "@/lib/procurement/data";
import { getCollectionTanks, getTanks } from "@/lib/tanks/data";
import { centers, ensureDays, storedCollections, storedFarmers } from "@/lib/vamaa/sync";
import { collectionPrice, getChart, getCharts } from "@/lib/procurement/rate-chart";
import { collectionRef } from "@/lib/vamaa/keys";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

/** One day's milk from every centre - farmers' collections and any tankers - saved from the Vamaa app. */
export default async function VamaaPage({ params }: PageProps<"/procurement/vamaa/[date]">) {
  const { date } = await params;
  const [k, tanks, inTank, centreList] = await Promise.all([kgPerLitre(), getTanks(), getCollectionTanks(date), centers()]);

  // Read from the local database; the app is only asked for centre-days that aren't stored (or are recent and stale).
  let notice: string | null = null;
  try {
    await ensureDays(date, date);
  } catch (e) {
    notice = `Couldn't reach the Vamaa app, so this shows what's saved locally: ${e instanceof Error ? e.message : String(e)}`;
  }
  const [collections, farmers] = await Promise.all([storedCollections(date), storedFarmers()]);

  // Prices: the rate chart on a day one is in force, otherwise as the app sent them.
  // A tanker's price isn't the farmer chart (and the app only sends a placeholder), so it has none yet.
  const [chart, charts] = await Promise.all([getChart({ date }), getCharts()]);
  const chartFrom = charts.length ? charts[charts.length - 1].effective_from : null;
  const tankerCentres = new Set(centreList.filter((c) => c.kind === "tanker").map((c) => c.center));
  const prices = Object.fromEntries(collections.map((r) => [
    collectionRef(r, date),
    tankerCentres.has(r.center_code) ? { rate: null, amount: null, source: null } : collectionPrice(chart, r),
  ]));

  const names = Object.fromEntries(farmers.map((f) => [
    `${f.center}|${f.code}`, f.name_en || [f.first_name, f.last_name].filter(Boolean).join(" "),
  ]));
  const centreNames = Object.fromEntries(centreList.map((c) => [c.center, c.name]));
  const perCentre = centreList.map((c) => {
    const rows = collections.filter((r) => r.center_code === c.center);
    return { ...c, records: rows.length, litres: rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0) };
  });

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Cloud}
          title="Milk in"
          subtitle="Every centre's milk for the day - farmers' collections and tankers - saved from the Vamaa app. Pick a tank on each to put it into that tank."
          actions={<VamaaDateNav date={date} />}
        />

        {notice ? (
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-[13px] font-semibold text-foreground">
            {notice}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {perCentre.map((c) => (
            <div key={c.center} className={`rounded-lg border border-border bg-card px-4 py-2.5 shadow-xs ${c.records ? "" : "opacity-60"}`}>
              <div className="text-[11px] font-medium text-muted-foreground">{c.name} · {c.center}{c.kind === "tanker" ? " · tanker" : ""}</div>
              <div className="mt-0.5 text-[15px] font-bold text-foreground">
                {c.records ? `${formatNumber(c.litres, 1)} L` : "nothing"}
                {c.records ? <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{c.records} record{c.records > 1 ? "s" : ""}</span> : null}
              </div>
            </div>
          ))}
        </div>

        <VamaaCollectionsTable
          date={date}
          rows={collections}
          kgPerLitre={k}
          tanks={tanks.filter((t) => t.is_active).map((t) => ({ id: t.id, name: t.name }))}
          inTank={inTank}
          prices={prices}
          chartFrom={chartFrom}
          names={names}
          centreNames={centreNames}
          tankerCentres={[...tankerCentres]}
        />
      </div>
    </div>
  );
}
