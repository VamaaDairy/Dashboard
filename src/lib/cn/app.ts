import "server-only";
import type { PoolClient } from "pg";
import { one, query, tx } from "@/lib/db";
import { today } from "@/lib/dates";
import { notify } from "@/lib/push";
import { CATEGORIES } from "./sop";

/**
 * Complaints raised from the apps: a D2C customer about their Gaia app order, a distributor or retailer about its own
 * order (Gaia Distributors), or a sales officer for one of their parties' orders (Gaia Salesforce). Each lands in
 * CN Management as a normal complaint (stage "registered") with the order, the lines and any photos attached, and
 * moves through the same SOP. The apps read it back as a simple status: received, being checked, decided, refunded
 * or credited, resolved - or not accepted, with the reason.
 */

export type AppSource = "d2c" | "distributor" | "salesforce";
export const APP_CATEGORIES = CATEGORIES;

export interface PhotoIn { mime: string; data: Buffer }
export interface LineIn { sku: string; qty: number }
export interface ComplaintIn { category: string; description: string; lines: LineIn[]; photos: PhotoIn[] }
interface Line { sku: string; name: string; qty: number; unitPrice: number; value: number }

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 2_000_000;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Photos sent as base64 (optionally a data: URL). Returns an error message for anything unusable. */
export function readPhotos(raw: unknown): PhotoIn[] | string {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return "Photos are not readable.";
  if (raw.length > MAX_PHOTOS) return `Send at most ${MAX_PHOTOS} photos.`;
  const out: PhotoIn[] = [];
  for (const p of raw) {
    const s = typeof p === "string" ? p : typeof (p as { data?: unknown })?.data === "string" ? (p as { data: string }).data : "";
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([\s\S]*)$/.exec(s);
    const b64 = m ? m[2] : s;
    if (!b64 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) return "A photo is not readable.";
    const data = Buffer.from(b64, "base64");
    if (data.length < 100) return "A photo is empty.";
    if (data.length > MAX_PHOTO_BYTES) return "A photo is too large. Please send a smaller one.";
    const mime = m?.[1] ?? (data[0] === 0x89 ? "image/png" : data.subarray(8, 12).toString() === "WEBP" ? "image/webp" : "image/jpeg");
    if (!PHOTO_TYPES.has(mime)) return "Photos must be JPEG, PNG or WebP.";
    out.push({ mime, data });
  }
  return out;
}

/** Checks the body the apps send: { category, description, lines: [{ sku, qty }], photos: [base64] }. */
export function readComplaint(body: unknown): ComplaintIn | string {
  const b = (body ?? {}) as { category?: unknown; description?: unknown; lines?: unknown; photos?: unknown };
  const category = String(b.category ?? "").trim();
  if (!APP_CATEGORIES.includes(category)) return "Pick what went wrong.";
  const description = String(b.description ?? "").trim().replace(/\s+\n/g, "\n");
  if (description.length < 5) return "Tell us a little about the problem.";
  if (description.length > 2000) return "Please keep the description shorter.";
  if (!Array.isArray(b.lines) || !b.lines.length) return "Pick the items the complaint is about.";
  const lines = b.lines.map((l) => ({ sku: String((l as { sku?: unknown })?.sku ?? "").trim(), qty: Number((l as { qty?: unknown })?.qty) }));
  if (lines.some((l) => !l.sku || !Number.isFinite(l.qty) || l.qty <= 0 || l.qty > 100_000)) return "Check the quantities.";
  const photos = readPhotos(b.photos);
  if (typeof photos === "string") return photos;
  return { category, description, lines, photos };
}

/** Matches the requested lines to the order's own lines; the claim is valued at the price on the order. */
function matchLines(order: Array<{ sku: string; name: string; qty: number; unitPrice: number }>, want: LineIn[]): Line[] | string {
  const out: Line[] = [];
  for (const w of want) {
    const o = order.find((x) => x.sku === w.sku);
    if (!o) return "That item is not on this order.";
    if (w.qty > o.qty) return `You can report at most ${o.qty} of ${o.name}.`;
    out.push({ sku: o.sku, name: o.name, qty: w.qty, unitPrice: o.unitPrice, value: Math.round(o.unitPrice * w.qty * 100) / 100 });
  }
  return out;
}

const productText = (lines: Line[]) => (lines.length === 1 ? lines[0].name : lines.map((l) => `${l.name} × ${l.qty}`).join(", "));

interface Header {
  source: AppSource; customer: string; customerType: string; region: string | null; contact: string | null;
  invoiceNo: string; invoiceDate: string | null; registeredBy: string;
  shopOrderId?: number; shopCustomerId?: number; bookingOrderUid?: string; firmUid?: string; loginId?: number | null; staffUid?: string | null;
}

