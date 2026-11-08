import type { ShopOrder } from "@/lib/shop/orders";

/*
 * The invoice the Gaia D2C app gives a customer for one order (Gaia-Dairy-D2C-App lib/invoice.dart, Invoice.forOrder),
 * drawn the same way here: same seller, number, lines, totals and words. An order is only charged once it is
 * delivered and not refunded; before that the same sheet shows what will be billed.
 */

export const GAIA_COMPANY = {
  name: "Vamaa Dairy Private Limited",
  address: ["2, House of Gaia, Shoppers Paradise,", "Behind City Centre Mall, Pandri,", "Raipur, Chhattisgarh - 492004"],
  gstin: "22AAECV2750M1Z9",
  email: "customercare@vamaadairy.com",
  phone: "+91 77149 02400",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "4 Nov 2026", in India time */
export function invoiceDate(d: Date | string) {
  const x = new Date(new Date(d).getTime() + 5.5 * 3600_000);
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}
/** ₹1,234.50 - always two decimals */
export const invoiceMoney = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Rupees Four Hundred Twenty Only", the Indian way (lakh, crore). */
export function amountInWords(n: number) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const below100 = (x: number) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]} ${ones[x % 10]}`.trim());
  const below1000 = (x: number) => (x < 100 ? below100(x) : `${ones[Math.floor(x / 100)]} Hundred ${below100(x % 100)}`.trim());
  const words = (x: number): string => {
    if (x === 0) return "Zero";
    return [
      x >= 10000000 ? `${words(Math.floor(x / 10000000))} Crore` : "",
      x % 10000000 >= 100000 ? `${below100(Math.floor((x % 10000000) / 100000))} Lakh` : "",
      x % 100000 >= 1000 ? `${below100(Math.floor((x % 100000) / 1000))} Thousand` : "",
      x % 1000 > 0 ? below1000(x % 1000) : "",
    ].filter(Boolean).join(" ");
  };
  const paise = Math.round(n * 100);
  const r = Math.floor(paise / 100), p = paise % 100;
  return `Rupees ${words(r)}${p > 0 ? ` and ${below100(p)} Paise` : ""} Only`;
}

export const isBilled = (o: Pick<ShopOrder, "status" | "payment_status">) => o.status === "delivered" && o.payment_status !== "refunded";
const paymentLabel = (o: ShopOrder) => {
  const how = o.payment_method === "online" ? "Online" : o.payment_method === "autopay" ? "UPI Autopay" : "Cash";
  return o.payment_status === "paid" ? `${how} - paid` : o.payment_status === "refunded" ? `${how} - refunded` : `${how} - unpaid`;
};

/** The one-order invoice, as the app shows it. `print` drops the outer frame for the printable page. */
export function D2cInvoice({ o, print = false }: { o: ShopOrder; print?: boolean }) {
  const billed = isBilled(o);
  // the same product at a different price gets its own line, sorted by name (as in the app)
  const lines = new Map<string, { name: string; qty: number; rate: number; amount: number }>();
  for (const i of o.items) {
    const k = `${i.sku_code}|${i.unit_price}`;
    const l = lines.get(k) ?? { name: i.name, qty: 0, rate: Number(i.unit_price), amount: 0 };
    l.qty += i.qty; l.amount += Number(i.line_total);
    lines.set(k, l);
  }
  const list = [...lines.values()].sort((a, b) => a.name.localeCompare(b.name));
  const total = Number(o.total);
  const paid = billed && o.payment_status === "paid" ? total : 0;
  const address = [o.address, o.pincode && !o.address.includes(o.pincode) ? o.pincode : ""].filter(Boolean).join(" - ");
  const grey = "text-[#4B5563]";

  return (
    <div className={print ? "bg-white p-10 text-[#111827]" : "bg-white px-8 py-8 text-[#111827]"}>
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- the brand logo from /public */}
        <img src="/gaia-invoice-logo.png" alt="Gaia" className="h-14 w-auto" />
        <div className="flex-1 text-[12px] leading-relaxed">
          <div className="text-[14px] font-bold">{GAIA_COMPANY.name}</div>
          <div className={grey}>{GAIA_COMPANY.address.map((l) => <div key={l}>{l}</div>)}</div>
          <div className={grey}>GSTIN {GAIA_COMPANY.gstin}</div>
          <div className={grey}>{GAIA_COMPANY.phone} · {GAIA_COMPANY.email}</div>
        </div>
        <div className="text-[30px] font-bold leading-none">Invoice</div>
      </div>

      <div className="mt-10 flex flex-wrap items-start justify-between gap-8 text-[12px]">
        <div className="min-w-56 flex-1">
          <div className={`mb-1 text-[11px] ${grey}`}>Billed and delivered to</div>
          <div className="text-[14px] font-semibold">{o.name || "Customer"}</div>
          {address ? <div className={grey}>{address}</div> : null}
          {o.phone ? <div className={grey}>+91 {o.phone}</div> : null}
        </div>
        <dl className="grid w-72 grid-cols-[6.5rem_1fr] gap-y-1">
          <dt className={grey}>Invoice no.</dt><dd className="font-semibold">INV-{o.order_no}</dd>
          <dt className={grey}>Invoice date</dt><dd className="font-semibold">{invoiceDate(new Date())}</dd>
          <dt className={grey}>Order date</dt><dd className="font-semibold">{invoiceDate(o.subscription_day ?? o.created_at)}</dd>
          {o.delivered_at ? <><dt className={grey}>Delivered on</dt><dd className="font-semibold">{invoiceDate(o.delivered_at)}</dd></> : null}
          <dt className={grey}>Payment</dt><dd className="font-semibold">{paymentLabel(o)}</dd>
        </dl>
      </div>

      <table className="mt-9 w-full text-[13px] tabular-nums">
        <thead>
          <tr className="border-b border-[#111827] text-left text-[11px] font-normal">
            <th className={`pb-2 font-normal ${grey}`}>Item</th>
            <th className={`w-16 pb-2 text-right font-normal ${grey}`}>Qty</th>
            <th className={`w-28 pb-2 text-right font-normal ${grey}`}>Rate</th>
            <th className={`w-28 pb-2 text-right font-normal ${grey}`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {list.map((l) => (
            <tr key={`${l.name}|${l.rate}`} className="border-b border-[#E5E7EB]">
              <td className="py-2.5 pr-2">{l.name}</td>
              <td className="py-2.5 text-right">{l.qty}</td>
              <td className="py-2.5 text-right">{invoiceMoney(l.rate)}</td>
              <td className="py-2.5 text-right">{invoiceMoney(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-8 text-[12px]">
        <div className="max-w-sm flex-1">
          <div className={`mb-1 text-[11px] ${grey}`}>Amount in words</div>
          <div className="text-[13px]">{amountInWords(total)}</div>
        </div>
        <div className="w-64 tabular-nums">
          {[["Items total", Number(o.subtotal)], ["Delivery", Number(o.delivery_fee)]].map(([l, v]) => (
            <div key={l as string} className="flex justify-between py-0.5 text-[13px]"><span className={grey}>{l}</span><span>{invoiceMoney(v as number)}</span></div>
          ))}
          <div className="flex justify-between py-1 text-[15px] font-bold"><span>Total</span><span>{invoiceMoney(total)}</span></div>
          <div className="flex justify-between py-0.5 text-[13px]"><span className={grey}>Paid</span><span>{invoiceMoney(paid)}</span></div>
          <div className="flex justify-between py-0.5 text-[13px]"><span className={grey}>Balance due</span><span>{invoiceMoney(billed ? total - paid : total)}</span></div>
        </div>
      </div>

      <div className={`mt-10 border-t border-[#E5E7EB] pt-3 text-[11px] ${grey}`}>
        All prices include GST. Computer-generated invoice; no signature required. Questions? {GAIA_COMPANY.email}
      </div>
    </div>
  );
}
