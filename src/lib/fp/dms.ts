import type { PoolClient } from "pg";
import { one, query, tx } from "@/lib/db";
import { insertRow } from "./insert";

/**
 * The distribution (DMS) rules: an order is placed BY the buyer (from firm) TO the seller (to firm); accepting
 * it raises an invoice FROM the seller TO the buyer, moves stock, and opens a bill. Cancelling reverses all of it.
 *
 * transaction.voucher_type:     1 sales, 2 purchase, 3 sales return, 4 purchase return, 5 stock transfer, 6 counter sale
 * transaction.transaction_type: 1 primary (company -> distributor), 2 secondary (distributor -> retailer)
 */
type Db = Pick<PoolClient, "query">;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Adds (or removes, if negative) stock of a product at a firm. Returns the new level. */
export async function bumpStock(db: Db, firmUid: string, productUid: string, delta: number): Promise<number> {
  const cur = (await db.query(
    `select uid, stock from fp_product_inventory where firm_uid = $1 and product_uid = $2 and warehouse_uid is null order by created_at limit 1 for update`, [firmUid, productUid],
  )).rows[0] as { uid: string; stock: number } | undefined;
  if (!cur) {
    if (delta < 0) throw new Error("Not enough stock");
    await insertRow(db, "product_inventory", { firmUid, productUid, stock: delta, totalStock: delta, intransitStock: 0, unit: "pc" });
    return delta;
  }
  const next = Number(cur.stock) + delta;
  if (next < -1e-9) throw new Error("Not enough stock");
  await db.query(`update fp_product_inventory set stock = $2, total_stock = $2, updated_at = now() where uid = $1`, [cur.uid, next]);
  return next;
}

export async function stockOf(firmUid: string, productUid: string): Promise<number> {
  const r = await one<{ s: number }>(`select coalesce(sum(stock), 0) as s from fp_product_inventory where firm_uid = $1 and product_uid = $2`, [firmUid, productUid]);
  return Number(r?.s ?? 0);
}

interface Line { productUid: string; mrp: number; dp: number; qty: number; unit: string }

async function nextVoucher(db: Db, prefix: string) {
  const n = Number(((await db.query(`select nextval('fp_voucher_seq') as n`)).rows[0] as { n: string }).n);
  return `${prefix}-${String(n).padStart(6, "0")}`;
}

async function writeTransaction(db: Db, o: {
  voucher: 1 | 2 | 3 | 4 | 5 | 6; type: number; from: string | null; to: string | null; user: string | null; bookingOrder: string | null;
  lines: Line[]; status?: string; reference?: string | null; returnType?: string | null; returnReason?: string | null; number?: string;
}) {
  const prefix = { 1: "INV", 2: "PUR", 3: "SRT", 4: "PRT", 5: "ST", 6: "CSH" }[o.voucher];
  const total = r2(o.lines.reduce((s, l) => s + l.qty * l.dp, 0));
  const qty = o.lines.reduce((s, l) => s + l.qty, 0);
  const status = o.status ?? "Accepted";
  const number = o.number ?? (await nextVoucher(db, prefix));
  const uid = await insertRow(db, "transaction", {
    voucherTime: new Date().toISOString(), transactionTime: new Date(), totalItems: o.lines.length, totalQuantity: qty, acceptedQty: status === "Accepted" ? qty : 0,
    totalCost: total, netPrice: total, status, voucherNumber: number, reference: o.reference ?? null, voucherType: o.voucher, transactionType: o.type,
    fromFirmUid: o.from, toFirmUid: o.to, bookingOrderUid: o.bookingOrder, userUid: o.user, inputMode: "Portal", returnType: o.returnType ?? null, returnReason: o.returnReason ?? null,
  });
  for (const l of o.lines) {
    await insertRow(db, "transactionItem", {
      transactionUid: uid, productUid: l.productUid, mrp: l.mrp, sellingPrice: l.dp, dp: l.dp, channelPrice: l.dp, schemePrice: l.dp,
      quantity: l.qty, acceptedQty: l.qty, totalCost: r2(l.qty * l.dp), unit: l.unit,
    });
  }
  return { uid, total, qty, number };
}

