import { notFound } from "next/navigation";
import { D2cInvoice } from "@/components/shop/D2cInvoice";
import { getOrderById } from "@/lib/shop/orders";
import { PrintButton } from "@/app/shop-orders/slips/print-button";

export const dynamic = "force-dynamic";

/** One D2C order's invoice on its own, to print or save as PDF. */
export default async function D2cInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrderById(Number(id));
  if (!o) notFound();
  return (
    <div className="flex-1 bg-background p-6">
      <style>{`@media print { @page { size: A4; margin: 0; } body * { visibility: hidden; } .invoice-sheet, .invoice-sheet * { visibility: visible; } .invoice-sheet { position: absolute; inset: 0; box-shadow: none; border: 0; } }`}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between print:hidden">
        <h1 className="text-[18px] font-semibold text-foreground">Invoice INV-{o.order_no}</h1>
        <PrintButton />
      </div>
      <div className="invoice-sheet mx-auto max-w-[210mm] overflow-hidden rounded-lg border border-foreground/10 shadow-sm">
        <D2cInvoice o={o} print />
      </div>
    </div>
  );
}
