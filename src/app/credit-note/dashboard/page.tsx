import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CreditDashboard } from "@/components/creditnote/CreditDashboard";
import { NoteFilters } from "@/components/creditnote/NoteFilters";
import { listCreditNotes } from "@/lib/creditnote/data";
import { applyFilter, filterOptions, readFilter } from "@/lib/creditnote/filters";
import { periodFrom } from "@/lib/dash/period";

export const dynamic = "force-dynamic";

/** Credit notes over a period (default: last 30 days), narrowed by any of the same filters as the list. */
export default async function CreditNoteDashboardPage({ searchParams }: PageProps<"/credit-note/dashboard">) {
  const sp = await searchParams;
  const { from, to, today } = periodFrom(sp);
  const filter = { ...readFilter(sp), from, to };
  const all = await listCreditNotes();
  const notes = applyFilter(all, filter);
  const others = applyFilter(all, { ...filter, status: "" });
  const counts = {
    all: others.length,
    pending: others.filter((n) => n.status === "pending").length,
    approved: others.filter((n) => n.status === "approved").length,
    rejected: others.filter((n) => n.status === "rejected").length,
  };
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <PageHeader icon={LayoutDashboard} title="Credit notes · Dashboard" subtitle="What customers have claimed, what has been approved, and what is still waiting." />
        <NoteFilters filter={filter} options={filterOptions(all)} counts={counts} today={today} shown={notes.length} total={all.length} />
        <CreditDashboard from={from} to={to} today={today} notes={notes} />
      </div>
    </div>
  );
}
