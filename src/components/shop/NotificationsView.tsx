import Link from "next/link";
import { cookies } from "next/headers";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { NotificationForm } from "@/components/shop/NotificationForm";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";
import { pushConfigured } from "@/lib/push/fcm";
import { LOG_WHERE, PARTNER_LOG_PREFIX, type NotifyApp } from "@/lib/push/audiences";

interface LogRow { id: number; audience: string; title: string; body: string; sent: number; failed: number; sentBy: string | null; at: string }

const PAGE: Record<NotifyApp, { title: string; key: string; back: { href: string; label: string } }> = {
  d2c: { title: "D2C app notifications", key: "shop", back: { href: "/shop-orders", label: "D2C orders" } },
  partner: { title: "Distributor & retailer app notifications", key: "apporders", back: { href: "/app-orders/distributors", label: "App orders" } },
};

/** One app's push notifications: the send form and what was sent before. */
export async function NotificationsView({ app }: { app: NotifyApp }) {
  const page = PAGE[app];
  const [log, devices, me] = await Promise.all([
    query<LogRow>(`select id, audience, title, body, sent, failed, sent_by as "sentBy", to_char(created_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI') as at
                     from push_log where ${LOG_WHERE[app]} order by id desc limit 50`),
    query<{ who: string; n: number }>(
      `select case when d.role = 'distributor' then coalesce(l.kind, 'distributor') else d.role end as who, count(distinct d.token)::int as n
         from push_device d left join dist_login l on d.role = 'distributor' and l.id = d.owner_id
        group by 1`),
    userFromToken((await cookies()).get("session")?.value),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, page.key), "edit");
  const count = (w: string) => devices.find((d) => d.who === w)?.n ?? 0;
  const subtitle = app === "d2c"
    ? `Push to the Gaia D2C app and the delivery riders. Phones registered: ${count("customer")} customers, ${count("rider")} riders.`
    : `Push to the Gaia distributor / retailer app. Phones registered: ${count("distributor")} distributors, ${count("retailer")} retailers.`;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <PageHeader
          icon={Bell}
          title={page.title}
          subtitle={subtitle}
          actions={<Link href={page.back.href} className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">{page.back.label}</Link>}
        />
        {!pushConfigured() ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-[13px] text-red-700 dark:text-red-400">
            Firebase is not configured on this server, so nothing can be sent. Set FIREBASE_SERVICE_ACCOUNT_FILE in .env and restart.
          </div>
        ) : null}
        {canEdit ? <NotificationForm app={app} /> : <p className="text-sm text-muted-foreground">You can view this page but not send.</p>}
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
                  <td className="px-3 py-2">{r.audience.replace(PARTNER_LOG_PREFIX, "")}</td>
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
