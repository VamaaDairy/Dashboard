import { query } from "@/lib/db";
import {
  acceptOrder, cancelOrder, cancelStockTransfer, cancelTransaction, markDelivered, recordPayment, rejectOrder, verifyPayment,
} from "./dms";

/**
 * Buttons on a grid row, and the detail popup behind "View". An action's `ask` says what it needs from the
 * person first: nothing, a typed reason, the accepted quantities, or payment details.
 */
export type Ask = "none" | "reason" | "quantities" | "payment";
export interface RowAction {
  id: string; label: string; ask: Ask; tone?: "danger";
  /** the row's status (see Override.statusPath) must be one of these for the button to show */
  whenStatus?: string[];
  run: (rowId: string, input: { reason?: string; quantities?: Record<string, number>; amount?: number; modeUid?: string | null }) => Promise<void>;
}

const orderBill = async (orderUid: string) => (await query<{ uid: string }>(`select uid from fp_bill where booking_order_uid = $1 and status = 1 order by invoice_date desc limit 1`, [orderUid]))[0]?.uid;

const ORDER_ACTIONS: RowAction[] = [
  { id: "accept", label: "Accept", ask: "quantities", whenStatus: ["Pending"], run: (id, i) => acceptOrder(id, i.quantities) },
  { id: "reject", label: "Reject", ask: "reason", tone: "danger", whenStatus: ["Pending"], run: (id, i) => rejectOrder(id, i.reason ?? "") },
  { id: "cancel", label: "Cancel order", ask: "reason", tone: "danger", whenStatus: ["Accepted", "Delivered"], run: (id, i) => cancelOrder(id, i.reason ?? "") },
  {
    id: "pay", label: "Payment", ask: "payment", whenStatus: ["Accepted", "Delivered"],
    run: async (id, i) => {
      const bill = await orderBill(id);
      if (!bill) throw new Error("This order has no open bill");
      await recordPayment({ billUid: bill, amount: i.amount ?? 0, modeUid: i.modeUid ?? null, staffUid: null });
    },
  },
];

const INVOICE_ACTIONS: RowAction[] = [
  { id: "cancel", label: "Cancel", ask: "reason", tone: "danger", whenStatus: ["Accepted", "Pending"], run: (id, i) => cancelTransaction(id, i.reason ?? "") },
];

export const ROW_ACTIONS: Record<string, RowAction[]> = {
  fpcustbookingorders: ORDER_ACTIONS,
  portalOrder: ORDER_ACTIONS,
  fpmybookingorders: ORDER_ACTIONS.filter((a) => a.id === "cancel"),
  fpsalesview: INVOICE_ACTIONS,
  fpsecondarysalesview: INVOICE_ACTIONS,
  fppurchaseview: INVOICE_ACTIONS,
  fpsalesreturnview: INVOICE_ACTIONS,
  fppurchasereturnview: INVOICE_ACTIONS,
  counterSale: INVOICE_ACTIONS,
  collections: [
    { id: "pay", label: "Create payment", ask: "payment", whenStatus: ["1"], run: (id, i) => recordPayment({ billUid: id, amount: i.amount ?? 0, modeUid: i.modeUid ?? null, staffUid: null }) },
  ],
  delivery: [
    { id: "deliver", label: "Mark delivered", ask: "none", whenStatus: ["0"], run: (id) => markDelivered(id, null) },
  ],
  stockTransferView: [
    { id: "cancel", label: "Cancel", ask: "none", tone: "danger", whenStatus: ["Accepted", "Pending"], run: (id) => cancelStockTransfer(id) },
  ],
  paymentUpdate: [
    { id: "verify", label: "Verify", ask: "none", whenStatus: ["Pending"], run: (id) => verifyPayment(id, true) },
    { id: "reject", label: "Reject", ask: "none", tone: "danger", whenStatus: ["Pending"], run: (id) => verifyPayment(id, false) },
  ],
};

// ------------------------------------------------------------------ detail popups
export interface Detail {
  title: string;
  facts: Array<[string, string]>;
  tables: Array<{ title: string; head: string[]; rows: Array<Array<string | number | null>>; /** item ids, for editable-quantity actions */ ids?: string[] }>;
}