// ---------------------------------------------------------------- orders
export interface OrderLineInput { productUid: string; qty: number }

export async function createBookingOrder(i: {
  kind: "primary" | "secondary"; buyer: string; seller: string; staff: string | null; lines: OrderLineInput[];
}): Promise<string> {
  if (!i.buyer || !i.seller) throw new Error("Pick who is ordering and who they order from");
  if (i.buyer === i.seller) throw new Error("A firm cannot order from itself");
  const lines = i.lines.filter((l) => l.productUid && l.qty > 0);
  if (!lines.length) throw new Error("Add at least one product with a quantity");
  return tx(async (db) => {
    const prods = (await db.query(`select uid, mrp, dp from fp_product where uid = any($1::uuid[])`, [lines.map((l) => l.productUid)])).rows as Array<{ uid: string; mrp: number; dp: number }>;
    const by = new Map(prods.map((p) => [p.uid, p]));
    const priced = lines.map((l) => ({ ...l, mrp: Number(by.get(l.productUid)?.mrp ?? 0), dp: Number(by.get(l.productUid)?.dp ?? 0) }));
    const total = r2(priced.reduce((s, l) => s + l.qty * l.dp, 0));
    const qty = priced.reduce((s, l) => s + l.qty, 0);
    const orderId = Number(((await db.query(`select nextval('fp_order_seq') as n`)).rows[0] as { n: string }).n);
    const now = new Date();
    const uid = await insertRow(db, "bookingOrder", {
      orderUid: crypto.randomUUID(), orderId, orderType: i.kind === "primary" ? "PRIMARY" : "SECONDARY", bookingTime: now, bookingDate: now, totalItem: priced.length,
      weekOfMonth: Math.ceil(now.getDate() / 7), totalQuantity: qty, totalCost: total, dealerCost: total, status: "Pending", currentStatus: "Pending",
      fromFirmUid: i.buyer, toFirmUid: i.seller, staffUid: i.staff, retail: i.kind === "secondary" ? 1 : 0, acceptedQuantity: 0, invoiceQuantity: 0, cancelledQuantity: 0,
    });
    for (const l of priced) {
      await insertRow(db, "bookingOrderItem", {
        bookingOrderUid: uid, productUid: l.productUid, mrp: l.mrp, sellingPrice: l.dp, dp: l.dp, quantity: l.qty, stock: await stockOf(i.seller, l.productUid), totalCost: r2(l.qty * l.dp), unit: "pc",
      });
    }
    return uid;
  });
}

type Order = {
  uid: string; order_type: string; status: string; from_firm_uid: string; to_firm_uid: string; staff_uid: string | null; total_quantity: number; order_id: number;
};

async function loadOrder(db: Db, uid: string): Promise<Order> {
  const o = (await db.query(`select uid, order_type, status, from_firm_uid, to_firm_uid, staff_uid, total_quantity, order_id from fp_booking_order where uid = $1 for update`, [uid])).rows[0] as Order | undefined;
  if (!o) throw new Error("That order no longer exists");
  return o;
}

