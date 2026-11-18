import Link from "next/link";
import { FileSpreadsheet, Plus, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Empty, Section, THead, Th } from "@/components/tanks/ui";
import { NoteFilters } from "@/components/creditnote/NoteFilters";
import { RowActions } from "@/components/creditnote/RowActions";
import { StatusBadge } from "@/components/creditnote/StatusBadge";
import { listCreditNotes } from "@/lib/creditnote/data";
import { applyFilter, FILTER_KEYS, filterOptions, readFilter } from "@/lib/creditnote/filters";
import { totals } from "@/lib/creditnote/qty";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

const dmy = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

export default async function CreditNotesPage({ searchParams }: PageProps<"/credit-note">) {
  const filter = readFilter(await searchParams);
  const now = today();
  const all = await listCreditNotes();
  const rows = applyFilter(all, filter);
  // the status pills count what the other filters leave, so they show what each one would give
  const others = applyFilter(all, { ...filter, status: "" });
  const counts = {
    all: others.length,
    pending: others.filter((n) => n.status === "pending").length,
    approved: others.filter((n) => n.status === "approved").length,
    rejected: others.filter((n) => n.status === "rejected").length,
  };

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <PageHeader
          icon={ReceiptText}
          title="Credit notes"
          subtitle="Material returned by customers, and whether it has been approved."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {/* a plain form: the browser downloads the file straight from /credit-note/export, with the page's other filters */}
              <form action="/credit-note/export" method="get" className="flex flex-wrap items-center gap-2 text-sm">
                {FILTER_KEYS.filter((k) => k !== "from" && k !== "to" && filter[k]).map((k) => <input key={k} type="hidden" name={k} value={filter[k]} />)}
                <label className="flex items-center gap-1 text-muted-foreground">
                  From <input type="date" name="from" required defaultValue={filter.from || `${now.slice(0, 7)}-01`} max={now} className="h-8 rounded-md border border-input bg-background px-2 text-foreground" />
                </label>
                <label className="flex items-center gap-1 text-muted-foreground">
                  To <input type="date" name="to" required defaultValue={filter.to || now} max={now} className="h-8 rounded-md border border-input bg-background px-2 text-foreground" />
                </label>
                <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 font-medium hover:bg-muted">
                  <FileSpreadsheet className="size-4" /> Export to Excel
                </button>
              </form>
              <Link href="/credit-note/new" className={buttonVariants()}>
                <Plus className="h-4 w-4" /> New credit note
              </Link>
            </div>
          }
        />

        <NoteFilters filter={filter} options={filterOptions(all)} counts={counts} today={now} shown={rows.length} total={all.length} />

        <Section title="Credit notes">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <THead>
                <Th align="left">Challan No.</Th>
                <Th align="left">Date</Th>
                <Th align="left">Customer</Th>
                <Th align="left">Material</Th>
                <Th>Claim</Th>
                <Th>Approved</Th>
                <Th align="left">Status</Th>
                <Th align="left">Approved by</Th>
                <Th>Actions</Th>
              </THead>
              <tbody>
                {rows.length === 0 ? (
                  <Empty colSpan={9}>No credit notes match.</Empty>
                ) : rows.map((n) => (
                  <tr key={n.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/credit-note/${n.id}`} className="hover:underline">{n.challan_no}</Link>
                    </td>
                    <td className="px-3 py-2">{dmy(n.challan_date)}</td>
                    <td className="px-3 py-2">{n.customer_name}</td>
                    <td className="px-3 py-2">
                      {n.items[0]?.material_name ?? "—"}
                      {n.items.length > 1 ? <span className="ml-1 text-muted-foreground">+{n.items.length - 1} more</span> : null}
                    </td>
                    <td className="num px-3 py-2 text-right">{totals(n.items, "claim_qty") || "—"}</td>
                    <td className="num px-3 py-2 text-right">{totals(n.items, "approved_qty") || "—"}</td>
                    <td className="px-3 py-2"><StatusBadge note={n} /></td>
                    <td className="px-3 py-2">{n.approved_by ? `${n.approved_by} (${dmy(n.approved_on)})` : "—"}</td>
                    <td className="px-3 py-2 text-right"><RowActions note={n} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