async function insert(c: PoolClient, h: Header, i: ComplaintIn, lines: Line[]): Promise<{ id: string; no: string }> {
  // the same lines of the same order cannot be reported twice while a complaint about them is open or was accepted
  const open = await c.query<{ complaint_no: string; items: Line[] | null }>(
    `select complaint_no, items from cn_complaint
      where stage <> 'rejected' and ((shop_order_id is not null and shop_order_id = $1) or (booking_order_uid is not null and booking_order_uid = $2))`,
    [h.shopOrderId ?? null, h.bookingOrderUid ?? null],
  );
  for (const r of open.rows) {
    const clash = (r.items ?? []).find((x) => lines.some((l) => l.sku === x.sku));
    if (clash) throw new Error(`${clash.name} on this order is already in complaint ${r.complaint_no}.`);
  }
  const claim = lines.reduce((s, l) => s + l.value, 0);
  const qty = lines.reduce((s, l) => s + l.qty, 0);
  const r = await c.query<{ id: string; complaint_no: string }>(
    `insert into cn_complaint (complaint_date, customer_name, customer_type, region, contact_no, invoice_no, invoice_date, product_name,
       qty_affected, qty_unit, category, description, evidence_url, claim_value, registered_by, stage_on,
       source, shop_order_id, shop_customer_id, booking_order_uid, firm_uid, raised_by_login, raised_by_staff, items, sku_no)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Pcs',$10,$11,null,$12,$13,$1,$14,$15,$16,$17,$18,$19,$20,$21,$22) returning id, complaint_no`,
    [today(), h.customer, h.customerType, h.region, h.contact, h.invoiceNo, h.invoiceDate, productText(lines), qty, i.category, i.description,
      Math.max(0.01, Math.round(claim * 100) / 100), h.registeredBy, h.source, h.shopOrderId ?? null, h.shopCustomerId ?? null,
      h.bookingOrderUid ?? null, h.firmUid ?? null, h.loginId ?? null, h.staffUid ?? null, JSON.stringify(lines),
      // one line: the Product Master product it is about (several lines: the complaint lists them)
      lines.length === 1 && /^\d+$/.test(String(lines[0].sku).replace(/\D/g, "")) ? Number(String(lines[0].sku).replace(/\D/g, "")) : null],
  );
  const { id, complaint_no: no } = r.rows[0];
  for (const p of i.photos) await c.query(`insert into cn_photo (complaint_id, mime, data) values ($1, $2, $3)`, [id, p.mime, p.data]);
  await c.query(`insert into cn_event (complaint_id, by_name, action, remark) values ($1, $2, $3, $4)`,
    [id, h.registeredBy, `Complaint registered as ${no} from the ${h.source === "d2c" ? "Gaia app" : h.source === "distributor" ? "Gaia Distributors app" : "Gaia Salesforce app"}`,
      i.photos.length ? `${i.photos.length} photo${i.photos.length === 1 ? "" : "s"} attached` : null]);
  return { id, no };
}

export type RaiseResult = { ok: true; complaintNo: string } | { ok: false; error: string };
const wrap = async (fn: () => Promise<{ id: string; no: string }>): Promise<RaiseResult> => {
  try {
    const r = await fn();
    return { ok: true, complaintNo: r.no };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not register the complaint." };
  }
};

/** A Gaia app customer reports a problem with one of their orders (by order number). */
export function raiseD2c(customer: { id: number; name: string; phone: string }, orderNo: string, i: ComplaintIn): Promise<RaiseResult> {
  return wrap(async () => {
    const o = await one<{ id: number; order_no: string; created_at: Date; status: string; pincode: string | null }>(
      `select id, order_no, created_at, status, pincode from shop_order where order_no = $1 and customer_id = $2`,
      [orderNo, customer.id],
    );
    if (!o) throw new Error("Order not found.");
    if (["cancelled", "awaiting_payment"].includes(o.status)) throw new Error("This order was not delivered, so there is nothing to complain about. Contact us if money was taken.");
    const items = await query<{ sku: string; name: string; qty: number; unitPrice: number }>(
      `select sku_code as sku, name, qty, case when free then 0 else coalesce(line_total / nullif(qty, 0), unit_price) end::float as "unitPrice"
         from shop_order_item where order_id = $1`,
      [o.id],
    );
    const lines = matchLines(items, i.lines);
    if (typeof lines === "string") throw new Error(lines);
    return tx((c) => insert(c, {
      source: "d2c", customer: customer.name || "Gaia app customer", customerType: "D2C customer", region: o.pincode, contact: customer.phone,
      invoiceNo: o.order_no, invoiceDate: new Date(o.created_at).toISOString().slice(0, 10), registeredBy: `${customer.name || customer.phone} (Gaia app)`,
      shopOrderId: o.id, shopCustomerId: customer.id,
    }, i, lines));
  });
}

