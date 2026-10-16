import { notFound } from "next/navigation";
import { PrintButton } from "@/components/orders/PrintButton";
import { inr } from "@/components/orders/common";
import { query, one } from "@/lib/db";
import { getSettings } from "@/lib/orders/settings";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

/** /orders/print?id=<order> prints an invoice; /orders/print?load=YYYY-MM-DD prints that day's load sheet. */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  if (sp.id) return <Invoice id={sp.id} />;
  if (/^\d{4}-\d{2}-\d{2}$/.test(sp.load ?? "")) return <LoadSheet day={sp.load} />;
  notFound();
}

const sheet = "mx-auto my-6 w-full max-w-3xl rounded-lg border border-border bg-white p-8 text-[13px] text-black print:my-0 print:max-w-none print:border-0 print:p-0";

async function Invoice({ id }: { id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const o = await one<{
    order_no: string; kind: string; order_date: string; status: string; customer: string | null; address: string | null; city: string | null;
    gst_no: string | null; phone: string | null; staff: string | null; subtotal: number; tax: number; total: number; invoice_no: string | null; due: string | null;
  }>(
    `select o.order_no, o.kind, to_char(o.order_date,'DD Mon YYYY') as order_date, o.status, coalesce(c.name, o.customer_name) as customer,
            c.address, c.city, c.gst_no, c.phone, s.name as staff, o.subtotal, o.tax, o.total,
            i.invoice_no, to_char(i.due_date,'DD Mon YYYY') as due
       from ord_order o left join ord_customer c on c.id = o.customer_id left join ord_staff s on s.id = o.staff_id
       left join ord_invoice i on i.order_id = o.id where o.id = $1`, [id]);
  if (!o) notFound();
  const lines = await query<{ sku: string; name: string; qty: number; rate: number; discount_pct: number; gst_pct: number; amount: number }>(
    `select p.sku, p.name, i.qty, i.rate, i.discount_pct, i.gst_pct, i.amount from ord_order_item i join ord_product p on p.id = i.product_id where i.order_id = $1 order by p.name`, [id]);
  const footer = (await getSettings()).invoice_footer;
  const byGst = new Map<number, number>();
  for (const l of lines) byGst.set(l.gst_pct, (byGst.get(l.gst_pct) ?? 0) + (l.amount * l.gst_pct) / 100);

  return (
    <div className="flex-1 bg-muted/40 p-4 print:bg-white print:p-0">
      <div className="mx-auto flex max-w-3xl justify-end print:hidden"><PrintButton /></div>
      <div className={sheet}>
        <div className="flex items-start justify-between border-b border-black/20 pb-4">
          <div>
            <h1 className="text-xl font-bold">{o.invoice_no ? "Tax invoice" : o.kind === "counter" ? "Cash memo" : "Order"}</h1>
            <p className="text-black/60">{o.invoice_no ?? o.order_no}</p>
          </div>
          <div className="text-right">
            <p>Order {o.order_no}</p><p>Date {o.order_date}</p>{o.due && <p>Due {o.due}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase text-black/50">Billed to</p>
            <p className="font-semibold">{o.customer ?? "Walk-in"}</p>
            {o.address && <p>{o.address}</p>}
            {o.city && <p>{o.city}</p>}
            {o.gst_no && <p>GSTIN {o.gst_no}</p>}
            {o.phone && <p>{o.phone}</p>}
          </div>
          <div className="text-right"><p className="text-[11px] font-semibold uppercase text-black/50">Salesman</p><p>{o.staff ?? "—"}</p></div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-y border-black/30 text-left text-[11px] uppercase">
              <th className="py-1.5">SKU</th><th>Product</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Disc</th><th className="text-right">GST</th><th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.sku} className="border-b border-black/10">
                <td className="py-1.5">{l.sku}</td><td>{l.name}</td><td className="text-right">{l.qty}</td><td className="text-right">{inr(l.rate)}</td>
                <td className="text-right">{l.discount_pct ? `${l.discount_pct}%` : ""}</td><td className="text-right">{l.gst_pct}%</td><td className="text-right">{inr(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-4 w-64 space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{inr(o.subtotal)}</span></div>
          {[...byGst.entries()].filter(([, v]) => v > 0).map(([rate, v]) => (
            <div key={rate} className="flex justify-between text-black/70"><span>GST {rate}%</span><span>{inr(Math.round(v * 100) / 100)}</span></div>
          ))}
          <div className="flex justify-between border-t border-black/30 pt-1 text-base font-bold"><span>Total</span><span>{inr(o.total)}</span></div>
        </div>
        {footer && <p className="mt-10 border-t border-black/10 pt-3 text-center text-black/60">{footer}</p>}
      </div>
    </div>
  );
}

async function LoadSheet({ day }: { day: string }) {
  const rows = await query<{ sku: string; name: string; qty: number; orders: number }>(
    `select p.sku, p.name, sum(i.qty) as qty, count(distinct o.id)::int as orders
       from ord_order_item i join ord_order o on o.id = i.order_id join ord_product p on p.id = i.product_id
      where o.order_date = $1 and o.status in ('approved','invoiced') and o.kind <> 'counter'
      group by p.id order by p.name`, [day]);
  const orders = await query<{ order_no: string; customer: string | null; total: number }>(
    `select o.order_no, c.name as customer, o.total from ord_order o left join ord_customer c on c.id = o.customer_id
      where o.order_date = $1 and o.status in ('approved','invoiced') and o.kind <> 'counter' order by o.order_no`, [day]);
  return (
    <div className="flex-1 bg-muted/40 p-4 print:bg-white print:p-0">
      <div className="mx-auto flex max-w-3xl justify-end print:hidden"><PrintButton /></div>
      <div className={sheet}>
        <h1 className="text-xl font-bold">Load sheet - {day}</h1>
        <p className="mb-4 text-black/60">{orders.length} approved / invoiced orders to dispatch</p>
        <table className="w-full">
          <thead><tr className="border-y border-black/30 text-left text-[11px] uppercase"><th className="py-1.5">SKU</th><th>Product</th><th className="text-right">Orders</th><th className="text-right">Total qty</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.sku} className="border-b border-black/10"><td className="py-1.5">{r.sku}</td><td>{r.name}</td><td className="text-right">{r.orders}</td><td className="text-right font-semibold">{r.qty}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-black/50">Nothing to load for this date.</td></tr>}
          </tbody>
        </table>
        {orders.length > 0 && (
          <>
            <h2 className="mt-6 mb-1 font-semibold">Orders</h2>
            <ul className="columns-2 text-black/80">{orders.map((o) => <li key={o.order_no}>{o.order_no} - {o.customer ?? "Walk-in"} ({inr(o.total)})</li>)}</ul>
          </>
        )}
      </div>
    </div>
  );
}
