import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Panel, Pill } from "@/components/cn/ui";
import { StatusSelect } from "@/components/shop/StatusSelect";
import { AssignSelect } from "@/components/shop/AssignSelect";
import { query } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { getOrderById } from "@/lib/shop/orders";
import { rupees } from "@/lib/shop/pricing";
import { d2cAccount } from "@/lib/app-orders";
import { D2cStatus, Field, dateOnly, when } from "../../parts";

export const dynamic = "force-dynamic";

/** One D2C order: what was ordered, where it goes, who it is for, and who is bringing it. */
export default async function D2cOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrderById(Number(id));
  if (!o) notFound();
  const [account, riders, me] = await Promise.all([
    d2cAccount(o.id),
    query<{ id: number; name: string }>(`select id, name from shop_rider where active order by name`),
    userFromToken((await cookies()).get("session")?.value),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");
  const map = o.lat !== null && o.lng !== null ? `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}` : null;
  const units = o.items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <PageHeader
          icon={Smartphone}
          title={`Order ${o.order_no}`}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <Pill tone="brand" dot={false}>D2C</Pill>
              <D2cStatus status={o.status} />
              {o.subscription_day ? <Pill tone="info" dot={false}>Subscription · {dateOnly(o.subscription_day)}</Pill> : null}
              <span className="text-[12px]">Placed {when(o.created_at)}</span>
            </span>
          }
          actions={<Link href="/app-orders/d2c" className={buttonVariants({ variant: "outline" })}><ArrowLeft className="size-4" /> D2C orders</Link>}
        />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            <Panel title="Items" description={`${o.items.length} product${o.items.length === 1 ? "" : "s"} · ${units} unit${units === 1 ? "" : "s"}`} flush>
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Product</th>
                    <th className="px-4 py-2 text-right font-semibold">Qty</th>
                    <th className="px-4 py-2 text-right font-semibold">Price</th>
                    <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.sku_code} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element -- product photos come from our own API */}
                          {i.image_url ? <img src={i.image_url} alt="" className="size-10 rounded-md border border-border bg-white object-contain" /> : <div className="size-10 rounded-md border border-border" />}
                          <div><div className="font-medium">{i.name}</div><div className="font-mono text-[11px] text-muted-foreground">{i.sku_code}</div></div>
                        </div>
                      </td>
                      <td className="num px-4 py-2.5 text-right">{i.qty}</td>
                      <td className="num px-4 py-2.5 text-right">{rupees(i.unit_price)}</td>
                      <td className="num px-4 py-2.5 text-right font-medium">{rupees(i.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border text-[13px]">
                  <tr><td colSpan={3} className="px-4 pt-3 text-right text-muted-foreground">Item total</td><td className="num px-4 pt-3 text-right">{rupees(o.subtotal)}</td></tr>
                  <tr><td colSpan={3} className="px-4 py-1 text-right text-muted-foreground">Delivery fee</td><td className="num px-4 py-1 text-right">{o.delivery_fee ? rupees(o.delivery_fee) : "Free"}</td></tr>
                  <tr className="font-semibold"><td colSpan={3} className="px-4 pb-3 text-right">Total</td><td className="num px-4 pb-3 text-right">{rupees(o.total)}</td></tr>
                </tfoot>
              </table>
            </Panel>

            <Panel title="Delivery" flush>
              <dl className="divide-y divide-border">
                <Field label="Deliver to">{o.name}</Field>
                <Field label="Address">{o.address}{o.pincode ? ` - ${o.pincode}` : ""}</Field>
                <Field label="Map">
                  {map ? <a href={map} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><MapPin className="size-3.5" /> Open pin in Google Maps</a> : <span className="text-amber-700">No map pin</span>}
                </Field>
                <Field label="Note">{o.notes}</Field>
                <Field label="Rider">{o.rider ? `${o.rider.name} · ${o.rider.phone}` : null}</Field>
                <Field label="Delivery code" mono>{o.delivery_otp}</Field>
                <Field label="Assigned">{o.assigned_at ? when(o.assigned_at) : null}</Field>
                <Field label="Picked up">{o.picked_up_at ? when(o.picked_up_at) : null}</Field>
                <Field label="Delivered">{o.delivered_at ? when(o.delivered_at) : null}</Field>
              </dl>
            </Panel>
          </div>

          <div className="space-y-5">
            {canEdit ? (
              <Panel title="Update">
                <div className="space-y-3 text-[13px]">
                  <label className="flex items-center justify-between gap-3"><span className="text-tertiary-foreground">Status</span><StatusSelect id={o.id} status={o.status} /></label>
                  <label className="flex items-center justify-between gap-3"><span className="text-tertiary-foreground">Rider</span><AssignSelect orderId={o.id} riderId={o.rider_id} riders={riders} /></label>
                </div>
              </Panel>
            ) : null}

            <Panel title="Customer" flush>
              <dl className="divide-y divide-border">
                <Field label="Name">{o.name}</Field>
                <Field label="Phone">
                  <a href={`tel:${o.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="size-3.5" /> {o.phone}</a>
                </Field>
                <Field label="Account">{account ? `Yes, since ${dateOnly(account.since)}` : "Ordered without an account"}</Field>
                <Field label="Orders">{account ? account.orders : null}</Field>
              </dl>
            </Panel>

            <Panel title="Payment" flush>
              <dl className="divide-y divide-border">
                <Field label="Method">{o.payment_method === "cod" ? "Cash on delivery" : o.payment_method}</Field>
                <Field label="Status">{o.payment_status === "paid" ? "Paid" : "To collect"}</Field>
                <Field label="Amount">{rupees(o.total)}</Field>
              </dl>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
