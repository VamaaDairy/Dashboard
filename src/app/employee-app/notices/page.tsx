import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { listNoticeRows, staffOptions } from "@/lib/employee/admin";
import { createNoticeAction, deleteNoticeAction } from "../actions";
import { area, btn, btnDanger, Card, field, Flash, Page, when } from "../ui";

export const dynamic = "force-dynamic";

const AUDIENCE: Record<string, string> = { all: "Everyone", sales: "Sales team", staff: "One person" };

/** Send anything to employees: a notice to all, to the sales team, or a private message to one person. */
export default async function NoticesPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const sp = await searchParams;
  const [notices, staff] = await Promise.all([listNoticeRows(), staffOptions(false)]);
  return (
    <Page>
      <PageHeader icon={Megaphone} title="Notices & messages" subtitle="Appear in the app's Inbox the moment you send them, with a count of who has read them." />
      <Flash err={sp.err} ok={sp.ok} />
      <Card title="Send a new message">
        <form action={createNoticeAction} className="grid gap-3 md:grid-cols-2">
          <input name="title" placeholder="Title" maxLength={120} className={field} required />
          <div className="grid grid-cols-2 gap-3">
            <select name="kind" className={field} defaultValue="notice">
              <option value="notice">Notice</option><option value="urgent">Urgent</option><option value="policy">Policy</option><option value="holiday">Holiday</option><option value="celebration">Celebration</option>
            </select>
            <select name="audience" className={field} defaultValue="all">
              <option value="all">To everyone</option><option value="sales">To the sales team</option><option value="staff">To one person…</option>
            </select>
          </div>
          <textarea name="body" placeholder="Message" rows={4} maxLength={4000} className={`${area} md:col-span-2`} required />
          <select name="staffUid" defaultValue="" className={field}>
            <option value="">(only when sending to one person) choose employee</option>
            {staff.map((s) => <option key={s.uid} value={s.uid}>{s.name}{s.code ? ` · ${s.code}` : ""}</option>)}
          </select>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" value="1" /> Pin to the top</label>
            <button className={btn}>Send</button>
          </div>
        </form>
      </Card>
      <div className="space-y-3">
        {notices.map((n) => (
          <div key={n.id} className="rounded-lg border border-border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-base">{n.title}</b>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">{n.kind}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{n.audience === "staff" ? `To ${n.to}` : AUDIENCE[n.audience]}</span>
              {n.pinned ? <span className="text-xs text-primary">Pinned</span> : null}
              <span className="ml-auto text-xs text-muted-foreground">{when(n.createdAt)} · {n.by}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{n.body}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Read by {n.readBy} of {n.reach}</span>
              <form action={deleteNoticeAction}><input type="hidden" name="id" value={n.id} /><button className={btnDanger}>Delete</button></form>
            </div>
          </div>
        ))}
        {notices.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nothing sent yet.</p> : null}
      </div>
    </Page>
  );
}