/** Accept: invoice what the seller can supply (all by default, or the quantities given per item). */
export async function acceptOrder(orderUid: string, accepted?: Record<string, number>): Promise<void> {
  await tx(async (db) => {
    const o = await loadOrder(db, orderUid);
    if (o.status !== "Pending") throw new Error(`An order that is ${o.status.toLowerCase()} cannot be accepted`);
    const items = (await db.query(
      `select i.uid, i.product_uid, i.quantity, i.mrp, i.dp, i.unit from fp_booking_order_item i where i.booking_order_uid = $1`, [orderUid])).rows as Array<{ uid: string; product_uid: string; quantity: number; mrp: number; dp: number; unit: string | null }>;
    const lines: Array<Line & { item: string; ordered: number }> = [];
    for (const it of items) {
      const want = accepted?.[it.uid] ?? Number(it.quantity);
      const qty = Math.max(0, Math.min(Number(it.quantity), want));
      if (qty > 0) lines.push({ item: it.uid, ordered: Number(it.quantity), productUid: it.product_uid, mrp: Number(it.mrp), dp: Number(it.dp), qty, unit: it.unit ?? "pc" });
      await db.query(`update fp_booking_order_item set accepted_quantity = $2, invoice_quantity = $2, cancelled_quantity = $3, updated_at = now() where uid = $1`, [it.uid, qty, Number(it.quantity) - qty]);
    }
    if (!lines.length) throw new Error("Nothing to accept - every quantity is zero");
    for (const l of lines) await bumpStock(db, o.to_firm_uid, l.productUid, -l.qty); // throws "Not enough stock"
    for (const l of lines) await bumpStock(db, o.from_firm_uid, l.productUid, l.qty);

    const type = o.order_type === "PRIMARY" ? 1 : 2;
    const inv = await writeTransaction(db, { voucher: 1, type, from: o.to_firm_uid, to: o.from_firm_uid, user: o.staff_uid, bookingOrder: orderUid, lines, reference: `BO-${o.order_id}` });
    if (type === 1) await writeTransaction(db, { voucher: 2, type, from: o.to_firm_uid, to: o.from_firm_uid, user: o.staff_uid, bookingOrder: orderUid, lines, reference: inv.number });
    await insertRow(db, "bill", {
      invoiceDate: new Date(), invoiceNumber: inv.number, invoiceCost: inv.total, currentDue: inv.total, openingDue: 0, totalAmountPaid: 0, transactionUid: inv.uid, bookingOrderUid: orderUid,
      fromFirmUid: o.to_firm_uid, toFirmUid: o.from_firm_uid, status: 1, deliveryStatus: 0, billType: o.order_type,
    });
    const qty = lines.reduce((s, l) => s + l.qty, 0);
    await db.query(
      `update fp_booking_order set status = 'Accepted', current_status = 'Accepted', accepted_quantity = $2, invoice_quantity = $2, cancelled_quantity = $3, invoice_number = $4, updated_at = now() where uid = $1`,
      [orderUid, qty, Number(o.total_quantity) - qty, inv.number]);
  });
}

export async function rejectOrder(orderUid: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error("Give a reason");
  await tx(async (db) => {
    const o = await loadOrder(db, orderUid);
    if (o.status !== "Pending") throw new Error(`An order that is ${o.status.toLowerCase()} cannot be rejected`);
    await db.query(`update fp_booking_order set status = 'Rejected', current_status = 'Rejected', rejection_reason = $2, cancelled_quantity = total_quantity, updated_at = now() where uid = $1`, [orderUid, reason.trim()]);
  });
}

export async function cancelOrder(orderUid: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error("Give a reason");
  await tx(async (db) => {
    const o = await loadOrder(db, orderUid);
    if (o.status === "Cancelled" || o.status === "Rejected") throw new Error(`This order is already ${o.status.toLowerCase()}`);
    const inv = (await db.query(`select uid from fp_transaction where booking_order_uid = $1 and voucher_type = 1 and status <> 'Cancelled'`, [orderUid])).rows as Array<{ uid: string }>;
    for (const t of inv) await reverseTransaction(db, t.uid, reason);
    await db.query(`update fp_booking_order set status = 'Cancelled', current_status = 'Cancelled', rejection_reason = $2, cancelled_quantity = total_quantity, invoice_quantity = 0, accepted_quantity = 0, updated_at = now() where uid = $1`, [orderUid, reason.trim()]);
  });
}

