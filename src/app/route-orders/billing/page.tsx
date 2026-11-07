import Link from "next/link";
import { cookies } from "next/headers";
import { Download, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Panel, Pill } from "@/components/cn/ui";
import { Stat } from "@/app/app-orders/parts";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { billingDay, billsOf, nextVoucherNo, validDate } from "@/lib/route-orders/data";
import type { VoucherLine } from "@/lib/route-orders/calc";
import { cancelBillAction, issueBillsAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { Notice, inr2 } from "../parts";
import { labelOf, productLabels, type ProductLabel } from "@/lib/products/names";
import { ProductLine } from "@/components/products/Product";

export const dynamic = "force-dynamic";

const qtyText = (n: number) => String(Number(Number(n).toFixed(4)));

function Lines({ lines, labels }: { lines: VoucherLine[]; labels: Map<number, ProductLabel> }) {
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="px-2 py-1 font-medium">Product</th>
          <th className="px-2 py-1 font-medium">Pack qty</th>
          <th className="px-2 py-1 font-medium">Unit</th>
          <th className="px-2 py-1 font-medium">Tally item</th>
          <th className="px-2 py-1 font-medium">Sales ledger</th>
          <th className="px-2 py-1 text-right font-medium">Qty</th>
          <th className="px-2 py-1 text-right font-medium">Rate</th>
          <th className="px-2 py-1 text-right font-medium">GST</th>
          <th className="px-2 py-1 text-right font-medium">Amount</th>
          <th className="px-2 py-1 font-medium">Batch</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className="border-t border-border">
            <td className="px-2 py-1"><ProductLine p={labelOf(labels, l.sku, l.name)} /></td>
            <td className="num px-2 py-1">{labelOf(labels, l.sku, l.name).qty ?? "—"}</td>
            <td className="px-2 py-1">{labelOf(labels, l.sku, l.name).unit ?? "—"}</td>
            <td className="px-2 py-1">{l.item}</td>
            <td className="px-2 py-1 text-muted-foreground">{l.ledger}</td>
            <td className="num whitespace-nowrap px-2 py-1 text-right">{qtyText(l.qty)} {l.unit}</td>
            <td className="num whitespace-nowrap px-2 py-1 text-right">{inr2(l.rate)}/{l.unit}</td>
            <td className="num px-2 py-1 text-right">{l.gst}%</td>
            <td className="num whitespace-nowrap px-2 py-1 text-right">{inr2(l.amount)}</td>
            <td className="px-2 py-1 font-mono">{l.batch ?? "Given when made"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ date?: string; msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const date = validDate(sp.date);
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "routeorders.billing"), "edit");
  const [day, bills, next, labels] = await Promise.all([billingDay(date), billsOf(date), nextVoucherNo(date), productLabels()]);
  const live = bills.filter((b) => b.status === "issued");
  const readyTotal = day.ready.reduce((s, b) => s + b.total, 0);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader icon={ReceiptText} title="Billing" subtitle="Make the day's sales bills from confirmed orders and download them for Tally." />
        <form action="/route-orders/billing" className="flex items-center gap-2">
          <input type="date" name="date" defaultValue={date} aria-label="Order date" className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          <button className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted">Show</button>
        </form>

        {sp.msg ? <Notice tone="ok">{sp.msg}</Notice> : null}
        {sp.error ? <Notice tone="error">{sp.error}</Notice> : null}

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 md:grid-cols-4">
          <Stat label="Ready to make" value={day.ready.length} sub={inr2(readyTotal)} />
          <Stat label="Held up" value={day.blocked.length} sub="need a master fixed" />
          <Stat label="Orders still pending" value={day.pendingOrders} sub="not billed until confirmed" />
          <Stat label="Bills made" value={live.length} sub={inr2(live.reduce((s, b) => s + Number(b.total), 0))} />
        </div>

        {day.pendingOrders ? (
          <Notice tone="warn">
            {day.pendingOrders} order{day.pendingOrders === 1 ? " is" : "s are"} still pending for this date. <Link href="/app-orders/distributors?status=pending" className="font-medium underline">Confirm or cancel them</Link> to include them.
          </Notice>
        ) : null}
        {day.otherSupplierOrders ? <p className="text-xs text-muted-foreground">{day.otherSupplierOrders} order{day.otherSupplierOrders === 1 ? " is" : "s are"} supplied by a distributor, not the plant, so not billed here.</p> : null}

        {day.blocked.length ? (
          <Panel title="Held up" description="These can't be billed until the customer or product master is fixed." flush>
            <ul className="divide-y divide-border text-sm">
              {day.blocked.map((b) => (
                <li key={b.key} className="px-4 py-2.5">
                  <span className="font-medium">{b.partyName}</span>
                  <ul className="mt-1 list-disc pl-5 text-[13px] text-destructive">{b.issues.map((i) => <li key={i}>{i}</li>)}</ul>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-2.5"><Link href="/route-orders/masters" className={buttonVariants({ variant: "outline", size: "sm" })}>Fix in Customers & products</Link></div>
          </Panel>
        ) : null}

        <Panel title="Ready to make" description={`${day.ready.length} bill${day.ready.length === 1 ? "" : "s"}. Rates are the ones on the orders. Batches are given when the bills are made.`} flush>
          {day.ready.length ? (
            <>
              <ul className="divide-y divide-border text-sm">
                {day.ready.map((b) => (
                  <li key={b.key}>
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-muted/40">
                        <span className="min-w-64 flex-1 font-medium">{b.partyName}{b.part ? ` (${b.part === "MILK" ? "Milk" : "Other"})` : ""}</span>
                        <span className="text-xs text-muted-foreground">{b.ledger !== b.partyName ? `Ledger: ${b.ledger}` : ""}</span>
                        <span className="text-xs text-muted-foreground">{b.routeName ?? "No route"}</span>
                        {b.interstate ? <Pill tone="info">IGST</Pill> : null}
                        {b.warnings.length ? <Pill tone="warning">Check</Pill> : null}
                        <span className="num w-28 text-right font-medium">{inr2(b.total)}</span>
                      </summary>
                      <div className="space-y-2 border-t border-border bg-muted/20 px-4 py-3">
                        <Lines lines={b.lines} labels={labels} />
                        <p className="text-xs text-muted-foreground">Taxable {inr2(b.taxable)} · GST {inr2(b.cgst + b.sgst + b.igst)} · Round-off {inr2(b.roundoff)}</p>
                        {b.warnings.map((w) => <p key={w} className="text-xs text-amber-700">{w}</p>)}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
              {canEdit ? (
                <form action={issueBillsAction} className="flex flex-wrap items-end gap-3 border-t border-border px-4 py-3">
                  <input type="hidden" name="date" value={date} />
                  <label className="text-xs font-medium">Bill date
                    <input type="date" name="voucherDate" defaultValue={date} className="mt-1 block h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-medium">First bill number
                    <input type="number" name="startNo" min={1} defaultValue={next} required className="mt-1 block h-9 w-32 rounded-lg border border-input bg-background px-3 text-sm font-normal" />
                  </label>
                  <Button type="submit">Make {day.ready.length} bill{day.ready.length === 1 ? "" : "s"}</Button>
                </form>
              ) : null}
            </>
          ) : <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing waiting to be billed for this date.</p>}
        </Panel>

        <Panel
          title="Bills made"
          description="Import the file in Tally from Gateway of Tally > Import > Transactions."
          actions={live.length ? <a href={`/route-orders/billing/xml?date=${date}`} className={buttonVariants({ size: "sm" })}><Download className="size-4" /> Download Tally XML</a> : null}
          flush
        >
          {bills.length ? (
            <ul className="divide-y divide-border text-sm">
              {bills.map((b) => (
                <li key={b.id}>
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-muted/40">
                      <span className="w-36 font-mono text-xs font-semibold">{b.voucher_no}</span>
                      <span className={`min-w-64 flex-1 font-medium ${b.status === "cancelled" ? "text-muted-foreground line-through" : ""}`}>{b.party_name}</span>
                      <span className="text-xs text-muted-foreground">{b.route_name ?? "No route"}</span>
                      {b.status === "cancelled" ? <Pill tone="danger">Cancelled</Pill> : b.exported_at ? <Pill tone="success">Downloaded</Pill> : <Pill>Not downloaded</Pill>}
                      <span className="num w-28 text-right font-medium">{inr2(Number(b.total))}</span>
                    </summary>
                    <div className="space-y-2 border-t border-border bg-muted/20 px-4 py-3">
                      <Lines lines={b.data.lines} labels={labels} />
                      <p className="text-xs text-muted-foreground">Ledger {b.ledger} · Taxable {inr2(Number(b.taxable))} · GST {inr2(Number(b.tax))} · Round-off {inr2(Number(b.roundoff))} · Made by {b.created_by}</p>
                      {b.data.warnings.map((w) => <p key={w} className="text-xs text-amber-700">{w}</p>)}
                      {canEdit && b.status === "issued" ? (
                        <form action={cancelBillAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="date" value={date} />
                          <ConfirmButton message={`Cancel bill ${b.voucher_no}? Its orders can then be billed again. If a stockist's order is on two bills, both are cancelled. If it's already in Tally, cancel it there too.`}>Cancel bill</ConfirmButton>
                        </form>
                      ) : null}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-6 text-center text-sm text-muted-foreground">No bills made for this date.</p>}
        </Panel>
      </div>
    </div>
  );
}
