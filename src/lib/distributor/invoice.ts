import "server-only";
import type { PoolClient } from "pg";
import { syncOrderLedger } from "@/lib/books";
import { one, tx } from "@/lib/db";
import { labelJoin, syncProductLabels } from "@/lib/products/names";

/**
 * Invoices for the orders placed from the Gaia Distributors app (db/081). The seller is the firm the order is
 * supplied by (its name, GSTIN and address from the Customer Masters), the buyer the distributor or retailer.
 * Prices include GST. An invoice is frozen when issued (at order time, or the first time an older order's
 * invoice is asked for) and numbered per financial year: GP/26-27/00001.
 */

export interface InvoiceParty {
  name: string;
  code: string | null;
  gstin: string | null;
  address: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
}

export interface InvoiceLine {
  sku: string;
  /** Name with pack size, for the apps ("Gaia Toned Milk 500 ml"); the dashboard shows product / packQty / unit apart. */
  name: string;
  /** The Product Master's one name, pack quantity and unit (product_label). */
  product: string;
  packQty: string | null;
  unit: string | null;
  qty: number;
  /** price per unit, GST included */
  rate: number;
  mrp: number;
  amount: number;
}

export interface InvoiceData {
  invoiceNo: string;
  issuedAt: string;
  orderId: number;
  orderDate: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  lines: InvoiceLine[];
  totals: { qty: number; total: number };
  amountInWords: string;
}

