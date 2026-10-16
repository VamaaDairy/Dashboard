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
      <form action="/orders/print" target="_blank" className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px]">
        <span className="font-medium text-foreground">Load sheet</span>
        <input type="date" name="load" required defaultValue={new Date().toISOString().slice(0, 10)} className="h-8 rounded-lg border border-border bg-background px-2" />
        <button className="h-8 rounded-lg border border-border bg-white px-3 text-[12px] font-medium hover:bg-muted">Open</button>
        <span className="text-[12px] text-muted-foreground">Totals of approved and invoiced orders for the day, ready to print.</span>
      </form>
      <SectionTabs path="/orders/logistics" tabs={TABS} active={tab} />
      <EntityPanel entity={tab} path="/orders/logistics" tab={tab} access="orders.logistics" sp={sp} filterBy={FILTERS[tab]} />
    </SectionShell>
  );
}
