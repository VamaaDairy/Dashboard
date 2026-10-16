import { Users } from "lucide-react";
import { EntityPanel } from "@/components/orders/EntityPanel";
import { SectionShell } from "@/components/orders/SectionShell";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: SP }) {
  return (
    <SectionShell icon={Users} title="Customers" subtitle="Distributors, retailers and institutions - with their distributor, salesman, beat and credit terms.">
      <EntityPanel entity="customer" path="/orders/customers" access="orders.customers" sp={await params(searchParams)} filterBy={["type", "status"]} />
    </SectionShell>
  );
}
