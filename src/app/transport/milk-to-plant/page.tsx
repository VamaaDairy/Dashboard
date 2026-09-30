import { Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TransporterList } from "@/components/transport/TransporterList";
import { getTransporters } from "@/lib/transport/data";

export const dynamic = "force-dynamic";

export default async function MilkToPlantPage() {
  const transporters = await getTransporters("milk_to_plant");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Truck}
          title="Transport · Milk to plant"
          subtitle="Transporters who bring milk in to the plant."
        />

        <TransporterList
          section="milk_to_plant"
          title="Milk to plant"
          description="Farmers' direct milk from the villages, and the plant's own transport bringing AB Dairy and Sai Dairy milk in together."
          transporters={transporters}
        />
      </div>
    </div>
  );
}
