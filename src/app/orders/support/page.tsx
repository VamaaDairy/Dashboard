import { LifeBuoy } from "lucide-react";
import { EntityPanel } from "@/components/orders/EntityPanel";
import { Stat } from "@/components/orders/common";
import { SectionShell } from "@/components/orders/SectionShell";
import { query } from "@/lib/db";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const counts = await query<{ status: string; n: number }>(`select status, count(*)::int as n from ord_ticket group by status`);
  const n = (s: string) => String(counts.find((c) => c.status === s)?.n ?? 0);
  const [high] = await query<{ n: number }>(`select count(*)::int as n from ord_ticket where priority = 'high' and status in ('open','in_progress')`);

  return (
    <SectionShell icon={LifeBuoy} title="Support Dashboard" subtitle="Customer and field issues - raise, assign, resolve.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Open" value={n("open")} />
        <Stat title="In progress" value={n("in_progress")} />
        <Stat title="Resolved" value={n("resolved")} />
        <Stat title="High priority pending" value={String(high?.n ?? 0)} />
      </div>
      <EntityPanel entity="ticket" path="/orders/support" access="orders.support" sp={sp} filterBy={["status", "priority"]} />
    </SectionShell>
  );
}
