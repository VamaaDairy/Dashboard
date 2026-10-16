import { Users } from "lucide-react";
import { EntityPanel } from "@/components/orders/EntityPanel";
import { SectionShell } from "@/components/orders/SectionShell";
import { pickTab, SectionTabs, type TabDef } from "@/components/orders/SectionTabs";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [
  { key: "customer", label: "Customers" },
  { key: "approvals", label: "Approvals" },
  { key: "unmap_request", label: "Unmap requests" },
  { key: "customer_target", label: "Targets" },
];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const tab = pickTab(TABS, sp.t);
  // approvals is the customer list narrowed to those waiting for a decision
  const entity = tab === "approvals" ? "customer" : tab;
  const view = tab === "approvals" ? { ...sp, status: "pending" } : sp;
  return (
    <SectionShell icon={Users} title="Customers" subtitle="Distributors, retailers and institutions - approvals, unmap requests and monthly targets too.">
      <SectionTabs path="/orders/customers" tabs={TABS} active={tab} />
      <EntityPanel entity={entity} path="/orders/customers" tab={tab} access="orders.customers" sp={view}
        filterBy={entity === "customer" && tab !== "approvals" ? ["type", "status"] : entity === "customer" ? ["status"] : entity === "unmap_request" ? ["status"] : undefined} />
    </SectionShell>
  );
}