// ---------------------------------------------------------------- invoices
/** Puts stock back and voids the bill, the invoice and the buyer's purchase entry that came from the same order. */
async function reverseTransaction(db: Db, txnUid: string, reason: string) {
  const t = (await db.query(`select uid, status, voucher_type, from_firm_uid, to_firm_uid, booking_order_uid from fp_transaction where uid = $1 for update`, [txnUid])).rows[0] as
    { uid: string; status: string; voucher_type: number; from_firm_uid: string | null; to_firm_uid: string | null; booking_order_uid: string | null } | undefined;
  if (!t) throw new Error("That invoice no longer exists");
  if (t.status === "Cancelled") throw new Error("This invoice is already cancelled");
  const items = (await db.query(`select product_uid, quantity from fp_transaction_item where transaction_uid = $1`, [txnUid])).rows as Array<{ product_uid: string; quantity: number }>;
  // every document moves stock from its "from" firm to its "to" firm (sales, returns, counter sales); undo that.
  // A purchase entry only mirrors the sale, whose stock movement is what gets undone.
  if (t.voucher_type !== 2) {
    for (const it of items) {
      const q = Number(it.quantity);
      if (t.from_firm_uid) await bumpStock(db, t.from_firm_uid, it.product_uid, q);
      if (t.to_firm_uid) await bumpStock(db, t.to_firm_uid, it.product_uid, -q);
    }
  }
  await db.query(`update fp_transaction set status = 'Cancelled', rejection_reason = $2, updated_at = now() where uid = $1`, [txnUid, reason]);
  await db.query(`update fp_bill set status = 0, current_due = 0, updated_at = now() where transaction_uid = $1`, [txnUid]);
  if (t.voucher_type === 1 && t.booking_order_uid) {
    await db.query(`update fp_transaction set status = 'Cancelled', rejection_reason = $2, updated_at = now() where booking_order_uid = $1 and voucher_type = 2 and status <> 'Cancelled'`, [t.booking_order_uid, reason]);
  }
}

export async function cancelTransaction(txnUid: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error("Give a reason");
  await tx(async (db) => {
    const paid = Number(((await db.query(`select coalesce(sum(p.amount_paid), 0) as v from fp_payment p join fp_bill b on b.uid = p.bill_uid where b.transaction_uid = $1`, [txnUid])).rows[0] as { v: number }).v);
    if (paid > 0) throw new Error("This invoice has payments recorded - cancel those first");
    const t = (await db.query(`select voucher_type, booking_order_uid from fp_transaction where uid = $1`, [txnUid])).rows[0] as { voucher_type: number; booking_order_uid: string | null } | undefined;
    await reverseTransaction(db, txnUid, reason.trim());
    if (t?.voucher_type === 1 && t.booking_order_uid) {
      await db.query(`update fp_booking_order set status = 'Pending', current_status = 'Pending', invoice_quantity = 0, accepted_quantity = 0, invoice_number = null, updated_at = now() where uid = $1`, [t.booking_order_uid]);
    }
  });
}

export async function markDelivered(billUid: string, staffUid: string | null): Promise<void> {
  await tx(async (db) => {
    const b = (await db.query(`select uid, delivery_status, transaction_uid, booking_order_uid, from_firm_uid, to_firm_uid, invoice_number, invoice_cost from fp_bill where uid = $1 for update`, [billUid])).rows[0] as
      { uid: string; delivery_status: number; transaction_uid: string; booking_order_uid: string | null; from_firm_uid: string; to_firm_uid: string; invoice_number: string; invoice_cost: number } | undefined;
    if (!b) throw new Error("That bill no longer exists");
    if (Number(b.delivery_status) === 1) throw new Error("Already delivered");
    await db.query(`update fp_bill set delivery_status = 1, delivery_date = now(), delivery_staff_uid = coalesce($2, delivery_staff_uid), updated_at = now() where uid = $1`, [billUid, staffUid]);
    await insertRow(db, "delivery", { deliveryType: "DELIVERY", deliveryTime: new Date(), totalItem: 0, totalQuantity: 0, totalCost: Number(b.invoice_cost), dealerCost: Number(b.invoice_cost), status: "Delivered", invoiceNumber: b.invoice_number, transactionUid: b.transaction_uid, fromFirmUid: b.from_firm_uid, toFirmUid: b.to_firm_uid, staffUid });
    if (b.booking_order_uid) await db.query(`update fp_booking_order set status = 'Delivered', current_status = 'Delivered', updated_at = now() where uid = $1 and status = 'Accepted'`, [b.booking_order_uid]);
  });
}

