import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ComplaintList } from "@/components/cn/ComplaintList";
import { listComplaints } from "@/lib/cn/data";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Approved credit notes waiting for Finance to post them. */
export default async function FinanceQueuePage() {
  const rows = (await listComplaints()).filter((c) => c.stage === "approved").sort((a, b) => a.stage_on.localeCompare(b.stage_on));
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <PageHeader icon={Wallet} title="Finance posting" subtitle="Approved credit notes to post. The value posted must equal the value approved." />
        <ComplaintList title="Waiting to be posted" rows={rows} today={today()} empty="Nothing is waiting to be posted" />
      </div>
    </div>
  );
}
