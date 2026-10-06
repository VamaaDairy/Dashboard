import { Fuel } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PlantFuelDay } from "@/components/fuel/PlantFuelDay";
import { getPlantFuelDay, getPlantFuelHistory, getPlantFuelRates, getPlantFuels } from "@/lib/fuel/plant";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Fuel burned in the plant - coal, and any other fuel added below it - day by day. */
export default async function ProductionFuelPage({ searchParams }: PageProps<"/fuel/production">) {
  const { date: raw } = await searchParams;
  const now = today();
  const date = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : now;
  const [entry, fuels, rates, history] = await Promise.all([getPlantFuelDay(date), getPlantFuels(), getPlantFuelRates(), getPlantFuelHistory()]);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full max-w-5xl space-y-5">
        <PageHeader
          icon={Fuel}
          title="Fuel · Production in plant"
          subtitle="Coal and any other fuel burned in the plant each day. Enter the quantity; each fuel keeps its price until you change it."
        />
        {/* keyed by date so the entry starts from that day's saved values */}
        <PlantFuelDay key={date} date={date} today={now} entry={entry} fuels={fuels} rates={rates} history={history} />
      </div>
    </div>
  );
}