// ---------------------------------------------------------------- payments
export async function recordPayment(i: { billUid: string; amount: number; modeUid: string | null; staffUid: string | null }): Promise<void> {
  if (!(i.amount > 0)) throw new Error("Enter an amount more than zero");
  await tx(async (db) => {
    const b = (await db.query(`select uid, current_due, status, transaction_uid from fp_bill where uid = $1 for update`, [i.billUid])).rows[0] as { uid: string; current_due: number; status: number; transaction_uid: string } | undefined;
    if (!b) throw new Error("That bill no longer exists");
    if (Number(b.status) === 0) throw new Error("This invoice is cancelled");
    if (i.amount > Number(b.current_due) + 0.005) throw new Error(`Only ₹${Number(b.current_due).toLocaleString("en-IN")} is due on this bill`);
    await insertRow(db, "payment", { transactionUid: b.transaction_uid, billUid: i.billUid, paymentDate: new Date(), amountPaid: r2(i.amount), status: 1, collectedStaffUid: i.staffUid, paymentModeUid: i.modeUid, verified: 0, verificationStatus: "Pending" });
    await db.query(`update fp_bill set total_amount_paid = total_amount_paid + $2, current_due = current_due - $2, last_payment_date = now(), updated_at = now() where uid = $1`, [i.billUid, r2(i.amount)]);
  });
}

export async function verifyPayment(paymentUid: string, ok: boolean): Promise<void> {
  await query(`update fp_payment set verified = $2, verification_status = $3, updated_at = now() where uid = $1`, [paymentUid, ok ? 1 : 0, ok ? "Verified" : "Rejected"]);
}

// ---------------------------------------------------------------- counter sale / return / stock transfer
export async function createCounterSale(i: { seller: string; staff: string | null; lines: OrderLineInput[] }): Promise<string> {
  const lines = i.lines.filter((l) => l.productUid && l.qty > 0);
  if (!i.seller) throw new Error("Pick the selling firm");
  if (!lines.length) throw new Error("Add at least one product with a quantity");
  return tx(async (db) => {
    const prods = (await db.query(`select uid, mrp from fp_product where uid = any($1::uuid[])`, [lines.map((l) => l.productUid)])).rows as Array<{ uid: string; mrp: number }>;
    const by = new Map(prods.map((p) => [p.uid, Number(p.mrp)]));
    const priced: Line[] = lines.map((l) => ({ productUid: l.productUid, mrp: by.get(l.productUid) ?? 0, dp: by.get(l.productUid) ?? 0, qty: l.qty, unit: "pc" }));
    for (const l of priced) await bumpStock(db, i.seller, l.productUid, -l.qty);
    return (await writeTransaction(db, { voucher: 6, type: 2, from: i.seller, to: null, user: i.staff, bookingOrder: null, lines: priced })).uid;
  });
}

