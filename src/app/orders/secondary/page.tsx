import { ShoppingCart } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";
import { TradePanel } from "@/components/orders/TradePanel";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: SP }) {
  return (
    <SectionShell icon={ShoppingCart} title="Secondary orders" subtitle="Retailer orders booked by the field force. Delivered orders take stock out.">
      <TradePanel kind="secondary" path="/orders/secondary" sp={await params(searchParams)} />
    </SectionShell>
  );
}
