import { PackagePlus } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";
import { TradePanel } from "@/components/orders/TradePanel";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: SP }) {
  return (
    <SectionShell icon={PackagePlus} title="Purchase" subtitle="Purchase orders to suppliers. Marking one received adds the stock.">
      <TradePanel kind="purchase" path="/orders/purchase" sp={await params(searchParams)} />
    </SectionShell>
  );
}
