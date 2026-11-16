import Link from "next/link";
import { ProductCell } from "@/components/products/Product";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Mail, MapPin, Phone, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Panel, Pill } from "@/components/cn/ui";
import { OrderDecision } from "@/components/masters/OrderDecision";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { getTradeOrder, listTradeOrders, tradeStatuses, type TradeKind } from "@/lib/app-orders";
import { rupees } from "@/lib/shop/pricing";
import { decideAppOrderAction } from "./actions";
import { confirmSelectedAction } from "./edit-actions";
import { BulkConfirm, OrderEditor, ReopenButton } from "./order-editor";
import { cutoffFor, orderableProducts, orderEvents } from "@/lib/orders/direct";
import { Field, Filters, TradeStatus, dateOnly, placedVia, qty, when } from "./parts";

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

export async function TradeListPage({ kind, searchParams }: { kind: TradeKind; searchParams: Promise<{ status?: string; q?: string; date?: string }> }) {
  const { status, q, date } = await searchParams;
  const [orders, statuses, decide] = await Promise.all([listTradeOrders(kind, { status, q, date }), tradeStatuses(kind), canDecide()]);
  // direct app orders (the buyer's own sign-in) that are still pending can be ticked and confirmed together
  const tickable = (o: (typeof orders)[number]) => decide && o.status.toLowerCase() === "pending" && (o.appKind === "distributor" || o.appKind === "retailer");
  const anyTickable = orders.some(tickable);
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

        <div className="flex flex-wrap items-center gap-2">
          <form action={`/app-orders/${kind}`} className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-muted-foreground">Delivery date</span>
            <input type="date" name="date" defaultValue={date} className="h-8 rounded-md border border-border bg-background px-2" />
            {status ? <input type="hidden" name="status" value={status} /> : null}
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <button className="h-8 rounded-md border border-border px-2 hover:bg-muted">Show</button>
            {date ? <Link href={`/app-orders/${kind}${status ? `?status=${status}` : ""}`} className="px-1 text-muted-foreground hover:underline">All dates</Link> : null}
          </form>
          {anyTickable ? (
            <div className="ml-auto flex items-center gap-2">
              <form id="bulk-confirm" action={confirmSelectedAction} />
              <span className="text-xs text-muted-foreground">Tick pending orders, then</span>
              <BulkConfirm formId="bulk-confirm" />
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {["", "Order", "Placed", "Delivery", t.buyer, "Location", "GSTIN", "Placed via", "Items", "Value", "Status", ""].map((h, i) => (
                  <th key={i} className={`whitespace-nowrap px-3 py-2 font-semibold ${h === "Items" || h === "Value" ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.uid} className="border-t border-border align-top hover:bg-muted/40">
                  <td className="w-8 px-3 py-2">
                    {tickable(o) ? <input type="checkbox" name="uid" value={o.uid} form="bulk-confirm" aria-label={`Select order ${o.orderId}`} /> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link href={`/app-orders/${kind}/${o.uid}`} className="font-mono text-xs font-semibold text-primary hover:underline">#{o.orderId}</Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{when(o.placedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{o.deliveryDate ? dateOnly(o.deliveryDate) : "-"}</td>
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
                <tr><td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">{q || status ? "No orders match." : `No ${t.one.toLowerCase()} orders from the app yet.`}</td></tr>
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
  // a direct order (the buyer's own sign-in in the Gaia Distributors app) can be edited while pending, and reopened once confirmed
  const direct = o.appKind === "distributor" || o.appKind === "retailer";
  const pending = o.status.toLowerCase() === "pending";
  const editable = decide && direct && pending;
  const [history, products] = await Promise.all([orderEvents(o.uid), editable ? orderableProducts(o.uid) : Promise.resolve([])]);
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
              {decide && pending ? <OrderDecision id={o.uid} orderId={String(o.orderId)} decide={decideAppOrderAction} size="md" /> : null}
              {decide && direct && o.status === "Confirmed" ? <ReopenButton uid={o.uid} orderId={o.orderId} /> : null}
              {o.appKind ? <Link href={`/app-orders/invoice/${o.uid}`} className={buttonVariants({ variant: "outline" })}><FileText className="size-4" /> Invoice</Link> : null}
              <Link href={back} className={buttonVariants({ variant: "outline" })}><ArrowLeft className="size-4" /> {t.title}</Link>
            </div>
          }
        />
        {kind !== o.kind ? <p className="text-[12px] text-tertiary-foreground">This is a {t.one.toLowerCase()} order.</p> : null}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-5">
            {editable ? (
              <Panel title="Items" description="Pending: change quantities, remove or add products, then save. The buyer is told what changed." flush>
                <OrderEditor uid={o.uid} lines={o.lines.map((l) => ({ sku: l.sku, name: l.name, qty: Number(l.qty), rate: Number(l.rate), split: l.split }))} products={products} />
              </Panel>
            ) : (
              <Panel title="Items" description={`${o.lines.length} product${o.lines.length === 1 ? "" : "s"} · ${qty(o.qty)} units`} flush>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Product</th>
                        <th className="px-4 py-2 font-semibold">Pack qty</th>
                        <th className="px-4 py-2 font-semibold">Unit</th>
                        <th className="px-4 py-2 text-right font-semibold">Ordered</th>
                        <th className="px-4 py-2 text-right font-semibold">Rate</th>
                        <th className="px-4 py-2 text-right font-semibold">MRP</th>
                        <th className="px-4 py-2 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.lines.map((l) => (
                        <tr key={l.sku} className="border-t border-border">
                          <td className="px-4 py-2.5">
                            <ProductCell p={{ sku: l.sku, skuNo: null, name: l.name, qty: l.packQty, unit: l.unit, image: l.image, inMaster: true }} size={40} />
                          </td>
                          <td className="num px-4 py-2.5">{l.packQty ?? "—"}</td>
                          <td className="px-4 py-2.5">{l.unit ?? "—"}</td>
                          <td className="num px-4 py-2.5 text-right">
                            {qty(l.qty)}
                            {l.split ? <div className="text-[11px] font-semibold text-muted-foreground">{l.split}</div> : null}
                          </td>
                          <td className="num px-4 py-2.5 text-right">{rupees(l.rate)}</td>
                          <td className="num px-4 py-2.5 text-right text-muted-foreground">{rupees(l.mrp)}</td>
                          <td className="num px-4 py-2.5 text-right font-medium">{rupees(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-border text-[13px]">
                      <tr><td colSpan={6} className="px-4 pt-3 text-right text-muted-foreground">Value at MRP</td><td className="num px-4 pt-3 text-right">{rupees(mrpValue)}</td></tr>
                      <tr><td colSpan={6} className="px-4 py-1 text-right text-muted-foreground">{t.one} margin</td><td className="num px-4 py-1 text-right">{rupees(margin)}</td></tr>
                      <tr className="font-semibold"><td colSpan={6} className="px-4 pb-3 text-right">Order value</td><td className="num px-4 pb-3 text-right">{rupees(o.total)}</td></tr>
                    </tfoot>
                  </table>
                </div>
              </Panel>
            )}

            <Panel title="Processing" flush>
              <dl className="divide-y divide-border">
                <Field label="Status"><TradeStatus status={o.status} /></Field>
                <Field label="Delivery date">{o.deliveryDate ? dateOnly(o.deliveryDate) : null}</Field>
                <Field label="Buyer can change it until">{direct && pending && o.deliveryDate ? when(cutoffFor(o.deliveryDate)) : null}</Field>
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

            {direct || history.length ? (
              <Panel title="History" description="Every step of this order, oldest first: from placing it to its delivery." flush>
                <ol className="divide-y divide-border text-sm">
                  {history.map((e, i) => (
                    <li key={i} className="px-4 py-2.5">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium capitalize">{e.action.replace("_", " ")}</span>
                        <span className="text-xs text-muted-foreground">by {e.actor}{e.actorKind === "app" ? " (app)" : e.actorKind === "transporter" ? " (transporter)" : ""} · {when(e.at)}</span>
                      </div>
                      {e.changes?.length ? (
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {e.changes.map((ch) => (
                            <li key={ch.sku}>
                              {ch.name}: {ch.from === 0 ? <span className="text-emerald-700">added {qty(ch.to)}</span> : ch.to === 0 ? <span className="text-destructive">removed (was {qty(ch.from)})</span> : <>{qty(ch.from)} → <b>{qty(ch.to)}</b></>}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {e.note ? <div className="mt-1 text-xs text-muted-foreground">“{e.note}”</div> : null}
                    </li>
                  ))}
                  {!history.length ? <li className="px-4 py-3 text-muted-foreground">No history recorded for this order.</li> : null}
                </ol>
              </Panel>
            ) : null}
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
