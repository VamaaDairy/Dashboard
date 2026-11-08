import { notFound } from "next/navigation";
import { D2cInvoice, D2cPeriodInvoice } from "@/components/shop/D2cInvoice";
import { invoiceOrders } from "@/lib/shop/order-board";
import { getOrderById } from "@/lib/shop/orders";
import { PrintButton } from "@/app/shop-orders/slips/print-button";

export const dynamic = "force-dynamic";

/** One D2C order's invoice on its own, to print or save as PDF. */
export default async function D2cInvoicePrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }> }) {
  const [{ id }, { month }] = await Promise.all([params, searchParams]);
  const o = await getOrderById(Number(id));
  if (!o) notFound();
  // ?month=YYYY-MM: the customer's subscription orders in that month as one invoice, as the app makes it
  let period: { from: string; to: string; orders: Awaited<ReturnType<typeof invoiceOrders>> } | null = null;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const from = `${month}-01`, to = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
    period = { from, to, orders: await invoiceOrders(o.customer_id ?? null, o.phone, from, to, true) };
  }
  return (
    <div className="flex-1 bg-background p-6">
      <style>{`@media print { @page { size: A4; margin: 0; } body * { visibility: hidden; } .invoice-sheet, .invoice-sheet * { visibility: visible; } .invoice-sheet { position: absolute; inset: 0; box-shadow: none; border: 0; } }`}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between print:hidden">
        <h1 className="text-[18px] font-semibold text-foreground">{period ? `Subscription invoice · ${o.name}` : `Invoice INV-${o.order_no}`}</h1>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-foreground/75">Choose &quot;Save as PDF&quot; in the print window to download</span>
          <PrintButton label="Print / Download PDF" />
        </div>
      </div>
      <div className="invoice-sheet mx-auto max-w-[210mm] overflow-hidden rounded-lg border border-foreground/10 shadow-sm">
        {period ? <D2cPeriodInvoice orders={period.orders} from={period.from} to={period.to} customer={{ name: o.name, phone: o.phone, address: o.address, pincode: o.pincode }} print /> : <D2cInvoice o={o} print />}
      </div>
    </div>
  );
}