const money = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (v: unknown) => (v ? new Date(String(v)).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

async function orderDetail(id: string): Promise<Detail> {
  const [o] = await query<Record<string, unknown>>(
    `select b.order_id, b.order_type, b.status, b.booking_time, b.total_quantity, b.total_cost, b.rejection_reason, b.invoice_number,
            f.name as buyer, s.name as seller, st.first_name as booked_by
       from fp_booking_order b left join fp_firm f on f.uid = b.from_firm_uid left join fp_firm s on s.uid = b.to_firm_uid left join fp_staff st on st.uid = b.staff_uid where b.uid = $1`, [id]);
  if (!o) throw new Error("That order no longer exists");
  const items = await query<{ uid: string; sku: string; name: string; quantity: number; accepted: number; dp: number; total: number; stock: number }>(
    `select i.uid, p.sku_code as sku, p.sku_name as name, i.quantity, i.accepted_quantity as accepted, i.dp, i.total_cost as total,
            coalesce((select sum(pi.stock) from fp_product_inventory pi where pi.firm_uid = b.to_firm_uid and pi.product_uid = i.product_uid), 0) as stock
       from fp_booking_order_item i join fp_booking_order b on b.uid = i.booking_order_uid join fp_product p on p.uid = i.product_uid where i.booking_order_uid = $1 order by p.sku_name`, [id]);
  return {
    title: `Order ${o.order_id}`,
    facts: [["Type", String(o.order_type)], ["Status", String(o.status)], ["Date", when(o.booking_time)], ["From (buyer)", String(o.buyer ?? "—")], ["To (seller)", String(o.seller ?? "—")], ["Booked by", String(o.booked_by ?? "—")],
            ["Quantity", String(o.total_quantity)], ["Value", money(o.total_cost)], ["Invoice", String(o.invoice_number ?? "—")], ...(o.rejection_reason ? [["Reason", String(o.rejection_reason)] as [string, string]] : [])],
    tables: [{
      title: "Items", head: ["SKU", "Product", "Ordered", "Accepted", "Seller stock", "DP", "Value"],
      rows: items.map((i) => [i.sku, i.name, Number(i.quantity), Number(i.accepted), Number(i.stock), money(i.dp), money(i.total)]),
      ids: items.map((i) => i.uid),
    }],
  };
}

async function transactionDetail(id: string): Promise<Detail> {
  const [t] = await query<Record<string, unknown>>(
    `select t.voucher_number, t.voucher_type, t.status, t.voucher_time, t.total_quantity, t.total_cost, t.reference, t.rejection_reason, t.return_reason, f.name as from_name, o.name as to_name
       from fp_transaction t left join fp_firm f on f.uid = t.from_firm_uid left join fp_firm o on o.uid = t.to_firm_uid where t.uid = $1`, [id]);
  if (!t) throw new Error("That document no longer exists");
  const items = await query<{ sku: string; name: string; quantity: number; dp: number; total: number }>(
    `select p.sku_code as sku, p.sku_name as name, i.quantity, i.dp, i.total_cost as total from fp_transaction_item i join fp_product p on p.uid = i.product_uid where i.transaction_uid = $1 order by p.sku_name`, [id]);
  const kinds: Record<string, string> = { "1": "Sales invoice", "2": "Purchase entry", "3": "Sales return", "4": "Purchase return", "5": "Stock transfer", "6": "Counter sale" };
  return {
    title: String(t.voucher_number),
    facts: [["Type", kinds[String(t.voucher_type)] ?? "Document"], ["Status", String(t.status)], ["Date", when(t.voucher_time)], ["From", String(t.from_name ?? "—")], ["To", String(t.to_name ?? "Walk-in")],
            ["Quantity", String(t.total_quantity)], ["Value", money(t.total_cost)], ["Reference", String(t.reference ?? "—")], ...(t.rejection_reason ? [["Cancel reason", String(t.rejection_reason)] as [string, string]] : []), ...(t.return_reason ? [["Return reason", String(t.return_reason)] as [string, string]] : [])],
    tables: [{ title: "Items", head: ["SKU", "Product", "Qty", "DP", "Value"], rows: items.map((i) => [i.sku, i.name, Number(i.quantity), money(i.dp), money(i.total)]) }],
  };
}

async function billDetail(id: string): Promise<Detail> {
  const [b] = await query<Record<string, unknown>>(
    `select b.invoice_number, b.invoice_date, b.invoice_cost, b.total_amount_paid, b.current_due, b.status, b.delivery_status, f.name as from_name, o.name as to_name
       from fp_bill b left join fp_firm f on f.uid = b.from_firm_uid left join fp_firm o on o.uid = b.to_firm_uid where b.uid = $1`, [id]);
  if (!b) throw new Error("That bill no longer exists");
  const pays = await query<{ date: string; amount: number; mode: string | null; by: string | null; verification: string | null }>(
    `select p.payment_date as date, p.amount_paid as amount, m.mode, s.first_name as by, p.verification_status as verification
       from fp_payment p left join fp_payment_mode m on m.uid = p.payment_mode_uid left join fp_staff s on s.uid = p.collected_staff_uid where p.bill_uid = $1 order by p.payment_date`, [id]);
  return {
    title: `Bill ${b.invoice_number}`,
    facts: [["Invoice date", when(b.invoice_date)], ["From", String(b.from_name ?? "—")], ["To", String(b.to_name ?? "—")], ["Invoice cost", money(b.invoice_cost)], ["Paid", money(b.total_amount_paid)], ["Due", money(b.current_due)],
            ["Delivery", Number(b.delivery_status) === 1 ? "Delivered" : "Not delivered"], ["Bill", Number(b.status) === 1 ? "Open" : "Cancelled"]],
    tables: [{ title: "Payments", head: ["Date", "Amount", "Mode", "Collected by", "Verification"], rows: pays.map((p) => [when(p.date), money(p.amount), p.mode ?? "—", p.by ?? "—", p.verification ?? "—"]) }],
  };
}

async function transferDetail(id: string): Promise<Detail> {
  const [t] = await query<Record<string, unknown>>(
    `select t.voucher_number, t.status, t.voucher_time, t.total_quantity, t.total_billed_quantity, t.total_cost, f.name as from_name, s.first_name as to_name
       from fp_stock_transfer t left join fp_firm f on f.uid = t.from_firm_uid left join fp_staff s on s.uid = t.to_staff_uid where t.uid = $1`, [id]);
  if (!t) throw new Error("That transfer no longer exists");
  const items = await query<{ sku: string; name: string; quantity: number; billed: number; dp: number }>(
    `select p.sku_code as sku, p.sku_name as name, i.quantity, i.billed_quantity as billed, i.dp from fp_stock_transfer_item i join fp_product p on p.uid = i.product_uid where i.stock_transfer_uid = $1 order by p.sku_name`, [id]);
  return {
    title: String(t.voucher_number),
    facts: [["Status", String(t.status)], ["Date", when(t.voucher_time)], ["From firm", String(t.from_name ?? "—")], ["To employee", String(t.to_name ?? "—")], ["Quantity", String(t.total_quantity)], ["Billed", String(t.total_billed_quantity)], ["Value", money(t.total_cost)]],
    tables: [{ title: "Items", head: ["SKU", "Product", "Transferred", "Billed", "DP"], rows: items.map((i) => [i.sku, i.name, Number(i.quantity), Number(i.billed), money(i.dp)]) }],
  };
}

export const DETAILS: Record<string, (id: string) => Promise<Detail>> = {
  fpcustbookingorders: orderDetail, portalOrder: orderDetail, fpmybookingorders: orderDetail, updateOrder: orderDetail,
  fpsalesview: transactionDetail, fpsecondarysalesview: transactionDetail, fppurchaseview: transactionDetail,
  fpsalesreturnview: transactionDetail, fppurchasereturnview: transactionDetail, counterSale: transactionDetail,
  collections: billDetail, delivery: billDetail, viewCancelledInvoice: billDetail,
  stockTransferView: transferDetail,
};
