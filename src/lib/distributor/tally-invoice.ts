import "server-only";
import { one, query } from "@/lib/db";
import type { Bill } from "@/lib/route-orders/calc";
import { PLANT_ORDER } from "./index";
import { party, rupeesInWords, type Invoice, type InvoiceLine } from "./invoice";

/**
 * The bill the app shows for an order from the plant: the Tally sales voucher made in Route orders > Billing (VD/26-27/…),
 * not the app's own invoice. Until that bill is made there is none. A stockist's order can be on two bills (milk and
 * the rest), so there can be more than one.
 *
 * Each comes in the app invoice's shape (prices with GST, so an older app shows it right) plus `tally`: the lines as
 * billed in Tally - quantity in Tally's unit, rate and amount without GST - and the tax.
 */

export interface TallyBillLine { name: string; qty: number; unit: string; rate: number; gst: number; amount: number }
export interface TallyBill {
  ledger: string;
  lines: TallyBillLine[];
  taxable: number; cgst: number; sgst: number; igst: number; roundoff: number; total: number;
}
export type TallyInvoice = Invoice & { tally: TallyBill };

const r2 = (n: number) => Math.round(n * 100) / 100;
const FIRM = `f.name, f.firm_code, f.gstin, f.address, f.place, f.city, f.district, f.state_state, f.pincode, f.phone, f.email`;

export async function isPlantOrder(orderUid: string): Promise<boolean> {
  return !!(await one(`select 1 from fp_booking_order b where b.uid = $1 and ${PLANT_ORDER("b")}`, [orderUid]));
}

/** The order's Tally bills, oldest first; none until Billing makes them. */
export async function tallyInvoicesFor(orderUid: string): Promise<TallyInvoice[]> {
  const o = await one<{ order_id: number; booking_time: Date; status: string; buyer: Record<string, unknown> | null; seller: Record<string, unknown> | null }>(
    `select b.order_id, b.booking_time, b.status,
            (select row_to_json(x) from (select ${FIRM} from fp_firm f where f.uid = b.from_firm_uid) x) as buyer,
            (select row_to_json(x) from (select ${FIRM} from fp_firm f where f.uid = coalesce(b.to_firm_uid,
               (select s.uid from fp_firm s join fp_channel c on c.uid = s.channel_uid where c.channel_code = 'CO' order by s.created_at limit 1))) x) as seller
     from fp_booking_order b where b.uid = $1`,
    [orderUid],
  );
  if (!o) return [];
  const bills = await query<{ voucher_no: string; voucher_date: string; data: Bill }>(
    `select x.voucher_no, to_char(x.voucher_date, 'YYYY-MM-DD') as voucher_date, x.data
       from route_order_bill_order bo join route_order_bill x on x.id = bo.bill_id
      where bo.order_uid = $1 and x.status = 'issued' order by x.id`,
    [orderUid],
  );
  const buyer = party(o.buyer, "Customer");
  return bills.map(({ voucher_no, voucher_date, data: b }) => {
    const withGst = (n: number, gst: number) => r2(n * (1 + gst / 100));
    const lines: InvoiceLine[] = b.lines.map((l) => ({
      sku: l.sku, product: l.name, packQty: null, unit: l.unit, name: l.name,
      qty: l.qty, rate: withGst(l.rate, l.gst), mrp: 0, amount: withGst(l.amount, l.gst),
    }));
    return {
      invoiceNo: voucher_no,
      // the bill's date, at noon in India
      issuedAt: new Date(`${voucher_date}T06:30:00Z`).toISOString(),
      orderId: o.order_id,
      orderDate: new Date(o.booking_time).toISOString(),
      seller: party(o.seller, "Vamaa Dairy Private Limited"),
      buyer: { ...buyer, gstin: b.buyer.gstin?.toUpperCase() ?? buyer.gstin, state: b.state ?? buyer.state },
      lines,
      totals: { qty: r2(b.lines.reduce((s, l) => s + l.qty, 0)), total: b.total },
      amountInWords: rupeesInWords(b.total),
      status: o.status,
      cancelled: false,
      tally: {
        ledger: b.ledger,
        lines: b.lines.map((l) => ({ name: l.name, qty: l.qty, unit: l.unit, rate: l.rate, gst: l.gst, amount: l.amount })),
        taxable: b.taxable, cgst: b.cgst, sgst: b.sgst, igst: b.igst, roundoff: b.roundoff, total: b.total,
      },
    };
  });
}
