import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { listRequestRows } from "@/lib/employee/admin";
import { replyRequestAction } from "../actions";
import { area, btn, btnGhost, Flash, Page, Pill, when } from "../ui";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { hr: "HR query", document: "Document", advance: "Advance", id_card: "ID card", it: "IT / phone", grievance: "Grievance", other: "Other" };

/** What employees send to the office from the app, and your reply (they see it in the app). */
export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const sp = await searchParams;
  const rows = await listRequestRows(false);
  return (
    <Page>
      <PageHeader icon={Inbox} title="Employee requests" subtitle="HR queries, document and ID-card requests, advances, IT problems and grievances." />
      <Flash err={sp.err} ok={sp.ok} />
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <b>{r.subject}</b> <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{KIND[r.kind] ?? r.kind}</span> <Pill status={r.status} />
              <span className="ml-auto text-xs text-muted-foreground">{r.name} {r.code ? `· ${r.code}` : ""} {r.phone ? `· ${r.phone}` : ""} · {when(r.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{r.message}</p>
            {r.reply ? <p className="mt-2 rounded-md bg-muted px-3 py-2"><b>Reply:</b> {r.reply}</p> : null}
            {r.status !== "closed" ? (
              <form action={replyRequestAction} className="mt-3 grid gap-2">
                <input type="hidden" name="id" value={r.id} />
                <textarea name="reply" rows={2} placeholder="Your reply" defaultValue="" className={area} required />
                <div className="flex gap-2">
                  <button name="close" value="1" className={btn}>Reply &amp; close</button>
                  <button name="close" value="0" className={btnGhost}>Reply, keep open</button>
                </div>
              </form>
            ) : null}
          </div>
        ))}
        {rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No requests.</p> : null}
      </div>
    </Page>
  );
}
