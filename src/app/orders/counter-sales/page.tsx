import { Store } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";
import { TradePanel } from "@/components/orders/TradePanel";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: SP }) {
  return (
    <SectionShell icon={Store} title="Counter sales" subtitle="Walk-in sales. Stock goes out immediately.">
      <TradePanel kind="counter" path="/orders/counter-sales" sp={await params(searchParams)} />
    </SectionShell>
  );
}