const CHANNEL_TYPE: Record<string, string> = { DB: "Distributor", SS: "Distributor", RT: "Retailer", MFS: "Modern Trade / MFS", IT: "Café / HoReCa", PT: "Retailer" };

/**
 * A distributor or retailer (Gaia Distributors) about its own order, or a sales officer (Gaia Salesforce) about an
 * order of one of their parties. `orderUid` must already be checked as visible to this login (distOrderUid).
 */
export function raiseTrade(
  login: { id: number; kind: string; name: string; staffUid: string | null },
  source: "distributor" | "salesforce", orderUid: string, i: ComplaintIn,
): Promise<RaiseResult> {
  return wrap(async () => {
    const o = await one<{ order_id: number | null; booking_time: Date; status: string; firm_uid: string; firm: string; phone: string | null; city: string | null; channel: string | null; invoice: string | null }>(
      `select b.order_id, b.booking_time, coalesce(b.current_status, b.status) as status, f.uid as firm_uid, f.name as firm, f.phone, f.city,
              upper(ch.channel_code) as channel, (select v.invoice_no from dist_invoice v where v.booking_order_uid = b.uid) as invoice
         from fp_booking_order b join fp_firm f on f.uid = b.from_firm_uid left join fp_channel ch on ch.uid = f.channel_uid
        where b.uid = $1`,
      [orderUid],
    );
    if (!o) throw new Error("Order not found.");
    if (/cancel|reject/i.test(o.status)) throw new Error("This order was cancelled, so there is nothing to complain about.");
    const items = await query<{ sku: string; name: string; qty: number; unitPrice: number }>(
      `select p.sku_code as sku, p.sku_name as name, coalesce(i.quantity, 0)::float as qty,
              coalesce(i.total_cost / nullif(i.quantity, 0), i.selling_price, 0)::float as "unitPrice"
         from fp_booking_order_item i join fp_product p on p.uid = i.product_uid where i.booking_order_uid = $1`,
      [orderUid],
    );
    const lines = matchLines(items, i.lines);
    if (typeof lines === "string") throw new Error(lines);
    const by = source === "salesforce" ? `${login.name} (sales officer, Gaia Salesforce)` : `${login.name} (Gaia Distributors app)`;
    return tx((c) => insert(c, {
      source, customer: o.firm, customerType: CHANNEL_TYPE[o.channel ?? ""] ?? "Other", region: o.city, contact: o.phone,
      invoiceNo: o.invoice ?? `Order ${o.order_id ?? orderUid.slice(0, 8)}`, invoiceDate: new Date(o.booking_time).toISOString().slice(0, 10),
      registeredBy: by, bookingOrderUid: orderUid, firmUid: o.firm_uid, loginId: login.id || null, staffUid: source === "salesforce" ? login.staffUid : null,
    }, i, lines));
  });
}

// ---------------------------------------------------------------- reading them back in the apps

interface Row {
  id: string; complaint_no: string; stage: string; source: AppSource | "dashboard"; created_at: Date; category: string; description: string;
  product_name: string; claim_value: number; items: Line[] | null; invoice_no: string; customer_name: string;
  approved_value: number | null; cn_number: string | null; cn_value: number | null; cn_date: string | null;
  refund_value: number | null; refund_mode: string | null; refund_ref: string | null; refund_on: string | null;
  mis_remark: string | null; approval_remark: string | null; closure_remark: string | null; outcome: string | null;
  photos: number; order_ref: string | null;
}

const ROW = `c.id, c.complaint_no, c.stage, c.source, c.created_at, c.category, c.description, c.product_name, c.claim_value::float8 as claim_value,
  c.items, c.invoice_no, c.customer_name, c.approved_value::float8 as approved_value, c.cn_number, c.cn_value::float8 as cn_value,
  to_char(c.cn_date, 'YYYY-MM-DD') as cn_date, c.refund_value::float8 as refund_value, c.refund_mode, c.refund_ref,
  to_char(c.refund_on, 'YYYY-MM-DD') as refund_on, c.mis_remark, c.approval_remark, c.closure_remark, c.outcome,
  (select count(*)::int from cn_photo p where p.complaint_id = c.id) as photos,
  coalesce((select o.order_no from shop_order o where o.id = c.shop_order_id), (select b.order_id::text from fp_booking_order b where b.uid = c.booking_order_uid)) as order_ref`;

const rupee = (n: number | null | undefined) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * What the apps show: 5 steps (received, being checked, decision, money, resolved), where it stands, a one-line status
 * and, when there is one, the refund or credit note. Refunds are D2C; credit notes are for trade parties.
 */
