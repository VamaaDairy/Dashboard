import { Truck } from "lucide-react";
import { EntityPanel } from "@/components/orders/EntityPanel";
import { SectionShell } from "@/components/orders/SectionShell";
import { pickTab, SectionTabs, type TabDef } from "@/components/orders/SectionTabs";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [
  { key: "delivery", label: "Deliveries / load" },
  { key: "return", label: "Sales returns" },
  { key: "van_transfer", label: "Van stock" },
];
const FILTERS: Record<string, string[]> = { delivery: ["status"], return: ["status", "reason"], van_transfer: ["direction"] };

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const tab = pickTab(TABS, sp.t);
  return (
    <SectionShell icon={Truck} title="Delivery & returns" subtitle="Plan deliveries, take back returns (approved returns restock), and track stock issued to vans.">
      <SectionTabs path="/orders/logistics" tabs={TABS} active={tab} />
      <EntityPanel entity={tab} path="/orders/logistics" tab={tab} access="orders.logistics" sp={sp} filterBy={FILTERS[tab]} />
    </SectionShell>
  );
}
