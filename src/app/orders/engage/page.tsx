import { Megaphone } from "lucide-react";
import { EntityPanel } from "@/components/orders/EntityPanel";
import { SectionShell } from "@/components/orders/SectionShell";
import { pickTab, SectionTabs, type TabDef } from "@/components/orders/SectionTabs";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [
  { key: "broadcast", label: "Broadcasts" },
  { key: "catalogue", label: "Digital catalogue" },
  { key: "quiz", label: "Quizzes" },
  { key: "quiz_question", label: "Questions" },
  { key: "quiz_result", label: "Results" },
];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const tab = pickTab(TABS, sp.t);
  return (
    <SectionShell icon={Megaphone} title="Engage & training" subtitle="Notifications to the field team, the product catalogue, and quizzes with their results.">
      <SectionTabs path="/orders/engage" tabs={TABS} active={tab} />
      <EntityPanel entity={tab} path="/orders/engage" tab={tab} access="orders.engage" sp={sp} filterBy={tab === "broadcast" ? ["status"] : undefined} />
    </SectionShell>
  );
}
