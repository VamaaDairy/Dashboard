import { Settings2 } from "lucide-react";
import { EntityPanel } from "@/components/orders/EntityPanel";
import { SectionShell } from "@/components/orders/SectionShell";
import { pickTab, SectionTabs, type TabDef } from "@/components/orders/SectionTabs";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [
  { key: "category", label: "Categories" },
  { key: "brand", label: "Brands" },
  { key: "channel", label: "Channels" },
  { key: "designation", label: "Designations" },
  { key: "expense_type", label: "Expense types" },
];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const tab = pickTab(TABS, sp.t);
  return (
    <SectionShell icon={Settings2} title="Master Configuration" subtitle="The pick-lists the rest of Orders uses.">
      <SectionTabs path="/orders/master-config" tabs={TABS} active={tab} />
      <EntityPanel entity={tab} path="/orders/master-config" tab={tab} access="orders.config" sp={sp} />
    </SectionShell>
  );
}
