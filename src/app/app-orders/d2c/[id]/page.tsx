import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, MapPin, Phone, Printer } from "lucide-react";
import { StatusSelect } from "@/components/shop/StatusSelect";
import { AssignSelect } from "@/components/shop/AssignSelect";
import { query } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { getOrderById } from "@/lib/shop/orders";
import { STATUS_LABEL, rupees } from "@/lib/shop/pricing";
import { d2cAccount } from "@/lib/app-orders";
import { paymentsOf } from "@/lib/payments/easebuzz";
import { dateOnly, when } from "../../parts";
import { RouteMap } from "@/components/shop/RouteMap";
import { D2cInvoice, isBilled } from "@/components/shop/D2cInvoice";
import { GREEN, GREY, NAVY, type MapMarker } from "@/components/shop/route-colors";
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

  const statusDot: Record<string, string> = {
    awaiting_payment: "bg-warning", placed: "bg-foreground/40", confirmed: "bg-foreground/60", out_for_delivery: "bg-primary", delivered: "bg-emerald-600", cancelled: "bg-destructive",
  };
  const paidText = o.payment_status === "paid" ? (o.payment_method === "cod" ? "Cash collected" : "Paid") : o.payment_status === "refunded" ? "Refunded" : o.status === "awaiting_payment" ? "Waiting for the customer to pay" : o.payment_method === "cod" ? "To collect on delivery" : "Not paid yet";

  return (
    <div className="flex flex-1 flex-col bg-background px-4 pt-6 pb-8 md:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <Link href="/shop-orders" className="inline-flex items-center gap-1 text-[13px] text-foreground/75 hover:text-foreground"><ArrowLeft className="size-4" /> D2C orders</Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Order {o.order_no}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 text-[13px] text-foreground/75">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground"><span className={`size-2 rounded-full ${statusDot[o.status] ?? "bg-foreground/40"}`} />{o.status === "placed" ? "New" : STATUS_LABEL[o.status] ?? o.status}</span>
              <span>·</span>
              <span>{o.subscription_day ? `Subscription for ${dateOnly(o.subscription_day)}` : "Regular order"}</span>
              <span>·</span>
              <span>Placed {when(o.created_at)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-semibold tracking-tight tabular-nums text-foreground">{rupees(o.total)}</div>
            <div className="text-[13px] text-foreground/75">{o.payment_method === "cod" ? "Cash on delivery" : o.payment_method === "autopay" ? "UPI Autopay" : "Online"} · {paidText}</div>
          </div>
        </div>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-5">
            <DeliveryRoute t={track} status={o.status} orderId={o.id} />
            <details className="group overflow-hidden rounded-lg border border-foreground/10 bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-foreground/[0.02] [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-foreground">Invoice <span className="ml-1 font-normal text-foreground/75">INV-{o.order_no}</span></div>
                  <div className="text-[12px] text-foreground/75">
                    {isBilled(o) ? "Charged · same as the invoice in the customer's app" : o.status === "cancelled" || o.payment_status === "refunded" ? "Not charged: cancelled or refunded" : "Not charged yet: billed once delivered"}
                  </div>
                </div>
                <span className="flex items-center gap-3 text-[13px] text-foreground">
                  <span className="font-semibold tabular-nums">{rupees(o.total)}</span>
                  <ChevronDown className="size-4 text-foreground/70 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <div className="border-t border-foreground/10">
                <div className="flex justify-end px-4 pt-3">
                  <a href={`/app-orders/d2c/${o.id}/invoice`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-foreground/15 px-3 text-[13px] font-medium text-foreground hover:bg-foreground/[0.04]">
                    <Printer className="size-4" /> Print or save PDF
                  </a>
                </div>
                <D2cInvoice o={o} />
              </div>
            </details>

            <Section title="Delivery">
              <KV label="Deliver to">{o.name}</KV>
              <KV label="Address">{o.address}{o.pincode && !o.address.includes(o.pincode) ? ` - ${o.pincode}` : ""}</KV>
              <KV label="Map">{map ? <a href={map} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><MapPin className="size-3.5" /> Open pin in Google Maps</a> : "No map pin"}</KV>
              <KV label="Note">{o.notes}</KV>
              <KV label="Rider">{o.rider ? `${o.rider.name} · ${o.rider.phone}` : null}</KV>
              <KV label="Delivery code" mono>{o.delivery_otp}</KV>
              <KV label="Assigned">{o.assigned_at ? when(o.assigned_at) : null}</KV>
              <KV label="Picked up">{o.picked_up_at ? when(o.picked_up_at) : null}</KV>
              <KV label="Delivered">{o.delivered_at ? when(o.delivered_at) : null}</KV>
            </Section>
          </div>

          <aside className="space-y-7 lg:pt-1">
            {canEdit ? (
              <Section title="Update">
                <label className="flex items-center justify-between gap-3 py-1 text-[13px]"><span className="text-foreground/75">Status</span><StatusSelect id={o.id} status={o.status} /></label>
                <label className="flex items-center justify-between gap-3 py-1 text-[13px]"><span className="text-foreground/75">Rider</span><AssignSelect orderId={o.id} riderId={o.rider_id} riders={riders} /></label>
              </Section>
            ) : null}

            <Section title="Customer">
              <KV label="Name">{o.name}</KV>
              <KV label="Phone"><a href={`tel:${o.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="size-3.5" /> {o.phone}</a></KV>
              <KV label="Account">{account ? `Since ${dateOnly(account.since)}` : "No account"}</KV>
              <KV label="Orders">{account ? account.orders : null}</KV>
            </Section>

            <Section title="Payment">
              <KV label="Method">{o.payment_method === "cod" ? "Cash on delivery" : o.payment_method === "autopay" ? "UPI Autopay" : "Online (Easebuzz)"}</KV>
              <KV label="Status">{paidText}</KV>
              <KV label="Amount">{rupees(o.total)}</KV>
              {payments.length ? (
                // every Easebuzz attempt, newest first: the transaction id is what Easebuzz's dashboard knows it by
                <div className="pt-2">
                  <div className="pb-1 text-[12px] text-foreground/75">Payment attempts</div>
                  {payments.map((p) => (
                    <div key={p.txnid} className="flex items-start justify-between gap-3 py-1.5 text-[12px]">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-foreground">{p.txnid}</div>
                        <div className="text-foreground/75">{when(p.updated_at)}{p.mode ? ` · ${p.mode}` : ""}</div>
                      </div>
                      <span className={p.status === "success" ? "font-medium text-emerald-700" : p.status === "initiated" ? "text-foreground/75" : "font-medium text-destructive"}>{p.status}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </Section>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** A titled block of details, without a box. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[13px] font-semibold text-foreground">{title}</h2>
      <dl className="space-y-0.5">{children}</dl>
    </section>
  );
}

function KV({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-1 text-[13px]">
      <dt className="text-foreground/75">{label}</dt>
      <dd className={`min-w-0 break-words text-foreground ${mono ? "font-mono" : ""}`}>{children}</dd>
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
  markers.push({ lng: start.lng, lat: start.lat, label: t.legFrom ? `Previous drop ${t.legFrom.orderNo}` : "House of Gaia", color: GREY });
  if (o.lat != null && o.lng != null) markers.push({ lng: o.lng, lat: o.lat, label: delivered ? "Delivered" : "Customer", color: delivered ? GREEN : NAVY, popup: o.address });
  const last = taken?.segments.at(-1)?.at(-1);
  if (t.live && last) markers.push({ lng: last[0], lat: last[1], label: t.rider?.name.split(" ")[0] ?? "Rider", color: "#111827" });
  const canMap = o.lat != null && o.lng != null;
  const state = delivered ? `Delivered ${hm(o.deliveredAt)}` : status === "cancelled" ? "Cancelled, not delivered" : o.pickedUpAt ? "On the way, not delivered yet" : "Not picked up yet";
  const note = !canMap ? "This order has no map pin, so there is no route to show."
    : !o.pickedUpAt ? "The route shows once the rider picks the order up."
    : !taken?.points ? "No route was recorded for this trip: the rider's phone was off duty or offline." : null;

  return (
    <section id="route" className="scroll-mt-4 overflow-hidden rounded-lg border border-foreground/10 bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
        <div className="text-[14px] font-semibold text-foreground">Delivery route</div>
        <div className="flex items-baseline gap-4 text-[13px]">
          <span className={delivered ? "font-medium text-foreground" : "text-foreground"}>{state}</span>
          {o.pickedUpAt ? <a href={`/shop-orders/track/${orderId}`} className="text-primary hover:underline">Full details</a> : null}
        </div>
      </header>
      {canMap ? <RouteMap plain track={taken?.segments ?? []} planned={planned?.path} markers={markers} live={t.live} height="360px" /> : null}
      <footer className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-foreground/10 px-4 py-2.5 text-[12px] text-foreground/80">
        {note ? <span>{note}</span> : (
          <>
            <span className="inline-flex items-center gap-2"><svg width="22" height="6" aria-hidden><line x1="1" y1="3" x2="21" y2="3" stroke={NAVY} strokeWidth="3" strokeLinecap="round" /></svg>Route taken{taken?.points ? <span className="tabular-nums text-foreground">{km(taken.metres)}</span> : null}</span>
            <span className="inline-flex items-center gap-2"><svg width="22" height="6" aria-hidden><line x1="1" y1="3" x2="21" y2="3" stroke={GREY} strokeWidth="2.5" strokeDasharray="4 3" /></svg>Advised route{planned ? <span className="tabular-nums text-foreground">{km(planned.metres)} · {Math.round(planned.secs / 60)} min</span> : null}</span>
          </>
        )}
      </footer>
    </section>
  );
}
