import { notFound } from "next/navigation";
import { invoiceFor, type InvoiceParty } from "@/lib/distributor/invoice";
import { PrintButton } from "./print";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: string) => new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });

function Party({ title, p }: { title: string; p: InvoiceParty }) {
  return (
    <div className="space-y-0.5 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="font-semibold">{p.name}{p.code ? <span className="ml-1 font-mono text-xs font-normal text-neutral-500">({p.code})</span> : null}</div>
      {p.address ? <div>{p.address}</div> : null}
      {p.state ? <div>State: {p.state}</div> : null}
      {p.gstin ? <div>GSTIN: <span className="font-mono">{p.gstin}</span></div> : null}
      {p.phone ? <div>Phone: {p.phone}</div> : null}
    </div>
  );
}

/** The invoice of an app order, laid out to print on A4 (the same invoice the Gaia Partners app shows). */
export default async function InvoicePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(uid)) notFound();
  const v = await invoiceFor(uid);
  if (!v) notFound();
  const th = "border border-neutral-300 px-2 py-1.5 text-left font-semibold";
  const td = "border border-neutral-300 px-2 py-1.5";
  const num = `${td} text-right tabular-nums`;

  return (
    <div className="flex flex-1 justify-center bg-neutral-100 p-4 print:bg-white print:p-0">
      <div className="w-full max-w-[210mm] space-y-3">
        <div className="flex justify-end print:hidden"><PrintButton /></div>
        <article className="relative bg-white p-6 text-[12.5px] leading-snug text-neutral-900 shadow print:shadow-none">
          {v.cancelled ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-black text-red-500/20 -rotate-12">CANCELLED</div> : null}
          <header className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-4">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- our own logo, printed as is */}
              <img src="/gaia-logo.jpg" alt="Gaia" className="h-16 w-auto" />
              <div>
                <div className="text-base font-bold">{v.seller.name}</div>
                {v.seller.address ? <div className="max-w-72 text-neutral-600">{v.seller.address}</div> : null}
                {v.seller.gstin ? <div className="text-neutral-600">GSTIN: <span className="font-mono">{v.seller.gstin}</span></div> : null}
                {v.seller.phone || v.seller.email ? <div className="text-neutral-600">{[v.seller.phone, v.seller.email].filter(Boolean).join(" · ")}</div> : null}
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold tracking-tight">Invoice</h1>
              <div>No: <span className="font-mono font-semibold">{v.invoiceNo}</span></div>
              <div>Date: {day(v.issuedAt)}</div>
              <div>Order: #{v.orderId} · {day(v.orderDate)}</div>
            </div>
          </header>
          <div className="border-b border-neutral-300">
            <Party title="Billed to" p={v.buyer} />
          </div>

          <table className="mt-3 w-full border-collapse">
            <thead className="bg-neutral-100">
              <tr>
                <th className={th}>#</th><th className={th}>Product</th><th className={th}>Pack qty</th><th className={th}>Unit</th><th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-right`}>MRP</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {v.lines.map((l, i) => (
                <tr key={l.sku}>
                  <td className={td}>{i + 1}</td>
                  <td className={td}><div className="font-mono text-[10.5px] text-neutral-500">{l.sku}</div>{l.product ?? l.name}</td>
                  <td className={td}>{l.product ? l.packQty ?? "—" : ""}</td>
                  <td className={td}>{l.product ? l.unit ?? "—" : ""}</td>
                  <td className={num}>{l.qty}</td>
                  <td className={num}>{money(l.mrp)}</td>
                  <td className={num}>{money(l.rate)}</td>
                  <td className={num}>{money(l.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={td} colSpan={4}>Total</td>
                <td className={num}>{v.totals.qty}</td>
                <td className={td} colSpan={2} />
                <td className={num}>₹{money(v.totals.total)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 flex items-start justify-between gap-6">
            <div>
              <div className="font-semibold">Amount in words</div>
              <div>{v.amountInWords}</div>
            </div>
            <div className="min-w-56 border-t-2 border-neutral-900 pt-1 text-right text-base font-bold">Total ₹{money(v.totals.total)}</div>
          </div>
          <footer className="mt-10 flex items-end justify-between text-[11px] text-neutral-500">
            <div>Prices are inclusive of all taxes. This is a computer-generated invoice.<br />Thank you for your order. Gaia · nourishment for life</div>
            <div className="text-right text-neutral-900">For {v.seller.name}<div className="mt-8 border-t border-neutral-400 pt-1 text-neutral-500">Authorised signatory</div></div>
          </footer>
        </article>
      </div>
    </div>
  );
}
