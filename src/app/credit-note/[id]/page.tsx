import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Section, THead, Th } from "@/components/tanks/ui";
import { CreditNoteForm } from "@/components/creditnote/CreditNoteForm";
import { DecisionPanel } from "@/components/creditnote/DecisionPanel";
import { DeleteButton } from "@/components/creditnote/DeleteButton";
import { StatusBadge } from "@/components/creditnote/StatusBadge";
import { getCreditNote, listSkuOptions } from "@/lib/creditnote/data";
import { qtyText, totals } from "@/lib/creditnote/qty";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

const dmy = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-3 border-b border-border px-4 py-2 text-[13px] last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

export default async function CreditNotePage({ params, searchParams }: PageProps<"/credit-note/[id]">) {
  const { id } = await params;
  const { edit } = await searchParams;
  const note = await getCreditNote(id);
  if (!note) notFound();

  if (edit && note.status === "pending") {
    return (
      <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <PageHeader icon={ReceiptText} title={`Edit challan ${note.challan_no}`} />
          <CreditNoteForm note={note} today={today()} skus={await listSkuOptions()} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <PageHeader
          icon={ReceiptText}
          title={`Challan ${note.challan_no}`}
          subtitle={<StatusBadge note={note} />}
          actions={
            <>
              <Link href="/credit-note" className={buttonVariants({ variant: "ghost" })}>Back</Link>
              {note.status === "pending" ? (
                <Link href={`/credit-note/${note.id}?edit=1`} className={buttonVariants({ variant: "outline" })}>Edit</Link>
              ) : null}
              <DeleteButton id={note.id} label={note.challan_no} redirectTo="/credit-note" />
            </>
          }
        />

        <DecisionPanel note={note} />

        <Section title="Customer">
          <dl>
            <Row label="Challan No." value={note.challan_no} />
            <Row label="Date" value={dmy(note.challan_date)} />
            <Row label="Customer" value={note.customer_name} />
            <Row label="Contact No." value={note.contact_no} />
            <Row label="Address" value={note.address} />
          </dl>
        </Section>

        <Section title="Dispatch">
          <dl>
            <Row label="Dispatch Bill/Challan No." value={note.dispatch_challan_no} />
            <Row label="Dispatch Date" value={dmy(note.dispatch_date)} />
            <Row label="Vehicle No." value={note.vehicle_no} />
            <Row label="Checked by" value={note.checked_by} />
            <Row label="Team (Name)" value={note.team_name} />
          </dl>
        </Section>

        <Section title={`Items returned (${note.items.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <THead>
                <Th align="left">#</Th>
                <Th align="left">Material</Th>
                <Th align="left">Reason</Th>
                <Th align="left">MFD</Th>
                <Th align="left">U.B.D.</Th>
                <Th>Claim</Th>
                <Th>Approved</Th>
                <Th align="left">Quality remark</Th>
              </THead>
              <tbody>
                {note.items.map((i, n) => (
                  <tr key={i.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{n + 1}</td>
                    <td className="px-3 py-2 font-medium">{i.material_name}</td>
                    <td className="px-3 py-2">{i.reason || "—"}</td>
                    <td className="px-3 py-2">{dmy(i.mfd)}</td>
                    <td className="px-3 py-2">{dmy(i.ubd)}</td>
                    <td className="num px-3 py-2 text-right">{i.claim_qty === null ? "—" : qtyText(i.claim_qty, i.return_unit, i.pcs_per_case)}</td>
                    <td className="num px-3 py-2 text-right">{i.approved_qty === null ? "—" : qtyText(i.approved_qty, i.return_unit, i.pcs_per_case)}</td>
                    <td className="px-3 py-2">{i.quality_remark || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="border-t border-border">
            <Row label="Total claimed" value={totals(note.items, "claim_qty")} />
            <Row label="Total approved" value={totals(note.items, "approved_qty")} />
          </dl>
        </Section>

        <Section title="Approval">
          <dl>
            <Row label="Status" value={<StatusBadge note={note} />} />
            <Row label="Approved by" value={note.approved_by ? `${note.approved_by} (${dmy(note.approved_on)})` : ""} />
            <Row label="Remark" value={note.decision_note} />
            <Row label="Entered by" value={note.created_by} />
          </dl>
        </Section>
      </div>
    </div>
  );
}
