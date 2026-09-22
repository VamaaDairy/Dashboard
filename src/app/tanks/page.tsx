import { Cylinder } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TankList } from "@/components/tanks/TankList";
import { getTanks } from "@/lib/tanks/data";

export const dynamic = "force-dynamic";

export default async function TanksPage() {
  const tanks = await getTanks();

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Cylinder}
          title="Tanks"
          subtitle="What's sitting in each tank, and its weighted-average fat, SNF and cost after everything poured in and drawn out."
        />

        <TankList tanks={tanks} />
      </div>
    </div>
  );
}
