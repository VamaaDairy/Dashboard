import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { D2cPeriodInvoice } from "@/components/shop/D2cInvoice";
import { one } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { invoiceOrders } from "@/lib/shop/order-board";
import { PrintButton } from "@/app/shop-orders/slips/print-button";

export const dynamic = "force-dynamic";

/**
 * A subscription customer's invoice for one month (?month=YYYY-MM): their subscription orders that month as one
 * bill, the way the Gaia app makes its date-range invoice. Print it or save it as PDF.
 */
export default async function SubscriptionInvoicePage({ params, searchParams }: { params: Promise<{ customerId: string }>; searchParams: Promise<{ month?: string }> }) {
  const [{ customerId }, { month }] = await Promise.all([params, searchParams]);
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "shop"), "view")) return <p className="p-8 text-foreground">You do not have access to D2C orders.</p>;
  const id = Number(customerId);
  if (!Number.isInteger(id) || !month || !/^\d{4}-\d{2}$/.test(month)) notFound();
  const c = await one<{ name: string; phone: string; address: string | null; pincode: string | null }>(
    `select c.name, c.phone,
            coalesce((select o.address from shop_order o where o.customer_id = c.id and o.subscription_day is not null order by o.subscription_day desc limit 1),
                     (select s.address from shop_subscription s where s.customer_id = c.id order by s.id desc limit 1)) as address,
            coalesce((select o.pincode from shop_order o where o.customer_id = c.id and o.subscription_day is not null order by o.subscription_day desc limit 1),
                     (select s.pincode from shop_subscription s where s.customer_id = c.id order by s.id desc limit 1)) as pincode
       from shop_customer c where c.id = $1`,
    [id],
  );
  if (!c) notFound();
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const orders = await invoiceOrders(id, c.phone, from, to, true);

  return (
    <div className="flex-1 bg-background p-6">
      <style>{`@media print { @page { size: A4; margin: 0; } body * { visibility: hidden; } .invoice-sheet, .invoice-sheet * { visibility: visible; } .invoice-sheet { position: absolute; inset: 0; box-shadow: none; border: 0; } }`}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 print:hidden">
        <h1 className="text-[18px] font-semibold text-foreground">Subscription invoice · {c.name}</h1>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-foreground/75">Choose &quot;Save as PDF&quot; in the print window to download</span>
          <PrintButton label="Print / Download PDF" />
        </div>
      </div>
      <div className="invoice-sheet mx-auto max-w-[210mm] overflow-hidden rounded-lg border border-foreground/10 shadow-sm">
        <D2cPeriodInvoice orders={orders} from={from} to={to} customer={{ name: c.name, phone: c.phone, address: c.address ?? "", pincode: c.pincode }} print />
      </div>
    </div>
  );
}
