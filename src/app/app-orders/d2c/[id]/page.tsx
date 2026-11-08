import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Printer, Smartphone } from "lucide-react";
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
import { paymentsOf } from "@/lib/payments/easebuzz";
import { D2cStatus, Field, dateOnly, when } from "../../parts";
import { RouteMap } from "@/components/shop/RouteMap";
import { D2cInvoice, isBilled } from "@/components/shop/D2cInvoice";
import { AMBER, GREEN, GREY, NAVY, type MapMarker } from "@/components/shop/route-colors";
import { orderTrack } from "@/lib/shop/track";

export const dynamic = "force-dynamic";

/** One D2C order: what was ordered, where it goes, who it is for, and who is bringing it. */
export default async function D2cOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrderById(Number(id));
  if (!o) notFound();
  const [account, riders, me, payments, track] = await Promise.all([
    d2cAccount(o.id),
    query<{ id: number; name: string }>(`select id, name from shop_rider where active and kind = 'delivery' order by name`),
    userFromToken((await cookies()).get("session")?.value),
    paymentsOf(o.id),
    orderTrack(o.id).catch(() => null),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");
  const map = o.lat !== null && o.lng !== null ? `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}` : null;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <PageHeader
          icon={Smartphone}
          title={`Order ${o.order_no}`}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <Pill tone="neutral" dot={false}>D2C</Pill>
              <D2cStatus status={o.status} />
              {o.subscription_day ? <Pill tone="neutral" dot={false}>Subscription · {dateOnly(o.subscription_day)}</Pill> : null}
              <span className="text-[12px]">Placed {when(o.created_at)}</span>
            </span>
          }
          actions={<Link href="/shop-orders" className={buttonVariants({ variant: "outline" })}><ArrowLeft className="size-4" /> D2C orders</Link>}
        />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            <DeliveryRoute t={track} status={o.status} orderId={o.id} />
            <section className="overflow-hidden rounded-lg border border-foreground/10 bg-card">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3">
                <div>
                  <div className="text-[14px] font-semibold text-foreground">Invoice</div>
                  <div className="text-[12px] text-foreground/75">
                    {isBilled(o) ? "The same invoice the customer downloads in the Gaia app." : o.status === "cancelled" || o.payment_status === "refunded" ? "Not charged: the order was cancelled or refunded." : "Not charged yet: the customer is billed once the order is delivered."}
                  </div>
                </div>
                <a href={`/app-orders/d2c/${o.id}/invoice`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-foreground/15 px-3 text-[13px] font-medium text-foreground hover:bg-foreground/[0.04]">
                  <Printer className="size-4" /> Print or save PDF
                </a>
              </header>
              <D2cInvoice o={o} />
            </section>

            <Panel title="Delivery" flush>
              <dl className="divide-y divide-border">
                <Field label="Deliver to">{o.name}</Field>
                <Field label="Address">{o.address}{o.pincode ? ` - ${o.pincode}` : ""}</Field>
                <Field label="Map">
                  {map ? <a href={map} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><MapPin className="size-3.5" /> Open pin in Google Maps</a> : <span className="text-muted-foreground">No map pin</span>}
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
                <Field label="Method">{o.payment_method === "cod" ? "Cash on delivery" : "Online (Easebuzz)"}</Field>
                <Field label="Status">
                  {o.payment_status === "paid" ? (o.payment_method === "online" ? "Paid online" : "Paid") : o.payment_status === "refunded" ? "Refunded" : o.status === "awaiting_payment" ? "Waiting for the customer to pay" : "To collect"}
                </Field>
                <Field label="Amount">{rupees(o.total)}</Field>
              </dl>
              {payments.length ? (
                // every Easebuzz attempt, newest first: the transaction id is what Easebuzz's dashboard knows it by
                <ul className="divide-y divide-border border-t border-border text-[12px]">
                  {payments.map((p) => (
                    <li key={p.txnid} className="flex items-center justify-between gap-3 px-4 py-2">
                      <div className="min-w-0">
                        <div className="font-mono">{p.txnid}</div>
                        <div className="text-tertiary-foreground">{when(p.updated_at)}{p.mode ? ` · ${p.mode}` : ""}{p.easepayid ? ` · ${p.easepayid}` : ""}</div>
                      </div>
                      <Pill tone={p.status === "success" ? "success" : p.status === "initiated" ? "neutral" : "danger"}>{p.status}</Pill>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

const hm = (s: string | null) => (s ? new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const km = (m: number) => `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`;

/** The route on a map: what the rider actually rode to this order, the route the map advised, and whether it was delivered. */
function DeliveryRoute({ t, status, orderId }: { t: Awaited<ReturnType<typeof orderTrack>>; status: string; orderId: number }) {
  if (!t) return null;
  const { order: o, leg, trip, planned } = t;
  const taken = leg?.points ? leg : trip;
  const delivered = status === "delivered" || !!o.deliveredAt;
  const markers: MapMarker[] = [];
  const start = t.legFrom ?? t.store;
  markers.push({ lng: start.lng, lat: start.lat, label: t.legFrom ? `From ${t.legFrom.orderNo.slice(-4)}` : "House of Gaia", color: GREY });
  if (o.lat != null && o.lng != null) markers.push({ lng: o.lng, lat: o.lat, label: delivered ? "Delivered here" : "Customer", color: delivered ? GREEN : AMBER, popup: o.address });
  const last = taken?.segments.at(-1)?.at(-1);
  if (t.live && last) markers.push({ lng: last[0], lat: last[1], label: t.rider?.name.split(" ")[0] ?? "Rider", color: "#111827" });
  const canMap = o.lat != null && o.lng != null;

  return (
    <section id="route" className="scroll-mt-4 overflow-hidden rounded-lg border border-foreground/10 bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
          <span className={`size-2.5 rounded-full ${delivered ? "bg-emerald-600" : status === "cancelled" ? "bg-destructive" : "bg-amber-500"}`} />
          {delivered ? `Delivered ${hm(o.deliveredAt)}` : status === "cancelled" ? "Cancelled, not delivered" : o.pickedUpAt ? "Not delivered yet: on the way" : "Not delivered yet"}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-foreground">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-1 w-5 rounded" style={{ background: NAVY }} />Route taken{taken?.points ? ` · ${km(taken.metres)}` : ""}</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: GREY }} />Advised route{planned ? ` · ${km(planned.metres)} · about ${Math.round(planned.secs / 60)} min` : ""}</span>
          {o.pickedUpAt ? <a href={`/shop-orders/track/${orderId}`} className="font-medium text-primary hover:underline">Full route details</a> : null}
        </div>
      </header>
      {canMap ? (
        <div className="p-3">
          <RouteMap track={taken?.segments ?? []} planned={planned?.path} markers={markers} live={t.live} height="340px" />
          {!o.pickedUpAt ? <p className="mt-2 text-[13px] text-foreground/75">The route shows once the rider picks the order up.</p>
            : !taken?.points ? <p className="mt-2 text-[13px] text-foreground/75">No route was recorded for this trip (the rider&apos;s phone was off duty or offline).</p> : null}
        </div>
      ) : <p className="px-4 py-4 text-[13px] text-foreground/75">This order has no map pin, so there is no route to show.</p>}
    </section>
  );
}
