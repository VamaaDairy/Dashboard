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
  const how = o.payment_method === "online" ? "Online" : o.payment_method === "autopay" ? "Autopay" : o.payment_method === "prepaid" ? "Subscription pack (autopay)" : "Cash";
  return o.payment_status === "paid" ? `${how} - paid` : o.payment_status === "refunded" ? `${how} - refunded` : `${how} - unpaid`;
};

/** The one-order invoice, as the app shows it. `print` drops the outer frame for the printable page. */
export function D2cInvoice({ o, print = false }: { o: ShopOrder; print?: boolean }) {
  const billed = isBilled(o);
  // the same product at a different price gets its own line, sorted by name (as in the app)
  const lines = new Map<string, { name: string; qty: number; rate: number; amount: number }>();
  for (const i of o.items) {
    const k = `${i.sku_code}|${i.unit_price}|${i.free ? "free" : ""}`;
    const l = lines.get(k) ?? { name: i.free ? `${i.name} (free - offer)` : i.name, qty: 0, rate: Number(i.unit_price), amount: 0 };
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
          {[["Items total", Number(o.subtotal)], ...(Number(o.discount) ? [[`Offer discount${o.coupon_code ? ` (${o.coupon_code})` : ""}`, -Number(o.discount)]] : []), ["Delivery", Number(o.delivery_fee)]].map(([l, v]) => (
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

const STATUS_TEXT: Record<string, string> = {
  awaiting_payment: "Awaiting payment", placed: "Order placed", confirmed: "Confirmed", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled",
};
const ymd = (d: string) => d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10);
const dayOf = (o: ShopOrder) => o.subscription_day ?? o.created_at;

/**
 * A customer's orders over a period as one invoice - the app's date-range invoice (Invoice(from, to, orders)):
 * every order listed, only delivered ones charged, number GD-<last 4 of phone>-<from>-<to>.
 */
export function D2cPeriodInvoice({ orders, from, to, customer, print = false }: {
  orders: ShopOrder[];
  from: string;
  to: string;
  customer: { name: string; phone: string; address: string; pincode: string | null };
  print?: boolean;
}) {
  const billed = orders.filter(isBilled);
  const lines = new Map<string, { name: string; qty: number; rate: number; amount: number }>();
  for (const o of billed) for (const i of o.items) {
    const k = `${i.sku_code}|${i.unit_price}|${i.free ? "free" : ""}`;
    const l = lines.get(k) ?? { name: i.free ? `${i.name} (free - offer)` : i.name, qty: 0, rate: Number(i.unit_price), amount: 0 };
    l.qty += i.qty; l.amount += Number(i.line_total);
    lines.set(k, l);
  }
  const list = [...lines.values()].sort((a, b) => a.name.localeCompare(b.name));
  const sum = (xs: ShopOrder[], f: (o: ShopOrder) => number) => xs.reduce((a, o) => a + f(o), 0);
  const subtotal = sum(billed, (o) => Number(o.subtotal)), delivery = sum(billed, (o) => Number(o.delivery_fee)), total = sum(billed, (o) => Number(o.total));
  const discount = sum(billed, (o) => Number(o.discount ?? 0));
  const paid = sum(billed.filter((o) => o.payment_status === "paid"), (o) => Number(o.total));
  const digits = customer.phone.replace(/\D/g, "");
  const number = `GD-${digits.length > 4 ? digits.slice(-4) : digits}-${ymd(from)}-${ymd(to)}`;
  const address = [customer.address, customer.pincode && !customer.address.includes(customer.pincode) ? customer.pincode : ""].filter(Boolean).join(" - ");
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
          <div className={`mb-1 text-[11px] ${grey}`}>Billed to</div>
          <div className="text-[14px] font-semibold">{customer.name || "Customer"}</div>
          {address ? <div className={grey}>{address}</div> : null}
          {customer.phone ? <div className={grey}>+91 {customer.phone}</div> : null}
        </div>
        <dl className="grid w-72 grid-cols-[6.5rem_1fr] gap-y-1">
          <dt className={grey}>Invoice no.</dt><dd className="font-semibold">{number}</dd>
          <dt className={grey}>Invoice date</dt><dd className="font-semibold">{invoiceDate(new Date())}</dd>
          <dt className={grey}>Period</dt><dd className="font-semibold">{invoiceDate(from)} to {invoiceDate(to)}</dd>
          <dt className={grey}>Orders</dt><dd className="font-semibold">{billed.length} delivered of {orders.length}</dd>
        </dl>
      </div>

      {list.length ? (
        <table className="mt-9 w-full text-[13px] tabular-nums">
          <thead>
            <tr className="border-b border-[#111827] text-left text-[11px]">
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
      ) : <p className={`mt-9 text-[13px] ${grey}`}>Nothing was delivered in these dates.</p>}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-8 text-[12px]">
        <div className="max-w-sm flex-1">
          <div className={`mb-1 text-[11px] ${grey}`}>Amount in words</div>
          <div className="text-[13px]">{amountInWords(total)}</div>
        </div>
        <div className="w-64 tabular-nums">
          <div className="flex justify-between py-0.5 text-[13px]"><span className={grey}>Items total</span><span>{invoiceMoney(subtotal)}</span></div>
          {discount ? <div className="flex justify-between py-0.5 text-[13px]"><span className={grey}>Offer discount</span><span>{invoiceMoney(-discount)}</span></div> : null}
          <div className="flex justify-between py-0.5 text-[13px]"><span className={grey}>Delivery</span><span>{invoiceMoney(delivery)}</span></div>
          <div className="flex justify-between py-1 text-[15px] font-bold"><span>Total</span><span>{invoiceMoney(total)}</span></div>
          <div className="flex justify-between py-0.5 text-[13px]"><span className={grey}>Paid</span><span>{invoiceMoney(paid)}</span></div>
          <div className="flex justify-between py-0.5 text-[13px]"><span className={grey}>Balance due</span><span>{invoiceMoney(total - paid)}</span></div>
        </div>
      </div>

      <div className="mt-9 text-[14px] font-semibold">Order details</div>
      <table className="mt-2 w-full text-[12px] tabular-nums">
        <thead>
          <tr className="border-b border-[#111827] text-left text-[11px]">
            {["Date", "Order no.", "Items", "Payment", "Status"].map((h) => <th key={h} className={`pb-2 pr-3 font-normal ${grey}`}>{h}</th>)}
            <th className={`pb-2 text-right font-normal ${grey}`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-[#E5E7EB] align-top">
              <td className="py-2 pr-3 whitespace-nowrap">{invoiceDate(dayOf(o))}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{o.order_no}</td>
              <td className="py-2 pr-3">{[...o.items.map((i) => `${i.name} x ${i.qty}`), Number(o.delivery_fee) > 0 ? `Delivery ${invoiceMoney(Number(o.delivery_fee))}` : ""].filter(Boolean).map((t) => <div key={t}>{t}</div>)}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{paymentLabel(o)}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{STATUS_TEXT[o.status] ?? o.status}</td>
              <td className="py-2 text-right whitespace-nowrap">{isBilled(o) ? invoiceMoney(Number(o.total)) : "Not charged"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={`mt-10 border-t border-[#E5E7EB] pt-3 text-[11px] ${grey}`}>
        All prices include GST. Computer-generated invoice; no signature required. Questions? {GAIA_COMPANY.email}
      </div>
    </div>
  );
}
