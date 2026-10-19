import Link from "next/link";
import { cookies } from "next/headers";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CreateOrdersButton } from "@/components/shop/SubscriptionAdmin";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { addDays, allSubscriptions, CUTOFF_HOUR, daySummary, frequencyLabel, todayIST } from "@/lib/shop/subscriptions";

export const dynamic = "force-dynamic";

const nice = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

export default async function SubscriptionsPage() {
  const tomorrow = addDays(todayIST(), 1);
  const [subs, today, next, me] = await Promise.all([allSubscriptions(), daySummary(todayIST()), daySummary(tomorrow), userFromToken((await cookies()).get("session")?.value)]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");
  const card = "rounded-lg border border-border p-4";

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={CalendarClock}
          title="Subscriptions"
          subtitle={`Customers' repeat deliveries from the Gaia app. Each day's deliveries become orders the evening before (customers can change a day until ${CUTOFF_HOUR}:00).`}
          actions={<Link href="/shop-orders" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Shop orders</Link>}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <div className={card}>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Today · {nice(todayIST())}</div>
            <div className="mt-1 text-2xl font-bold">{today.items} items <span className="text-base font-medium text-muted-foreground">for {today.customers} customer(s)</span></div>
            <div className="text-sm text-muted-foreground">{today.ordered} order(s) created · {today.skipped} skipped</div>
          </div>
          <div className={card}>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Tomorrow · {nice(tomorrow)}</div>
            <div className="mt-1 text-2xl font-bold">{next.items} items <span className="text-base font-medium text-muted-foreground">for {next.customers} customer(s)</span></div>
            <div className="mb-3 text-sm text-muted-foreground">{next.ordered} order(s) created · {next.skipped} skipped</div>
            {canEdit ? <CreateOrdersButton day={tomorrow} label="Create tomorrow's orders" /> : null}
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["Customer", "Product", "Qty", "When", "From", "Until", "Status", "Address"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className={`border-t border-border ${s.status === "paused" ? "opacity-60" : ""}`}>
                  <td className="px-3 py-2"><div className="font-medium">{s.customer}</div><div className="font-mono text-xs text-muted-foreground">{s.phone}</div></td>
                  <td className="px-3 py-2">{s.product}</td>
                  <td className="num px-3 py-2">{s.qty}</td>
                  <td className="px-3 py-2">{frequencyLabel(s.frequency, s.weekdays, s.every_n)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{nice(s.start_date)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{s.end_date ? nice(s.end_date) : "-"}</td>
                  <td className="px-3 py-2">{s.status === "active" ? "Active" : "Paused"}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-muted-foreground">{s.address}</td>
                </tr>
              ))}
              {subs.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No subscriptions yet. Customers start them from a product page in the app.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
