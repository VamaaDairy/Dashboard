import { Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TransporterList } from "@/components/transport/TransporterList";
import { getDeliveryRoutes, getTransporters, getVehicles } from "@/lib/transport/data";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const [transporters, vehicles, routes] = await Promise.all([getTransporters("delivery"), getVehicles("delivery"), getDeliveryRoutes()]);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Truck}
          title="Transport · Delivery outside plant"
          subtitle="Transporters who take finished goods out of the plant to market, their vehicles, and the routes each one runs."
        />

        <TransporterList
          section="delivery"
          title="Delivery outside plant"
          description="Everyone who carries goods from the plant to customers and markets."
          transporters={transporters}
          vehicles={vehicles}
          routes={routes}
        />
      </div>
    </div>
  );
}
