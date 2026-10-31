import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { listClaimRows } from "@/lib/employee/admin";
import { decideClaimAction } from "../actions";
import { btn, btnDanger, btnGhost, field, Flash, Page, Pill, Table, day, rs, when } from "../ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [["open", "To review"], ["approved", "To pay"], ["all", "All"]] as const;

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string; show?: string }> }) {
  const sp = await searchParams;
  const show = sp.show === "approved" || sp.show === "all" ? sp.show : "open";
  const rows = await listClaimRows(show);
  return (
    <Page>
      <PageHeader icon={ReceiptText} title="Reimbursements" subtitle="Expense claims with a photo of the bill. Approve (optionally a lower amount), reject with a reason, then mark paid once the money has gone." />
      <Flash err={sp.err} ok={sp.ok} />
      <div className="flex gap-1.5 text-sm">
        {TABS.map(([k, l]) => <Link key={k} href={`/employee-app/claims?show=${k}`} className={cn("rounded-full border px-3 py-1", k === show ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{l}</Link>)}
      </div>
      <Table head={["Employee", "Category", "Spent on", "Amount", "Description", "Bill", "Status", "Decide"]} cols={8} empty={rows.length ? undefined : "Nothing here."}>
        {rows.map((c) => (
          <tr key={c.id} className="border-t border-border align-top">
            <td className="px-3 py-2"><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.code ?? ""} · {when(c.createdAt)}</div></td>
            <td className="px-3 py-2 capitalize">{c.category}</td>
            <td className="whitespace-nowrap px-3 py-2">{day(c.spentOn)}</td>
            <td className="whitespace-nowrap px-3 py-2 font-medium">{rs(c.amount)}{c.approvedAmount != null && c.approvedAmount !== c.amount ? <div className="text-xs text-muted-foreground">approved {rs(c.approvedAmount)}</div> : null}</td>
            <td className="min-w-48 max-w-72 px-3 py-2 text-muted-foreground">{c.description}</td>
            <td className="px-3 py-2">{c.hasReceipt ? <a href={`/employee-app/claims/${c.id}/receipt`} target="_blank" className="text-primary hover:underline">View</a> : "—"}</td>
            <td className="px-3 py-2"><Pill status={c.status} />{c.remark || c.decidedBy ? <div className="mt-1 text-xs text-muted-foreground">{c.decidedBy}{c.remark ? ` · ${c.remark}` : ""}</div> : null}</td>
            <td className="px-3 py-2">
              {c.status === "pending" ? (
                <form action={decideClaimAction} className="flex min-w-56 flex-col gap-1.5">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="amount" inputMode="decimal" placeholder={`Approve ${c.amount} (or less)`} className={field} />
                  <input name="remark" placeholder="Remark / reason" className={field} />
                  <div className="flex gap-1.5">
                    <button name="decision" value="approve" className={btn}>Approve</button>
                    <button name="decision" value="reject" className={btnDanger}>Reject</button>
                  </div>
                </form>
              ) : c.status === "approved" ? (
                <form action={decideClaimAction}><input type="hidden" name="id" value={c.id} /><button name="decision" value="pay" className={btnGhost}>Mark paid</button></form>
              ) : null}
            </td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
