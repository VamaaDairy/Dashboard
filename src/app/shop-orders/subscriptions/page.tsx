import Link from "next/link";
import { cookies } from "next/headers";
import { ChevronRight, FileText } from "lucide-react";
import { CreateOrdersButton } from "@/components/shop/SubscriptionAdmin";
import { OrdersTable } from "@/components/shop/OrdersTable";
import { query } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { addDays, allSubscriptions, CUTOFF_HOUR, daySummary, frequencyLabel, todayIST, type SubscriptionRow } from "@/lib/shop/subscriptions";
import { subscriptionOrders, subscriptionStats } from "@/lib/shop/order-board";
import { toOrderRow } from "@/lib/shop/order-rows";
import { isBilled } from "@/components/shop/D2cInvoice";
import { rupees } from "@/lib/shop/pricing";
import { productLabels } from "@/lib/products/names";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const nice = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
const short = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const monthName = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Subscriptions: customers' repeat deliveries from the Gaia app, one row per customer with what they subscribe to.
 * Click a customer to open every order their subscription has made (the same rows as D2C orders) and an invoice
 * for each month.
 */
export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const tomorrow = addDays(todayIST(), 1);
  const [subs, today, next, me, stats] = await Promise.all([
    allSubscriptions(), daySummary(todayIST()), daySummary(tomorrow), userFromToken((await cookies()).get("session")?.value), subscriptionStats(),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");

  // one row per customer, their subscriptions inside
  const customers = new Map<number, { id: number; name: string; phone: string; address: string; subs: SubscriptionRow[] }>();
  for (const s of subs) {
    const e = customers.get(s.customer_id) ?? { id: s.customer_id, name: s.customer, phone: s.phone, address: s.address, subs: [] };
    e.subs.push(s);
    customers.set(s.customer_id, e);
  }
  const list = [...customers.values()];
  const open = list.find((x) => String(x.id) === c) ?? null;

  return (
    <div className="flex flex-1 flex-col bg-background px-4 pt-6 pb-8 md:px-8">
      <div className="w-full">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Subscriptions</h1>
            <p className="mt-1 max-w-3xl text-[13px] text-foreground/75">
              Customers&apos; repeat deliveries from the Gaia app. Each day&apos;s deliveries become orders the evening before (customers can change a day until {CUTOFF_HOUR}:00). Click a customer for their orders and monthly invoices.
            </p>
          </div>
          <Link href="/shop-orders" className="inline-flex h-8 items-center rounded-lg border border-foreground/15 px-3 text-[13px] font-medium text-foreground hover:bg-foreground/[0.04]">D2C orders</Link>
        </div>

        <div className="mt-6 flex flex-wrap items-start gap-x-14 gap-y-4">
          <div>
            <div className="text-[12px] font-medium text-foreground/75">Today · {nice(todayIST())}</div>
            <div className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums text-foreground">{today.items} items <span className="text-[14px] font-normal text-foreground/75">for {today.customers} customer{today.customers === 1 ? "" : "s"}</span></div>
            <div className="text-[12px] text-foreground/75">{today.ordered} order{today.ordered === 1 ? "" : "s"} created · {today.skipped} skipped</div>
          </div>
          <div>
            <div className="text-[12px] font-medium text-foreground/75">Tomorrow · {nice(tomorrow)}</div>
            <div className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums text-foreground">{next.items} items <span className="text-[14px] font-normal text-foreground/75">for {next.customers} customer{next.customers === 1 ? "" : "s"}</span></div>
            <div className="text-[12px] text-foreground/75">{next.ordered} order{next.ordered === 1 ? "" : "s"} created · {next.skipped} skipped</div>
          </div>
          {canEdit ? <div className="self-center"><CreateOrdersButton day={tomorrow} label="Create tomorrow's orders" /></div> : null}
        </div>

        <div className="mt-7 overflow-hidden rounded-xl border border-foreground/10 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] tabular-nums">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/[0.025] text-left text-[12px] text-foreground/75">
                  <th className="w-8 py-2 pl-4" />
                  {["Customer", "Subscribes to", "Since", "Status", "Address"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Orders</th>
                  <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Charged this month</th>
                </tr>
              </thead>
              <tbody>
                {list.map((x) => {
                  const st = stats.get(x.id);
                  const isOpen = open?.id === x.id;
                  const active = x.subs.some((s) => s.status === "active");
                  const since = x.subs.map((s) => s.start_date).sort()[0];
                  const href = isOpen ? "/shop-orders/subscriptions" : `/shop-orders/subscriptions?c=${x.id}`;
                  return [
                    <tr key={x.id} className={cn("border-b border-foreground/[0.06] align-top", isOpen ? "bg-primary/[0.05]" : "hover:bg-foreground/[0.025]", !active && "text-foreground/70")}>
                      <td className="py-3 pl-4">
                        <Link href={href} scroll={false} aria-expanded={isOpen} aria-label={`${isOpen ? "Close" : "Open"} ${x.name}'s orders`} className="flex size-6 items-center justify-center rounded text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground">
                          <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
                        </Link>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link href={href} scroll={false} className="font-medium text-foreground hover:underline">{x.name}</Link>
                        <div className="text-[12px] text-foreground/75">{x.phone}</div>
                      </td>
                      <td className="px-3 py-3">
                        {x.subs.map((s) => (
                          <div key={s.id} className={cn("leading-relaxed", s.status !== "active" && "text-foreground/60")}>
                            <span className="text-foreground">{s.product}</span>
                            <span className="text-foreground/75"> × {s.qty} · {frequencyLabel(s.frequency, s.weekdays, s.every_n)}{s.end_date ? ` · until ${short(s.end_date)}` : ""}{s.status !== "active" ? " · paused" : ""}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-foreground">{short(since)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-foreground"><span className={cn("size-2 rounded-full", active ? "bg-emerald-600" : "bg-foreground/40")} />{active ? "Active" : "Paused"}</span>
                      </td>
                      <td className="max-w-xs px-3 py-3"><div className="truncate text-foreground/80" title={x.address}>{x.address}</div></td>
                      <td className="px-3 py-3 text-right text-foreground">{st?.orders ?? 0}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{rupees(st?.month ?? 0)}</td>
                    </tr>,
                    isOpen ? (
                      <tr key={`${x.id}-open`} className="border-b border-foreground/10">
                        <td colSpan={8} className="bg-foreground/[0.015] p-0">
                          <CustomerOrders customerId={x.id} phone={x.phone} canEdit={canEdit} />
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
                {list.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-foreground/75">No subscriptions yet. Customers start them from a product page in the app.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The open customer's subscription orders (same rows as D2C orders) and an invoice per month. */
async function CustomerOrders({ customerId, phone, canEdit }: { customerId: number; phone: string; canEdit: boolean }) {
  const [orders, labels, riders] = await Promise.all([
    subscriptionOrders(customerId, phone),
    productLabels(),
    query<{ id: number; name: string }>(`select id, name from shop_rider where active and kind = 'delivery' order by name`),
  ]);
  const now = new Date();
  const rows = orders.map((o) => toOrderRow(o, labels, now));
  const months = new Map<string, { n: number; charged: number }>();
  for (const o of orders) {
    const k = new Date(o.subscription_day as unknown as string).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
    const e = months.get(k) ?? { n: 0, charged: 0 };
    e.n++; if (isBilled(o)) e.charged += Number(o.total);
    months.set(k, e);
  }
  const charged = orders.filter(isBilled).reduce((a, o) => a + Number(o.total), 0);

  return (
    <div className="pt-1">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-1 text-[12px] font-medium text-foreground/75">Monthly invoices</span>
        {[...months].map(([k, m]) => (
          <a key={k} href={`/shop-orders/subscriptions/${customerId}/invoice?month=${k}`} target="_blank" rel="noreferrer"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-foreground/15 bg-card px-2.5 text-[12px] text-foreground hover:bg-foreground/[0.04]">
            <FileText className="size-3.5" /> {monthName(k)} <span className="tabular-nums text-foreground/75">{m.n} orders · {rupees(m.charged)}</span>
          </a>
        ))}
        {months.size === 0 ? <span className="text-[12px] text-foreground/75">No orders yet: they are made the evening before each delivery day.</span> : null}
      </div>
      {rows.length ? (
        <OrdersTable rows={rows} riders={riders} canEdit={canEdit} columnsButton={false}
          footer={<span className="tabular-nums">{rows.length} order{rows.length === 1 ? "" : "s"}{rows.length >= 500 ? " (latest 500)" : ""} · charged {rupees(charged)}</span>} />
      ) : null}
    </div>
  );
}
