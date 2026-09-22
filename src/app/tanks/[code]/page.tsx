import Link from "next/link";
import { notFound } from "next/navigation";
import { Cylinder } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TankLedger } from "@/components/tanks/TankLedger";
import { getMovements, getTank } from "@/lib/tanks/data";

export const dynamic = "force-dynamic";

export default async function TankPage({ params }: PageProps<"/tanks/[code]">) {
  const { code } = await params;
  const tank = await getTank(code);
  if (!tank) notFound();

  const movements = await getMovements(tank.id);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Cylinder}
          title={tank.name}
          subtitle={`${tank.qty_litre.toLocaleString("en-IN")} L on hand · ${tank.fat_pct.toFixed(2)}% fat · ${tank.snf_pct.toFixed(2)}% SNF · ₹${tank.cost_per_litre.toFixed(3)}/L`}
          actions={
            <Link href="/tanks" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              ← All tanks
            </Link>
          }
        />

        <TankLedger tank={tank} movements={movements} />
      </div>
    </div>
  );
}
