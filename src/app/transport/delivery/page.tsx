import { Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TransporterList } from "@/components/transport/TransporterList";
import { getTransporters } from "@/lib/transport/data";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const transporters = await getTransporters("delivery");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Truck}
          title="Transport · Delivery outside plant"
          subtitle="Transporters who take finished goods out of the plant to market."
        />

        <TransporterList
          section="delivery"
          title="Delivery outside plant"
          description="Everyone who carries goods from the plant to customers and markets."
          transporters={transporters}
        />
      </div>
    </div>
  );
}
