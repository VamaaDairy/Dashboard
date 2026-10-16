import { MapPinned } from "lucide-react";
import { EntityPanel } from "@/components/orders/EntityPanel";
import { SectionShell } from "@/components/orders/SectionShell";
import { pickTab, SectionTabs, type TabDef } from "@/components/orders/SectionTabs";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [
  { key: "staff", label: "Employees" },
  { key: "beat", label: "Routes / beats" },
  { key: "visit", label: "Market visits" },
  { key: "attendance", label: "Attendance" },
  { key: "expense", label: "Expenses" },
  { key: "task", label: "Tasks" },
];
const FILTERS: Record<string, string[]> = {
  visit: ["outcome"], attendance: ["status"], expense: ["status"], task: ["status", "priority"], beat: ["weekday"],
};

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const tab = pickTab(TABS, sp.t);
  return (
    <SectionShell icon={MapPinned} title="Field Force Management" subtitle="Employees, routes, market visits, attendance, expenses and tasks.">
      <SectionTabs path="/orders/field-force" tabs={TABS} active={tab} />
      <EntityPanel entity={tab} path="/orders/field-force" tab={tab} access="orders.fieldforce" sp={sp} filterBy={FILTERS[tab]} />
    </SectionShell>
  );
}
