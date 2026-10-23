import Link from "next/link";
import { cookies } from "next/headers";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { NotificationForm } from "@/components/shop/NotificationForm";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";
import { pushConfigured } from "@/lib/push/fcm";

export const dynamic = "force-dynamic";

interface LogRow { id: number; audience: string; title: string; body: string; sent: number; failed: number; sentBy: string | null; at: string }

export default async function NotificationsPage() {
  const [log, devices, me] = await Promise.all([
    query<LogRow>(`select id, audience, title, body, sent, failed, sent_by as "sentBy", to_char(created_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI') as at
                     from push_log order by id desc limit 50`),
    query<{ role: string; n: number }>(`select role, count(distinct token)::int as n from push_device group by role`),
    userFromToken((await cookies()).get("session")?.value),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");
  const count = (r: string) => devices.find((d) => d.role === r)?.n ?? 0;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <PageHeader
          icon={Bell}
          title="Notifications"
          subtitle={`Send a push notification to the Gaia app. Phones registered: ${count("customer")} customers, ${count("rider")} riders, ${count("distributor")} distributors.`}
          actions={<Link href="/shop-orders" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Shop orders</Link>}
        />
        {!pushConfigured() ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-[13px] text-red-700 dark:text-red-400">
            Firebase is not configured on this server, so nothing can be sent. Set FIREBASE_SERVICE_ACCOUNT_FILE in .env and restart.
          </div>
        ) : null}
        {canEdit ? <NotificationForm /> : <p className="text-sm text-muted-foreground">You can view this page but not send.</p>}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Message</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">By</th></tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nothing sent yet.</td></tr>
              ) : log.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2">{r.at}</td>
                  <td className="px-3 py-2">{r.audience}</td>
                  <td className="px-3 py-2"><div className="font-medium">{r.title}</div><div className="text-muted-foreground">{r.body}</div></td>
                  <td className="whitespace-nowrap px-3 py-2">{r.sent} sent{r.failed ? `, ${r.failed} failed` : ""}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.sentBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
