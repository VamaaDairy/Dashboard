import { cookies } from "next/headers";
import { UserX } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { listDeletionRequests } from "@/lib/shop/deletion";
import { CloseButtons } from "./close-buttons";

export const dynamic = "force-dynamic";

const when = (d: Date) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const STATUS = { pending: "Pending", done: "Done", rejected: "Rejected" } as const;

/** Customers who asked (on /delete-account) for their Gaia app account to be deleted. */
export default async function DeletionRequestsPage() {
  const [rows, me] = await Promise.all([listDeletionRequests(), userFromToken((await cookies()).get("session")?.value)]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={UserX}
          title="Account deletion requests"
          subtitle="Gaia app customers who asked for their account to be deleted, from the public page /delete-account. Delete within 7 days, then mark it done."
        />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["Asked on", "Customer", "Mobile", "Reason", "Status", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No requests yet.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2">{when(r.created_at)}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.phone}</td>
                  <td className="max-w-sm px-3 py-2 text-muted-foreground">{r.reason ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {STATUS[r.status]}
                    {r.handled_at && <div className="text-xs text-muted-foreground">{r.handled_by} · {when(r.handled_at)}</div>}
                  </td>
                  <td className="px-3 py-2">{canEdit && r.status === "pending" ? <CloseButtons id={r.id} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
