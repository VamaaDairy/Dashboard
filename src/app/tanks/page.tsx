import { Cylinder } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TankDayBoard } from "@/components/tanks/TankDayBoard";
import { getMovementsOnDate, getTanksOnDate } from "@/lib/tanks/data";
import { today } from "@/lib/dates";
import { kgPerLitre } from "@/lib/procurement/data";

export const dynamic = "force-dynamic";

export default async function TanksPage({ searchParams }: PageProps<"/tanks">) {
  const { date: raw } = await searchParams;
  const now = today();
  const date = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : now;

  const [days, movements, k] = await Promise.all([getTanksOnDate(date), getMovementsOnDate(date), kgPerLitre()]);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Cylinder}
          title="Tanks"
          subtitle="What's in each tank today, and its fat and SNF."
        />
        {/* keyed by date so the entry form starts fresh on each day */}
        <TankDayBoard key={date} date={date} today={now} days={days} movements={movements} kgPerLitre={k} />
      </div>
    </div>
  );
}