/** A customer returns goods (kind "sales") or a firm returns goods to its supplier (kind "purchase"). */
export async function createReturn(i: { kind: "sales" | "purchase"; from: string; to: string; staff: string | null; reason: string; lines: OrderLineInput[] }): Promise<string> {
  const lines = i.lines.filter((l) => l.productUid && l.qty > 0);
  if (!i.from || !i.to) throw new Error("Pick both firms");
  if (!lines.length) throw new Error("Add at least one product with a quantity");
  return tx(async (db) => {
    const prods = (await db.query(`select uid, mrp, dp from fp_product where uid = any($1::uuid[])`, [lines.map((l) => l.productUid)])).rows as Array<{ uid: string; mrp: number; dp: number }>;
    const by = new Map(prods.map((p) => [p.uid, p]));
    const priced: Line[] = lines.map((l) => ({ productUid: l.productUid, mrp: Number(by.get(l.productUid)?.mrp ?? 0), dp: Number(by.get(l.productUid)?.dp ?? 0), qty: l.qty, unit: "pc" }));
    for (const l of priced) { await bumpStock(db, i.from, l.productUid, -l.qty); await bumpStock(db, i.to, l.productUid, l.qty); }
    return (await writeTransaction(db, { voucher: i.kind === "sales" ? 3 : 4, type: i.kind === "sales" ? 2 : 1, from: i.from, to: i.to, user: i.staff, bookingOrder: null, lines: priced, returnType: "Damaged", returnReason: i.reason || null })).uid;
  });
}

export async function createStockTransfer(i: { fromFirm: string; toStaff: string; userUid: string | null; lines: OrderLineInput[] }): Promise<string> {
  const lines = i.lines.filter((l) => l.productUid && l.qty > 0);
  if (!i.fromFirm || !i.toStaff) throw new Error("Pick the firm and the employee");
  if (!lines.length) throw new Error("Add at least one product with a quantity");
  return tx(async (db) => {
    const prods = (await db.query(`select uid, mrp, dp from fp_product where uid = any($1::uuid[])`, [lines.map((l) => l.productUid)])).rows as Array<{ uid: string; mrp: number; dp: number }>;
    const by = new Map(prods.map((p) => [p.uid, p]));
    const priced = lines.map((l) => ({ ...l, mrp: Number(by.get(l.productUid)?.mrp ?? 0), dp: Number(by.get(l.productUid)?.dp ?? 0) }));
    for (const l of priced) await bumpStock(db, i.fromFirm, l.productUid, -l.qty); // leaves the firm's stock, sits on the van
    const total = r2(priced.reduce((s, l) => s + l.qty * l.dp, 0));
    const qty = priced.reduce((s, l) => s + l.qty, 0);
    const uid = await insertRow(db, "stockTransfer", {
      voucherTime: new Date().toISOString(), totalItems: priced.length, totalQuantity: qty, totalBilledQuantity: 0, totalCancelledQuantity: 0, totalCost: total, status: "Accepted",
      voucherNumber: await nextVoucher(db, "ST"), fromFirmUid: i.fromFirm, toStaffUid: i.toStaff, userUid: i.userUid,
    });
    for (const l of priced) await insertRow(db, "stockTransferItem", { stockTransferUid: uid, productUid: l.productUid, mrp: l.mrp, sellingPrice: l.dp, dp: l.dp, channelPrice: l.dp, schemePrice: l.dp, quantity: l.qty, billedQuantity: 0, totalCost: r2(l.qty * l.dp), unit: "pc" });
    return uid;
  });
}

/** Cancel a transfer that has nothing billed against it: the stock goes back to the firm. */
export async function cancelStockTransfer(uid: string): Promise<void> {
  await tx(async (db) => {
    const t = (await db.query(`select uid, status, from_firm_uid, total_billed_quantity from fp_stock_transfer where uid = $1 for update`, [uid])).rows[0] as { uid: string; status: string; from_firm_uid: string; total_billed_quantity: number } | undefined;
    if (!t) throw new Error("That transfer no longer exists");
    if (t.status === "Cancelled") throw new Error("Already cancelled");
    const items = (await db.query(`select product_uid, quantity, billed_quantity from fp_stock_transfer_item where stock_transfer_uid = $1`, [uid])).rows as Array<{ product_uid: string; quantity: number; billed_quantity: number }>;
    for (const it of items) await bumpStock(db, t.from_firm_uid, it.product_uid, Number(it.quantity) - Number(it.billed_quantity));
    await db.query(`update fp_stock_transfer set status = 'Cancelled', total_cancelled_quantity = total_quantity - total_billed_quantity, updated_at = now() where uid = $1`, [uid]);
  });
}
