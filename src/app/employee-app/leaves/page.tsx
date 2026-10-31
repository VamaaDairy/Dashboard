import Link from "next/link";
import { CalendarOff } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { listLeaveRequests } from "@/lib/employee/admin";
import { decideLeaveAction } from "../actions";
import { btn, btnDanger, field, Flash, LEAVE_CLASH, Page, Pill, Table, day, when } from "../ui";

export const dynamic = "force-dynamic";

export default async function LeavesPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string; show?: string }> }) {
  const sp = await searchParams;
  const all = sp.show === "all";
  const rows = await listLeaveRequests(!all);
  return (
    <Page>
      <PageHeader
        icon={CalendarOff} title="Leave requests" subtitle="Applied in the app. Sundays are not counted. Balances are per leave type, per calendar year."
        actions={<Link href={all ? "/employee-app/leaves" : "/employee-app/leaves?show=all"} className="text-sm text-primary hover:underline">{all ? "Show only pending" : "Show all"}</Link>}
      />
      <Flash err={sp.err} ok={sp.ok} />
      <Table head={["Employee", "Type", "From", "To", "Days", "Reason", "Status", "Decide"]} cols={8} empty={rows.length ? undefined : "No leave requests."}>
        {rows.map((l) => (
          <tr key={l.id} className="border-t border-border align-top">
            <td className="px-3 py-2"><div className="font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{l.code ?? ""} · applied {when(l.createdAt)}</div></td>
            <td className="px-3 py-2">{l.type}</td>
            <td className="whitespace-nowrap px-3 py-2">{day(l.from)}</td>
            <td className="whitespace-nowrap px-3 py-2">{day(l.to)}</td>
            <td className="px-3 py-2">{l.days}{l.halfDay ? " (half)" : ""}</td>
            <td className="min-w-48 max-w-72 px-3 py-2 text-muted-foreground">{l.reason}{LEAVE_CLASH(l.clash) ? <div className="mt-1 text-xs text-amber-700">{LEAVE_CLASH(l.clash)}</div> : null}</td>
            <td className="px-3 py-2"><Pill status={l.status} />{l.decidedBy ? <div className="mt-1 text-xs text-muted-foreground">{l.decidedBy}{l.remark ? ` · ${l.remark}` : ""}</div> : null}</td>
            <td className="px-3 py-2">
              {l.status === "pending" ? (
                <form action={decideLeaveAction} className="flex min-w-60 flex-col gap-1.5">
                  <input type="hidden" name="id" value={l.id} />
                  <input name="remark" placeholder="Remark (optional)" className={field} />
                  <div className="flex gap-1.5">
                    <button name="decision" value="approve" className={btn}>Approve</button>
                    <button name="decision" value="reject" className={btnDanger}>Reject</button>
                  </div>
                </form>
              ) : null}
            </td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
