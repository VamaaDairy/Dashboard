import { ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { OrdersView } from "@/components/whatsapp/OrdersView";

export const dynamic = "force-dynamic";

/** Every order placed over WhatsApp, with its items, payment, photos and review. */
export default async function OrdersPage({ searchParams }: PageProps<"/whatsapp/orders">) {
  const { o } = await searchParams;
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader icon={ShoppingBag} title="WhatsApp orders" subtitle="Orders customers placed in chat. Change the status here and they get a WhatsApp message." />
        <OrdersView initialId={typeof o === "string" && /^\d+$/.test(o) ? Number(o) : null} />
      </div>
    </div>
  );
}