export interface Invoice extends InvoiceData {
  /** the order's status now (an invoice of a cancelled order says so) */
  status: string;
  cancelled: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The financial year an Indian date falls in, as on invoice numbers: 1 Nov 2026 -> "26-27". */
export function financialYear(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  const y = ist.getUTCFullYear() % 100, start = ist.getUTCMonth() >= 3 ? y : (y + 99) % 100;
  return `${String(start).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const h = Math.floor(n / 100), rest = n % 100;
  const tail = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` ${ONES[rest % 10]}` : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", tail].filter(Boolean).join(" ");
}

function words(n: number): string {
  const parts: string[] = [];
  for (const [size, label] of [[1e7, "Crore"], [1e5, "Lakh"], [1e3, "Thousand"]] as const) {
    const q = Math.floor(n / size);
    if (q) parts.push(`${q >= 1000 ? words(q) : below1000(q)} ${label}`);
    n %= size;
  }
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}

/** 12345.5 -> "Rupees Twelve Thousand Three Hundred Forty Five and Fifty Paise Only", in lakh and crore. */
export function rupeesInWords(amount: number): string {
  const whole = Math.floor(amount + 1e-9), paise = Math.round((amount - whole) * 100);
  return `Rupees ${words(whole) || "Zero"}${paise ? ` and ${below1000(paise)} Paise` : ""} Only`;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function party(f: Record<string, unknown> | null, fallbackName: string): InvoiceParty {
  const address = [f?.address, f?.place, f?.city, f?.district].map(text).filter((x, i, a): x is string => !!x && a.findIndex((y) => y?.toLowerCase() === x.toLowerCase()) === i).join(", ");
  const pin = text(f?.pincode);
  return {
    name: text(f?.name) ?? fallbackName,
    code: text(f?.firm_code),
    gstin: text(f?.gstin)?.toUpperCase() ?? null,
    address: address ? `${address}${pin ? ` - ${pin}` : ""}` : null,
    state: text(f?.state_state),
    phone: text(f?.phone),
    email: text(f?.email),
  };
}

/** Works out an order's invoice from the order book as it is now (without its number and date). */
async function draft(c: PoolClient, orderUid: string): Promise<Omit<InvoiceData, "invoiceNo" | "issuedAt"> | null> {
  const FIRM = `f.name, f.firm_code, f.gstin, f.address, f.place, f.city, f.district, f.state_state, f.pincode, f.phone, f.email`;
  const o = (await c.query(
    `select b.order_id, b.booking_time,
            (select row_to_json(x) from (select ${FIRM} from fp_firm f where f.uid = b.from_firm_uid) x) as buyer,
            (select row_to_json(x) from (select ${FIRM} from fp_firm f where f.uid = b.to_firm_uid) x) as seller
     from fp_booking_order b where b.uid = $1`,
    [orderUid],
  )).rows[0] as { order_id: number; booking_time: Date; buyer: Record<string, unknown> | null; seller: Record<string, unknown> | null } | undefined;
  if (!o) return null;
  const lines = ((await c.query(
    `select p.sku_code as sku, coalesce(pl.name, p.sku_name) as product, pl.qty as "packQty", pl.unit,
            trim(concat_ws(' ', coalesce(pl.name, p.sku_name), pl.qty, pl.unit)) as name, i.quantity::float as qty, i.selling_price::float as rate, coalesce(i.mrp, p.mrp)::float as mrp, i.total_cost::float as amount
     from fp_booking_order_item i join fp_product p on p.uid = i.product_uid left join ${labelJoin("p.sku_code")}
     where i.booking_order_uid = $1 order by i.order_item_number`,
    [orderUid],
  )).rows as InvoiceLine[]).map((l) => ({ ...l, amount: r2(l.amount || l.qty * l.rate) }));
  const total = r2(lines.reduce((s, l) => s + l.amount, 0));
  return {
    orderId: o.order_id,
    orderDate: new Date(o.booking_time).toISOString(),
    seller: party(o.seller, "Vamaa Dairy"),
    buyer: party(o.buyer, "Customer"),
    lines,
    totals: { qty: r2(lines.reduce((s, l) => s + l.qty, 0)), total },
    amountInWords: rupeesInWords(total),
  };
}

/** Issues the order's invoice inside [c]'s transaction (once: an existing one is returned as it is). */
export async function issueInvoice(c: PoolClient, orderUid: string): Promise<InvoiceData | null> {
  const had = (await c.query(`select data from dist_invoice where booking_order_uid = $1`, [orderUid])).rows[0] as { data: InvoiceData } | undefined;
  if (had) return had.data;
  const d = await draft(c, orderUid);
  if (!d) return null;
  await c.query(`select pg_advisory_xact_lock(hashtext('dist_invoice_no'))`);
  const now = new Date();
  const fy = financialYear(now);
  const [{ seq }] = (await c.query(`select coalesce(max(seq), 0) + 1 as seq from dist_invoice where fy = $1`, [fy])).rows as Array<{ seq: number }>;
  const data: InvoiceData = { ...d, invoiceNo: `GP/${fy}/${String(seq).padStart(5, "0")}`, issuedAt: now.toISOString() };
  await c.query(`insert into dist_invoice (booking_order_uid, invoice_no, fy, seq, issued_at, data) values ($1, $2, $3, $4, $5, $6)`, [orderUid, data.invoiceNo, fy, seq, now, data]);
  return data;
}

/**
 * Re-draws an issued invoice after the order's lines were edited before confirmation, inside [c]'s transaction.
 * The invoice keeps its number and issue date; only its lines and totals follow the order.
 */
export async function redraftInvoice(c: PoolClient, orderUid: string): Promise<void> {
  const had = (await c.query(`select data from dist_invoice where booking_order_uid = $1 for update`, [orderUid])).rows[0] as { data: InvoiceData } | undefined;
  if (!had) {
    await issueInvoice(c, orderUid);
    return;
  }
  const d = await draft(c, orderUid);
  if (!d) return;
  const data: InvoiceData = { ...d, invoiceNo: had.data.invoiceNo, issuedAt: had.data.issuedAt };
  await c.query(`update dist_invoice set data = $2 where booking_order_uid = $1`, [orderUid, data]);
  await syncOrderLedger(c, orderUid);
}

/** The order's invoice with its status now, issuing it first if the order has none yet. */
export async function invoiceFor(orderUid: string): Promise<Invoice | null> {
  // an invoice once issued keeps its lines as they were; a new one takes the product names as they are now
  await syncProductLabels();
  const data = (await one<{ data: InvoiceData }>(`select data from dist_invoice where booking_order_uid = $1`, [orderUid]))?.data ?? (await tx((c) => issueInvoice(c, orderUid)));
  if (!data) return null;
  const status = (await one<{ status: string }>(`select status from fp_booking_order where uid = $1`, [orderUid]))?.status ?? "";
  return { ...data, status, cancelled: /cancel|reject/i.test(status) };
}
