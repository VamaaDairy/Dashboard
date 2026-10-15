import { BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ComplaintList } from "@/components/cn/ComplaintList";
import { Panel } from "@/components/cn/ui";
import { listComplaints } from "@/lib/cn/data";
import { APPROVAL_MATRIX, rupees } from "@/lib/cn/sop";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Credit notes recommended and waiting for someone with the authority to approve them. */
export default async function ApprovalsPage() {
  const rows = (await listComplaints()).filter((c) => c.stage === "recommended").sort((a, b) => a.stage_on.localeCompare(b.stage_on));
  const tiers = APPROVAL_MATRIX.map((m, i) => {
    const from = i === 0 ? 0 : APPROVAL_MATRIX[i - 1].upto;
    return {
      level: m.level,
      range: m.upto === Infinity ? `Above ${rupees(from)}` : i === 0 ? `Up to ${rupees(m.upto)}` : `${rupees(from)} – ${rupees(m.upto)}`,
      waiting: rows.filter((c) => c.approval_level === m.level).length,
    };
  });
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <PageHeader icon={BadgeCheck} title="CN approvals" subtitle="Recommended credit notes wait here for someone with the authority to approve them." />
        <Panel title="Approval matrix" description="Who must approve a credit note, by value. A higher level can always approve a lower one." flush>
          <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {tiers.map((t) => (
              <div key={t.level} className="px-4 py-3.5">
                <div className="text-[13px] font-medium text-foreground">{t.level}</div>
                <div className="num mt-1 text-[12px] text-tertiary-foreground">{t.range}</div>
                <div className="mt-2 text-[12px]">
                  <span className="num font-semibold text-foreground">{t.waiting}</span>
                  <span className="text-tertiary-foreground"> waiting</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <ComplaintList title="Waiting for approval" rows={rows} today={today()} empty="Nothing is waiting for approval" />
      </div>
    </div>
  );
}
