import { query, one, tx } from "@/lib/db";
import { ORDER_FLOW, PO_FLOW } from "./flow";

export const ORDER_KINDS = ["primary", "secondary", "counter"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];
export const ORDER_STATUSES = ["created", "approved", "invoiced", "delivered", "cancelled"] as const;
export const PO_STATUSES = ["draft", "ordered", "received", "cancelled"] as const;

export interface LineInput { product_id: string; qty: number; rate: number; discount_pct: number }
export interface OrderInput {
  id?: string | null;
  kind: OrderKind;
  customer_id: string | null;
  customer_name: string | null;
  staff_id: string | null;
  order_date: string;
  notes: string | null;
  items: LineInput[];
}

export interface OrderRow {
  id: string; order_no: string; kind: OrderKind; order_date: string; status: string;
  customer_id: string | null; customer: string | null; customer_name: string | null; staff_id: string | null; staff: string | null;
  lines: number; subtotal: number; tax: number; total: number; notes: string | null;
}
export interface OrderLine extends LineInput { id: string; name: string; sku: string; gst_pct: number; amount: number }

const DATE = (c: string) => `to_char(${c}, 'YYYY-MM-DD')`;

export async function listOrders(
  kind: OrderKind,
  o: { q?: string; status?: string; page?: number; pageSize?: number } = {},
): Promise<{ rows: OrderRow[]; total: number; page: number; pageSize: number }> {
  const pageSize = o.pageSize ?? 25;
  const page = Math.max(1, o.page ?? 1);
  const params: unknown[] = [kind];
  const w = ["o.kind = $1"];
  if (o.status) { params.push(o.status); w.push(`o.status = $${params.length}`); }
  if (o.q?.trim()) {
    params.push(`%${o.q.trim()}%`);
    w.push(`(o.order_no ilike $${params.length} or coalesce(c.name, o.customer_name, '') ilike $${params.length})`);
  }
  const from = `from ord_order o left join ord_customer c on c.id = o.customer_id left join ord_staff s on s.id = o.staff_id where ${w.join(" and ")}`;
  const total = (await one<{ n: number }>(`select count(*)::int as n ${from}`, params))?.n ?? 0;
  const rows = await query<OrderRow>(
    `select o.id, o.order_no, o.kind, ${DATE("o.order_date")} as order_date, o.status, o.customer_id,
            coalesce(c.name, o.customer_name) as customer, o.customer_name, o.staff_id, s.name as staff, o.notes,
            (select count(*)::int from ord_order_item i where i.order_id = o.id) as lines,
            o.subtotal, o.tax, o.total
       ${from} order by o.order_date desc, o.created_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`,
    params,
  );
  return { rows, total, page, pageSize };
}

export async function getOrderLines(orderId: string): Promise<OrderLine[]> {
  return query<OrderLine>(
    `select i.id, i.product_id, p.name, p.sku, i.qty, i.rate, i.discount_pct, i.gst_pct, i.amount
       from ord_order_item i join ord_product p on p.id = i.product_id where i.order_id = $1 order by p.name`,
    [orderId],
  );
}

export interface DocLine { product_id: string; name: string; qty: number; rate: number; discount_pct: number }

/** Lines of many orders (or purchase orders) at once, keyed by the document id. */
export async function linesFor(doc: "order" | "purchase", ids: string[]): Promise<Record<string, DocLine[]>> {
  if (!ids.length) return {};
  const sql = doc === "order"
    ? `select i.order_id as doc_id, i.product_id, p.name, i.qty, i.rate, i.discount_pct from ord_order_item i join ord_product p on p.id = i.product_id where i.order_id = any($1::uuid[]) order by p.name`
    : `select i.purchase_id as doc_id, i.product_id, p.name, i.qty, i.rate, 0 as discount_pct from ord_purchase_item i join ord_product p on p.id = i.product_id where i.purchase_id = any($1::uuid[]) order by p.name`;
  const out: Record<string, DocLine[]> = {};
  for (const r of await query<DocLine & { doc_id: string }>(sql, [ids])) {
    (out[r.doc_id] ??= []).push({ product_id: r.product_id, name: r.name, qty: Number(r.qty), rate: Number(r.rate), discount_pct: Number(r.discount_pct) });
  }
  return out;
}

