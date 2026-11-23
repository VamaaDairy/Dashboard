import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, Tiles } from "@/components/dash/Dash";
import { customerDetail } from "@/lib/d2c/sales";
import { STATUS_LABEL } from "@/lib/shop/pricing";
import { labelOf, productLabels } from "@/lib/products/names";
import { ProductLine } from "@/components/products/Product";

export const dynamic = "force-dynamic";

const rs = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const date = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—";
const when = (d: Date) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const FREQ: Record<string, string> = { daily: "Daily", alternate: "Alternate days", weekdays: "Chosen days", every_n: "Every few days", skip_n: "Daily, skip some" };

/** One D2C customer: account, numbers, every order, subscriptions and favourite products. */
export default async function D2cCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const d = Number.isInteger(id) ? await customerDetail(id) : null;
  if (!d) notFound();
  const { customer: c, orders, subs, products } = d;
  const labels = await productLabels();
  const cancelled = orders.filter((o) => o.status === "cancelled").length;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <Link href="/d2c/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Customer Master</Link>
        <PageHeader icon={UserRound} title={c.name} subtitle={`+91 ${c.phone}  ·  Joined ${date(c.joined)}${c.last_login ? `  ·  Last signed in ${date(c.last_login)}` : ""}`} />
        <Tiles
          items={[
            { label: "Orders", value: String(c.orders), note: cancelled ? `${cancelled} cancelled` : undefined },
            { label: "Total spend", value: rs(c.spend) },
            { label: "Average order", value: rs(c.orders ? c.spend / c.orders : 0) },
            { label: "First order", value: date(c.first_order) },
            { label: "Last order", value: date(c.last_order) },
            { label: "Active subscriptions", value: String(c.subscriptions) },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Address">
            <p className="text-sm">{c.address ?? "No address saved"}{c.pincode ? ` - ${c.pincode}` : ""}</p>
          </Panel>
          <Panel title="Buys most" description="By what they have spent on it.">
            {products.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : (
              <ul className="space-y-1.5 text-sm">
                {products.map((p) => (
                  <li key={p.sku} className="flex items-center justify-between gap-3"><span className="min-w-0 truncate"><ProductLine p={labelOf(labels, p.sku, p.name)} count={p.qty} /></span><span className="num font-medium">{rs(p.amount)}</span></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Subscriptions">
            {subs.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
              <ul className="space-y-2 text-sm">
                {subs.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3">
                    <span><ProductLine p={labelOf(labels, s.sku_code)} count={s.qty} /><span className="block text-xs text-muted-foreground">{FREQ[s.frequency] ?? s.frequency} · from {date(s.start_date)}{s.end_date ? ` to ${date(s.end_date)}` : ""}</span></span>
                    <span className="text-xs font-semibold capitalize text-muted-foreground">{s.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title={`Orders · ${orders.length}`}>
          <div className="-mx-4 -mb-4 overflow-x-auto border-t border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>{["Order", "Placed", "Items", "Payment", "Total", "Status"].map((h) => <th key={h} className={`whitespace-nowrap px-3 py-2 font-semibold ${h === "Total" ? "text-right" : ""}`}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-border align-top hover:bg-muted/40">
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link href={`/app-orders/d2c/${o.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{o.order_no}</Link>
                      {o.subscription_day ? <div className="mt-0.5 w-fit rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">SUBSCRIPTION</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{when(o.created_at)}</td>
                    <td className="min-w-64 px-3 py-2">{o.items}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{o.payment_method === "online" ? "Online" : o.payment_method === "prepaid" ? "Subscription pack" : o.payment_method === "autopay" ? "Autopay" : "Cash"}</td>
                    <td className="num whitespace-nowrap px-3 py-2 text-right font-medium">{rs(o.total)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{STATUS_LABEL[o.status] ?? o.status}</td>
                  </tr>
                ))}
                {orders.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No orders yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
