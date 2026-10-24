import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Panel, Pill } from "@/components/cn/ui";
import { OrderDecision } from "@/components/masters/OrderDecision";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { getTradeOrder, listTradeOrders, tradeStatuses, type TradeKind } from "@/lib/app-orders";
import { rupees } from "@/lib/shop/pricing";
import { decideAppOrderAction } from "./actions";
import { Field, Filters, TradeStatus, placedVia, qty, when } from "./parts";

/** The Retailers and Distributors pages are the same apart from who the buyer is. */

const TITLE: Record<TradeKind, { title: string; one: string; subtitle: string; buyer: string }> = {
  retailers: { title: "Retailer orders", one: "Retailer", subtitle: "Orders retailers placed from the Gaia app.", buyer: "Retailer" },
  distributors: {
    title: "Distributor orders",
    one: "Distributor",
    subtitle: "Orders distributors placed from the Gaia app, and orders sales officers booked for them.",
    buyer: "Distributor",
  },
};

async function canDecide() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return !!me && (atLeast(levelFor(me, "apporders"), "edit") || atLeast(levelFor(me, "fp.portalOrder"), "edit"));
}

export async function TradeListPage({ kind, searchParams }: { kind: TradeKind; searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const [orders, statuses, decide] = await Promise.all([listTradeOrders(kind, { status, q }), tradeStatuses(kind), canDecide()]);
  const t = TITLE[kind];

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={Smartphone} title={t.title} subtitle={t.subtitle} />
        <Filters
          base={`/app-orders/${kind}`}
          statuses={statuses.map((s) => ({ value: s.status, label: s.status, n: s.n }))}
          status={status}
          q={q}
          placeholder="Search order #, name, code, phone, GSTIN, city"
        />

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {["Order", "Placed", t.buyer, "Location", "GSTIN", "Placed via", "Items", "Value", "Status", ""].map((h, i) => (
                  <th key={i} className={`whitespace-nowrap px-3 py-2 font-semibold ${h === "Items" || h === "Value" ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.uid} className="border-t border-border align-top hover:bg-muted/40">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link href={`/app-orders/${kind}/${o.uid}`} className="font-mono text-xs font-semibold text-primary hover:underline">#{o.orderId}</Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{when(o.placedAt)}</td>
                  <td className="min-w-48 px-3 py-2">
                    <Link href={`/app-orders/${kind}/${o.uid}`} className="font-medium hover:underline">{o.buyer}</Link>
                    <div className="font-mono text-xs text-muted-foreground">{o.buyerCode}{o.phone ? ` · ${o.phone}` : ""}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{[o.city, o.state].filter(Boolean).join(", ") || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{o.gstin || <span className="text-muted-foreground">-</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{placedVia(o)}</td>
                  <td className="num whitespace-nowrap px-3 py-2 text-right">{o.items}<div className="text-xs text-muted-foreground">{qty(o.qty)} units</div></td>
                  <td className="num whitespace-nowrap px-3 py-2 text-right font-medium">{rupees(o.total)}</td>
                  <td className="px-3 py-2"><TradeStatus status={o.status} />{o.reason ? <div className="mt-1 max-w-48 text-xs text-muted-foreground">{o.reason}</div> : null}</td>
                  <td className="px-3 py-2">{decide && o.status.toLowerCase() === "pending" ? <OrderDecision id={o.uid} orderId={String(o.orderId)} decide={decideAppOrderAction} /> : null}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">{q || status ? "No orders match." : `No ${t.one.toLowerCase()} orders from the app yet.`}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export async function TradeOrderPage({ kind, uid }: { kind: TradeKind; uid: string }) {
  const [o, decide] = await Promise.all([getTradeOrder(uid), canDecide()]);
  if (!o) notFound();
  const t = TITLE[o.kind];
  const b = o.buyerProfile;
  const mrpValue = o.lines.reduce((s, l) => s + l.mrp * l.qty, 0);
  const margin = mrpValue - o.total;
  const address = [b.address, b.area, o.city, b.district, o.state].filter((x, i, a) => x && a.findIndex((y) => y?.toLowerCase() === x.toLowerCase()) === i).join(", ");
  const map = b.lat && b.lng ? `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}` : null;
  const back = `/app-orders/${o.kind}`;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <PageHeader
          icon={Smartphone}
          title={`Order #${o.orderId}`}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <Pill tone="neutral" dot={false}>{t.one}</Pill>
              <TradeStatus status={o.status} />
              <span className="text-[12px]">Placed {when(o.placedAt)} · {placedVia(o)}</span>
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              {decide && o.status.toLowerCase() === "pending" ? <OrderDecision id={o.uid} orderId={String(o.orderId)} decide={decideAppOrderAction} size="md" /> : null}
              <Link href={back} className={buttonVariants({ variant: "outline" })}><ArrowLeft className="size-4" /> {t.title}</Link>
            </div>
          }
        />
        {kind !== o.kind ? <p className="text-[12px] text-tertiary-foreground">This is a {t.one.toLowerCase()} order.</p> : null}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-5">
            <Panel title="Items" description={`${o.lines.length} product${o.lines.length === 1 ? "" : "s"} · ${qty(o.qty)} units`} flush>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Product</th>
                      <th className="px-4 py-2 text-right font-semibold">Qty</th>
                      <th className="px-4 py-2 text-right font-semibold">Rate</th>
                      <th className="px-4 py-2 text-right font-semibold">MRP</th>
                      <th className="px-4 py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.lines.map((l) => (
                      <tr key={l.sku} className="border-t border-border">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element -- product photos come from our own API */}
                            {l.image ? <img src={l.image} alt="" className="size-10 rounded-md border border-border bg-white object-contain" /> : <div className="size-10 rounded-md border border-border" />}
                            <div><div className="font-medium">{l.name}</div><div className="font-mono text-[11px] text-muted-foreground">{l.sku}</div></div>
                          </div>
                        </td>
                        <td className="num px-4 py-2.5 text-right">{qty(l.qty)}</td>
                        <td className="num px-4 py-2.5 text-right">{rupees(l.rate)}</td>
                        <td className="num px-4 py-2.5 text-right text-muted-foreground">{rupees(l.mrp)}</td>
                        <td className="num px-4 py-2.5 text-right font-medium">{rupees(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border text-[13px]">
                    <tr><td colSpan={4} className="px-4 pt-3 text-right text-muted-foreground">Value at MRP</td><td className="num px-4 pt-3 text-right">{rupees(mrpValue)}</td></tr>
                    <tr><td colSpan={4} className="px-4 py-1 text-right text-muted-foreground">{t.one} margin</td><td className="num px-4 py-1 text-right">{rupees(margin)}</td></tr>
                    <tr className="font-semibold"><td colSpan={4} className="px-4 pb-3 text-right">Order value</td><td className="num px-4 pb-3 text-right">{rupees(o.total)}</td></tr>
                  </tfoot>
                </table>
              </div>
            </Panel>

            <Panel title="Processing" flush>
              <dl className="divide-y divide-border">
                <Field label="Status"><TradeStatus status={o.status} /></Field>
                <Field label="Cancel reason">{o.reason}</Field>
                <Field label="Order type">{o.orderType}</Field>
                <Field label="Accepted qty">{o.acceptedQty !== null ? qty(o.acceptedQty) : null}</Field>
                <Field label="Cancelled qty">{o.cancelledQty ? qty(o.cancelledQty) : null}</Field>
                <Field label="Invoiced qty">{o.invoiceQty ? qty(o.invoiceQty) : null}</Field>
                <Field label="Invoice no" mono>{o.invoiceNumber}</Field>
                <Field label="Note from app">{o.notes}</Field>
                <Field label="Last change">{when(o.updatedAt)}</Field>
              </dl>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel title={t.buyer} description={o.buyer} flush>
              <dl className="divide-y divide-border">
                <Field label="Name">{o.buyer}</Field>
                <Field label="Customer code" mono>{o.buyerCode}</Field>
                <Field label="Channel">{[b.channel, b.type, b.class ? `Class ${b.class}` : null].filter(Boolean).join(" · ")}</Field>
                <Field label="Status">{b.active ? "Active" : <span className="text-destructive">Inactive</span>}</Field>
                <Field label="Contact person">{b.contactPerson}</Field>
                <Field label="Phone">
                  {o.phone ? <a href={`tel:${o.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="size-3.5" /> {o.phone}</a> : null}
                </Field>
                <Field label="Email">
                  {b.email ? <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="size-3.5" /> {b.email}</a> : null}
                </Field>
                <Field label="Address">{address ? `${address}${b.pincode ? ` - ${b.pincode}` : ""}` : null}</Field>
                <Field label="Map">
                  {map ? <a href={map} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><MapPin className="size-3.5" /> Open in Google Maps</a> : null}
                </Field>
                <Field label="GSTIN" mono>{o.gstin}</Field>
                <Field label="PAN" mono>{b.pan}</Field>
                <Field label="Licence no" mono>{b.licenceNo}</Field>
                <Field label="ERP code" mono>{b.erpCode}</Field>
                <Field label="Credit limit">{b.creditLimit ? rupees(b.creditLimit) : null}</Field>
                <Field label="Route">{b.route}</Field>
                <Field label="Served by">{b.servedBy}</Field>
                <Field label="Sales contact">{b.salesContact ? `${b.salesContact}${b.salesContactPhone ? ` · ${b.salesContactPhone}` : ""}` : null}</Field>
              </dl>
            </Panel>

            <Panel title="Supplied by" flush>
              <dl className="divide-y divide-border">
                <Field label="Name">{o.supplier ?? "Not set"}</Field>
                <Field label="Code" mono>{o.supplierCode}</Field>
                <Field label="City">{o.supplierCity}</Field>
              </dl>
            </Panel>

            <Panel title="Placed via" flush>
              <dl className="divide-y divide-border">
                <Field label="From">{placedVia(o)}</Field>
                <Field label="App login" mono>{o.login?.phone}</Field>
                <Field label="Booked by">{o.appKind === "salesman" ? o.bookedBy : null}</Field>
                <Field label="Placed">{when(o.placedAt)}</Field>
              </dl>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