function validate(i: OrderInput) {
  if (!ORDER_KINDS.includes(i.kind)) throw new Error("Unknown order type");
  if (i.kind !== "counter" && !i.customer_id) throw new Error("Pick a customer");
  if (i.kind === "counter" && !i.customer_id && !i.customer_name?.trim()) throw new Error("Pick a customer or type a name");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.order_date)) throw new Error("Give the order date");
  if (!i.items.length) throw new Error("Add at least one product");
  for (const l of i.items) {
    if (!l.product_id) throw new Error("Every line needs a product");
    if (!(l.qty > 0)) throw new Error("Quantity must be more than zero");
    if (l.rate < 0) throw new Error("Rate cannot be negative");
    if (l.discount_pct < 0 || l.discount_pct > 100) throw new Error("Discount must be between 0 and 100");
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function saveOrder(i: OrderInput): Promise<string> {
  validate(i);
  return tx(async (db) => {
    const gst = new Map<string, number>(
      (await db.query(`select id, gst_pct from ord_product where id = any($1::uuid[])`, [i.items.map((l) => l.product_id)]))
        .rows.map((r: { id: string; gst_pct: number }) => [r.id, Number(r.gst_pct)]),
    );
    let subtotal = 0, tax = 0;
    const lines = i.items.map((l) => {
      const amount = r2(l.qty * l.rate * (1 - l.discount_pct / 100));
      const g = gst.get(l.product_id) ?? 0;
      subtotal += amount; tax += amount * g / 100;
      return { ...l, gst_pct: g, amount };
    });
    subtotal = r2(subtotal); tax = r2(tax);

    let id = i.id ?? null;
    if (id) {
      const cur = (await db.query(`select status from ord_order where id = $1 for update`, [id])).rows[0];
      if (!cur) throw new Error("That order no longer exists");
      if (cur.status === "delivered" || cur.status === "cancelled") throw new Error(`A ${cur.status} order cannot be edited`);
      await db.query(
        `update ord_order set customer_id=$2, customer_name=$3, staff_id=$4, order_date=$5, notes=$6, subtotal=$7, tax=$8, total=$9 where id=$1`,
        [id, i.customer_id, i.customer_name?.trim() || null, i.staff_id, i.order_date, i.notes?.trim() || null, subtotal, tax, r2(subtotal + tax)],
      );
      await db.query(`delete from ord_order_item where order_id = $1`, [id]);
    } else {
      id = (await db.query(
        `insert into ord_order (kind, customer_id, customer_name, staff_id, order_date, notes, subtotal, tax, total, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [i.kind, i.customer_id, i.customer_name?.trim() || null, i.staff_id, i.order_date, i.notes?.trim() || null,
         subtotal, tax, r2(subtotal + tax), i.kind === "counter" ? "delivered" : "created"],
      )).rows[0].id as string;
    }
    for (const l of lines) {
      await db.query(
        `insert into ord_order_item (order_id, product_id, qty, rate, discount_pct, gst_pct, amount) values ($1,$2,$3,$4,$5,$6,$7)`,
        [id, l.product_id, l.qty, l.rate, l.discount_pct, l.gst_pct, l.amount],
      );
    }
    // a counter sale is paid and handed over on the spot, so it moves stock straight away
    if (i.kind === "counter") await syncSaleStock(db, id!, true);
    return id!;
  });
}

type Db = { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

/** Stock leaves when an order is delivered; undo it by turning `out` off. */
async function syncSaleStock(db: Db, orderId: string, out: boolean) {
  await db.query(`delete from ord_stock_move where ref_type = 'order' and ref_id = $1`, [orderId]);
  if (!out) return;
  await db.query(
    `insert into ord_stock_move (product_id, qty, reason, ref_type, ref_id, moved_on)
     select i.product_id, -i.qty, 'sale', 'order', o.id, o.order_date from ord_order_item i join ord_order o on o.id = i.order_id where o.id = $1`,
    [orderId],
  );
}

const NEXT = ORDER_FLOW;

export async function setOrderStatus(id: string, status: string): Promise<void> {
  await tx(async (db) => {
    const cur = (await db.query(`select status, kind from ord_order where id = $1 for update`, [id])).rows[0] as { status: string; kind: string } | undefined;
    if (!cur) throw new Error("That order no longer exists");
    if (!NEXT[cur.status]?.includes(status)) throw new Error(`An order that is ${cur.status} cannot become ${status}`);
    await db.query(`update ord_order set status = $2 where id = $1`, [id, status]);
    await syncSaleStock(db, id, status === "delivered");
    // the bill is raised when the order is invoiced and withdrawn if it goes back or is cancelled
    if (status === "invoiced" || status === "delivered") {
      await db.query(
        `insert into ord_invoice (order_id, customer_id, invoice_date, due_date, amount)
         select o.id, o.customer_id, current_date, current_date + c.credit_days, o.total
           from ord_order o join ord_customer c on c.id = o.customer_id where o.id = $1
         on conflict (order_id) do nothing`, [id]);
    } else {
      await db.query(`delete from ord_invoice where order_id = $1`, [id]);
    }
  });
}

export async function deleteOrder(id: string): Promise<void> {
  await tx(async (db) => {
    const cur = (await db.query(`select status from ord_order where id = $1 for update`, [id])).rows[0] as { status: string } | undefined;
    if (!cur) return;
    if (cur.status === "delivered") throw new Error("A delivered order cannot be deleted - cancel is not possible either; raise a return instead");
    await db.query(`delete from ord_order where id = $1`, [id]);
  });
}

// ---- purchases -------------------------------------------------------
export interface PurchaseInput {
  id?: string | null; supplier: string; po_date: string; notes: string | null;
  items: Array<{ product_id: string; qty: number; rate: number }>;
}
export interface PurchaseRow {
  id: string; po_no: string; supplier: string; po_date: string; status: string; notes: string | null; lines: number; total: number;
}

export async function listPurchases(o: { q?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = o.pageSize ?? 25;
  const page = Math.max(1, o.page ?? 1);
  const params: unknown[] = [];
  const w: string[] = [];
  if (o.status) { params.push(o.status); w.push(`p.status = $${params.length}`); }
  if (o.q?.trim()) { params.push(`%${o.q.trim()}%`); w.push(`(p.po_no ilike $${params.length} or p.supplier ilike $${params.length})`); }
  const where = w.length ? `where ${w.join(" and ")}` : "";
  const total = (await one<{ n: number }>(`select count(*)::int as n from ord_purchase p ${where}`, params))?.n ?? 0;
  const rows = await query<PurchaseRow>(
    `select p.id, p.po_no, p.supplier, ${DATE("p.po_date")} as po_date, p.status, p.notes, p.total,
            (select count(*)::int from ord_purchase_item i where i.purchase_id = p.id) as lines
       from ord_purchase p ${where} order by p.po_date desc, p.created_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`,
    params,
  );
  return { rows, total, page, pageSize };
}

export async function getPurchaseLines(id: string) {
  return query<{ id: string; product_id: string; name: string; sku: string; qty: number; rate: number; gst_pct: number; amount: number }>(
    `select i.id, i.product_id, p.name, p.sku, i.qty, i.rate, i.gst_pct, i.amount
       from ord_purchase_item i join ord_product p on p.id = i.product_id where i.purchase_id = $1 order by p.name`, [id]);
}

export async function savePurchase(i: PurchaseInput): Promise<string> {
  if (!i.supplier.trim()) throw new Error("Give the supplier");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.po_date)) throw new Error("Give the PO date");
  if (!i.items.length) throw new Error("Add at least one product");
  for (const l of i.items) {
    if (!l.product_id) throw new Error("Every line needs a product");
    if (!(l.qty > 0)) throw new Error("Quantity must be more than zero");
    if (l.rate < 0) throw new Error("Rate cannot be negative");
  }
  return tx(async (db) => {
    const gst = new Map<string, number>(
      (await db.query(`select id, gst_pct from ord_product where id = any($1::uuid[])`, [i.items.map((l) => l.product_id)]))
        .rows.map((r: { id: string; gst_pct: number }) => [r.id, Number(r.gst_pct)]),
    );
    const lines = i.items.map((l) => ({ ...l, gst: gst.get(l.product_id) ?? 0, amount: r2(l.qty * l.rate) }));
    const total = r2(lines.reduce((s, l) => s + l.amount * (1 + l.gst / 100), 0));
    let id = i.id ?? null;
    if (id) {
      const cur = (await db.query(`select status from ord_purchase where id = $1 for update`, [id])).rows[0] as { status: string } | undefined;
      if (!cur) throw new Error("That purchase order no longer exists");
      if (cur.status === "received" || cur.status === "cancelled") throw new Error(`A ${cur.status} purchase order cannot be edited`);
      await db.query(`update ord_purchase set supplier=$2, po_date=$3, notes=$4, total=$5 where id=$1`, [id, i.supplier.trim(), i.po_date, i.notes?.trim() || null, total]);
      await db.query(`delete from ord_purchase_item where purchase_id = $1`, [id]);
    } else {
      id = (await db.query(`insert into ord_purchase (supplier, po_date, notes, total) values ($1,$2,$3,$4) returning id`,
        [i.supplier.trim(), i.po_date, i.notes?.trim() || null, total])).rows[0].id as string;
    }
    for (const l of lines) {
      await db.query(`insert into ord_purchase_item (purchase_id, product_id, qty, rate, gst_pct, amount) values ($1,$2,$3,$4,$5,$6)`,
        [id, l.product_id, l.qty, l.rate, l.gst, l.amount]);
    }
    return id!;
  });
}

const PO_NEXT = PO_FLOW;

export async function setPurchaseStatus(id: string, status: string): Promise<void> {
  await tx(async (db) => {
    const cur = (await db.query(`select status from ord_purchase where id = $1 for update`, [id])).rows[0] as { status: string } | undefined;
    if (!cur) throw new Error("That purchase order no longer exists");
    if (!PO_NEXT[cur.status]?.includes(status)) throw new Error(`A ${cur.status} purchase order cannot become ${status}`);
    await db.query(`update ord_purchase set status = $2 where id = $1`, [id, status]);
    await db.query(`delete from ord_stock_move where ref_type = 'purchase' and ref_id = $1`, [id]);
    if (status === "received") {
      await db.query(
        `insert into ord_stock_move (product_id, qty, reason, ref_type, ref_id, moved_on)
         select i.product_id, i.qty, 'purchase', 'purchase', p.id, current_date from ord_purchase_item i join ord_purchase p on p.id = i.purchase_id where p.id = $1`,
        [id]);
    }
  });
}

export async function deletePurchase(id: string): Promise<void> {
  const cur = await one<{ status: string }>(`select status from ord_purchase where id = $1`, [id]);
  if (cur?.status === "received") throw new Error("A received purchase order cannot be deleted");
  await query(`delete from ord_purchase where id = $1`, [id]);
}

// ---- inventory -------------------------------------------------------
export interface StockRow { id: string; sku: string; name: string; category: string | null; on_hand: number; reorder: boolean; stock_value: number }

export async function stockView(o: { q?: string; low?: boolean } = {}): Promise<StockRow[]> {
  const params: unknown[] = [];
  const w = ["p.is_active"];
  if (o.q?.trim()) { params.push(`%${o.q.trim()}%`); w.push(`(p.sku ilike $${params.length} or p.name ilike $${params.length})`); }
  const rows = await query<StockRow>(
    `select p.id, p.sku, p.name, (select name from ord_master m where m.id = p.category_id) as category,
            coalesce(sum(m.qty), 0) as on_hand, coalesce(sum(m.qty), 0) <= 0 as reorder,
            coalesce(sum(m.qty), 0) * p.rate as stock_value
       from ord_product p left join ord_stock_move m on m.product_id = p.id
      where ${w.join(" and ")} group by p.id order by p.name`,
    params,
  );
  return o.low ? rows.filter((r) => r.on_hand <= 0) : rows;
}

export async function recentMoves(limit = 30) {
  return query<{ id: string; moved_on: string; sku: string; name: string; qty: number; reason: string; note: string | null }>(
    `select m.id, ${DATE("m.moved_on")} as moved_on, p.sku, p.name, m.qty, m.reason, m.note
       from ord_stock_move m join ord_product p on p.id = m.product_id order by m.moved_on desc, m.created_at desc limit ${limit}`);
}

export async function adjustStock(productId: string, qty: number, reason: "opening" | "adjust" | "return", note: string | null) {
  if (!productId) throw new Error("Pick a product");
  if (!Number.isFinite(qty) || qty === 0) throw new Error("Quantity cannot be zero");
  if (reason !== "adjust" && qty < 0) throw new Error("Opening stock and returns must be positive");
  await query(`insert into ord_stock_move (product_id, qty, reason, note) values ($1,$2,$3,$4)`, [productId, qty, reason, note?.trim() || null]);
}
