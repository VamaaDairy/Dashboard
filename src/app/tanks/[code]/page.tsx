import Link from "next/link";
import { notFound } from "next/navigation";
import { Cylinder } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TankDays } from "@/components/tanks/TankDays";
import { TankLedger } from "@/components/tanks/TankLedger";
import { getMovements, getTank, getTankDays, getTanksOnDate } from "@/lib/tanks/data";
import { today } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { kgPerLitre } from "@/lib/procurement/data";
import { kgOfSolid } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function TankPage({ params, searchParams }: PageProps<"/tanks/[code]">) {
  const { code } = await params;
  const { date: raw } = await searchParams;
  const tank = await getTank(code);
  if (!tank) notFound();

  const now = today();
  const date = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : now;
  const [movements, days, onDate, k] = await Promise.all([
    getMovements(tank.id),
    getTankDays(tank.id),
    getTanksOnDate(date).then((all) => all.find((d) => d.tank_id === tank.id)),
    kgPerLitre(),
  ]);

  const has = tank.qty_litre > 0.005;
  const kgFat = kgOfSolid(tank.qty_litre, tank.fat_pct, k);
  const kgSnf = kgOfSolid(tank.qty_litre, tank.snf_pct, k);
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Cylinder}
          title={tank.name}
          subtitle={
            `${formatNumber(tank.qty_litre, 1)} L in it now` +
            (tank.capacity_litre ? ` of ${formatNumber(tank.capacity_litre, 0)} L` : "") +
            (has
              ? ` · ${formatNumber(tank.fat_pct, 2)}% fat (${formatNumber(kgFat, 1)} kg)` +
                ` · ${formatNumber(tank.snf_pct, 2)}% SNF (${formatNumber(kgSnf, 1)} kg)` +
                ` · ₹${formatNumber(tank.cost_per_litre, 2)} / L · cost ₹${formatNumber(tank.qty_litre * tank.cost_per_litre, 0)}`
              : "")
          }
          actions={
            <Link href={`/tanks?date=${date}`} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              ← All tanks
            </Link>
          }
        />
        {/* keyed by date so the entry form starts fresh on each day */}
        <TankDays key={date} tank={tank} date={date} today={now} onDate={onDate} days={days} kgPerLitre={k} />
        <TankLedger tank={tank} movements={movements} kgPerLitre={k} />
      </div>
    </div>
  );
}
