import { Truck } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";
import { TradePanel } from "@/components/orders/TradePanel";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: SP }) {
  return (
    <SectionShell icon={Truck} title="Primary orders" subtitle="Distributors ordering from the company. Delivered orders take stock out.">
      <TradePanel kind="primary" path="/orders/primary" sp={await params(searchParams)} />
    </SectionShell>
  );
}
