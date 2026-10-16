import { Package } from "lucide-react";
import { EntityPanel } from "@/components/orders/EntityPanel";
import { SectionShell } from "@/components/orders/SectionShell";
import { pickTab, SectionTabs, type TabDef } from "@/components/orders/SectionTabs";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [{ key: "product", label: "Products" }, { key: "scheme", label: "Schemes" },
  { key: "channel_rate", label: "Channel rates" }, { key: "slab", label: "Slab pricing" },
  { key: "planogram", label: "Planogram" }, { key: "green_target", label: "Green-call targets" },
];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const tab = pickTab(TABS, sp.t);
  return (
    <SectionShell icon={Package} title="Products" subtitle="Product master with categories, brands, GST and trade rates, and the schemes on them.">
      <SectionTabs path="/orders/products" tabs={TABS} active={tab} />
      <EntityPanel entity={tab} path="/orders/products" tab={tab} access="orders.products" sp={sp} />
    </SectionShell>
  );
}