export function appView(r: Row) {
  const refund = r.source === "d2c";
  const money = refund ? "Refund" : "Credit note";
  const steps = ["Received", "Being checked", "Decision", refund ? "Refunded" : "Credit note issued", "Resolved"];
  const at = { registered: 0, logged: 1, assigned: 1, rca_done: 1, recommended: 2, approved: 2, posted: 3, closed: 4, rejected: 2 }[r.stage] ?? 0;
  let status: string;
  let detail: string | null = null;
  switch (r.stage) {
    case "registered": status = "Received"; detail = "We have your complaint and will check it within a day."; break;
    case "logged": case "assigned": case "rca_done": status = "Being checked"; detail = "Our team is looking into what went wrong."; break;
    case "recommended": status = "Waiting for approval"; detail = `${money} of ${rupee(r.approved_value ?? r.claim_value)} suggested.`; break;
    case "approved": status = `${money} approved`; detail = `${rupee(r.approved_value)} approved${refund ? " - your refund is on its way." : " - the credit note is being issued."}`; break;
    case "posted":
      status = refund ? "Refunded" : "Credit note issued";
      detail = refund
        ? `${rupee(r.refund_value)} refunded${r.refund_mode ? ` by ${r.refund_mode}` : ""}${r.refund_on ? ` on ${r.refund_on}` : ""}${r.refund_ref ? ` (ref ${r.refund_ref})` : ""}.`
        : `Credit note ${r.cn_number ?? ""} for ${rupee(r.cn_value)}${r.cn_date ? ` dated ${r.cn_date}` : ""}.`;
      break;
    case "closed":
      status = "Resolved";
      detail = r.outcome === "refunded" ? `Refunded ${rupee(r.refund_value)}${r.refund_ref ? ` (ref ${r.refund_ref})` : ""}.`
        : r.outcome === "cn_issued" ? `Credit note ${r.cn_number ?? ""} for ${rupee(r.cn_value)}.` : r.closure_remark;
      break;
    case "rejected": status = "Not accepted"; detail = r.approval_remark || r.mis_remark || r.closure_remark || "Contact us if you have questions."; break;
    default: status = r.stage;
  }
  return {
    complaintNo: r.complaint_no,
    orderRef: r.order_ref ?? r.invoice_no,
    customer: r.customer_name,
    createdAt: new Date(r.created_at).toISOString(),
    category: r.category,
    description: r.description,
    items: (r.items ?? []).map((l) => ({ sku: l.sku, name: l.name, qty: l.qty, value: l.value })),
    claimValue: r.claim_value,
    photos: r.photos,
    status,
    detail,
    closed: r.stage === "closed" || r.stage === "rejected",
    rejected: r.stage === "rejected",
    steps,
    step: at,
    refund: refund && r.refund_value !== null ? { value: r.refund_value, mode: r.refund_mode, ref: r.refund_ref, date: r.refund_on } : null,
    creditNote: !refund && r.cn_number ? { number: r.cn_number, value: r.cn_value, date: r.cn_date } : null,
  };
}
export type AppComplaint = ReturnType<typeof appView>;

export const d2cComplaints = async (customerId: number) =>
  (await query<Row>(`select ${ROW} from cn_complaint c where c.shop_customer_id = $1 order by c.created_at desc limit 100`, [customerId])).map(appView);

/** A distributor or retailer sees every complaint about its own orders; a sales officer the ones they raised. */
export async function tradeComplaints(login: { id: number; kind: string; firmUid: string | null; staffUid: string | null }) {
  const rows = login.kind === "salesman"
    ? await query<Row>(`select ${ROW} from cn_complaint c where c.raised_by_staff = $1 or (c.raised_by_login = $2 and $2 > 0) order by c.created_at desc limit 100`, [login.staffUid, login.id])
    : await query<Row>(`select ${ROW} from cn_complaint c where c.firm_uid = $1 order by c.created_at desc limit 100`, [login.firmUid]);
  return rows.map(appView);
}

// ---------------------------------------------------------------- telling the app when it moves

/** Sends the complaint's new status to whoever raised it from an app. Never throws. */
export async function notifyComplaint(id: string): Promise<void> {
  try {
    const r = await one<Row & { shop_customer_id: number | null; raised_by_login: number | null }>(
      `select ${ROW}, c.shop_customer_id, c.raised_by_login from cn_complaint c where c.id = $1 and c.source <> 'dashboard'`,
      [id],
    );
    if (!r) return;
    const v = appView(r);
    const m = { title: `Complaint ${v.complaintNo}: ${v.status}`, body: v.detail ?? `Order ${v.orderRef}`, data: { type: "complaint", complaintNo: v.complaintNo } };
    if (r.shop_customer_id) await notify("customer", r.shop_customer_id, m);
    else if (r.raised_by_login) await notify("distributor", r.raised_by_login, m);
  } catch {
    // a missed notice must never undo the office's action
  }
}
