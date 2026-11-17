import "server-only";
import { one, query, tx } from "@/lib/db";
import { allocateBatches, balanced, buildDrafts, type Bill, type BillInputLine, type BillParty, type BillProduct, type DraftBill } from "./calc";
import { stockBatches } from "./stock";

export const CHANNELS = ["GT", "MFS", "Institutional", "ATP", "Bulk", "Online", "Other"] as const;

export const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
export const validDate = (d: string | undefined) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : todayIst());

/** "26-27" for a date in that financial year. */
export const fyOf = (ymd: string) => {
  const y = Number(ymd.slice(2, 4)), m = Number(ymd.slice(5, 7));
  const start = m >= 4 ? y : (y + 99) % 100;
  return `${String(start).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`;
};

export interface RouteRow { id: number; name: string; sort: number }
export const listRoutes = () => query<RouteRow>(`select id, name, sort from route_order_route where active order by sort`);

// ---------------------------------------------------------------- the day's order lines

export interface DayLine extends BillInputLine {
  orderId: number;
  status: string;
  firmUid: string;
  retail: boolean;
  /** supplied by the company, so we bill it (a retailer's order on a distributor is the distributor's to bill) */
  ours: boolean;
  amount: number;
  voucherNo: string | null;
  party: (BillParty & { route_id: number | null }) | null;
  product: (BillProduct & { category: string; weight_kg: number }) | null;
}

const KEY = (sql: string) => `regexp_replace(lower(${sql}), '[^a-z0-9]', '', 'g')`;

const PARTY_OF_FIRM = `left join lateral (
    select x.* from route_order_party x
    where x.active and (x.firm_uid = f.uid or x.name_key = ${KEY("f.name")})
    order by (x.firm_uid is not distinct from f.uid) desc limit 1
  ) pt on true`;

const PRODUCT_OF_SKU = `left join route_order_product rp on rp.active and rp.sku_no::text = regexp_replace(p.sku_code, '\\D', '', 'g')`;

/** Every order line for delivery on [date], cancelled ones aside: all trade orders, whoever placed them. */
export async function dayLines(date: string): Promise<DayLine[]> {
  return query<DayLine>(
    `select b.uid as "orderUid", b.order_id as "orderId", b.status, f.uid as "firmUid", f.name as "firmName",
            (b.app_kind = 'retailer' or coalesce(ch.channel_code, '') = 'RT') as retail,
            (sup.uid is null or coalesce(sc.channel_code, '') = 'CO') as ours,
            p.sku_code as sku, p.sku_name as "skuName", i.quantity::float as qty, i.selling_price::float as rate, i.total_cost::float as amount,
            r.name as "routeName", bill.voucher_no as "voucherNo",
            case when pt.id is null then null else row_to_json(pt) end as party,
            case when rp.id is null then null else row_to_json(rp) end as product
     from fp_booking_order b
     join fp_firm f on f.uid = b.from_firm_uid
     left join fp_channel ch on ch.uid = f.channel_uid
     left join fp_firm sup on sup.uid = b.to_firm_uid
     left join fp_channel sc on sc.uid = sup.channel_uid
     join fp_booking_order_item i on i.booking_order_uid = b.uid
     join fp_product p on p.uid = i.product_uid
     ${PARTY_OF_FIRM}
     left join route_order_route r on r.id = pt.route_id
     ${PRODUCT_OF_SKU}
     left join lateral (
       select string_agg(x.voucher_no, ', ' order by x.id) as voucher_no
       from route_order_bill_order bo join route_order_bill x on x.id = bo.bill_id where bo.order_uid = b.uid
     ) bill on true
     where (b.app_kind is not null or b.order_type = 'PRIMARY')
       -- the day the goods go out: the delivery date the order was placed for (db/098), else the day after it was booked
       and coalesce(b.delivery_date, (b.booking_time at time zone 'Asia/Kolkata')::date + 1) = $1::date
       and lower(b.status) not in ('cancelled', 'rejected')
     order by i.order_item_number`,
    [date],
  );
}

export type BuyerFilter = "all" | "distributors" | "retailers" | (typeof CHANNELS)[number];

export function filterLines(lines: DayLine[], f: { buyer?: string; route?: string; confirmed?: boolean }) {
  return lines.filter((l) => {
    if (f.confirmed && l.status.toLowerCase() !== "confirmed") return false;
    if (f.buyer === "distributors" && l.retail) return false;
    if (f.buyer === "retailers" && !l.retail) return false;
    if (f.buyer && !["all", "distributors", "retailers"].includes(f.buyer) && (l.party?.channel ?? "") !== f.buyer) return false;
    if (f.route === "none" && l.party?.route_id) return false;
    if (f.route && f.route !== "all" && f.route !== "none" && String(l.party?.route_id ?? "") !== f.route) return false;
    return true;
  });
}

// ---------------------------------------------------------------- bills

export interface BillingDay {
  ready: DraftBill[];
  blocked: DraftBill[];
  pendingOrders: number;
  otherSupplierOrders: number;
}

/** What the day's orders come to: bills ready to make, bills held up by the masters, and the orders left out. */
export async function billingDay(date: string): Promise<BillingDay> {
  const lines = await dayLines(date);
  const uniq = (ls: DayLine[]) => new Set(ls.map((l) => l.orderUid)).size;
  const open = lines.filter((l) => !l.voucherNo);
  const drafts = buildDrafts(open.filter((l) => l.ours && l.status.toLowerCase() === "confirmed"));
  return {
    ready: drafts.filter((d) => !d.issues.length),
    blocked: drafts.filter((d) => d.issues.length),
    pendingOrders: uniq(open.filter((l) => l.ours && l.status.toLowerCase() === "pending")),
    otherSupplierOrders: uniq(lines.filter((l) => !l.ours)),
  };
}

export interface IssuedBill {
  id: number;
  voucher_no: string;
  voucher_date: string;
  party_name: string;
  ledger: string;
  route_name: string | null;
  channel: string | null;
  taxable: number;
  tax: number;
  roundoff: number;
  total: number;
  status: string;
  exported_at: Date | null;
  created_by: string;
  created_at: Date;
  data: Bill;
}

export const billsOf = (date: string) =>
  query<IssuedBill>(
    `select id, voucher_no, to_char(voucher_date, 'YYYY-MM-DD') as voucher_date, party_name, ledger, route_name, channel, taxable, tax, roundoff, total, status, exported_at, created_by, created_at, data
     from route_order_bill where order_date = $1 order by id`,
    [date],
  );

export async function nextVoucherNo(voucherDate: string): Promise<number> {
  const r = await one<{ next_no: number }>(`select next_no from route_order_series where fy = $1`, [fyOf(voucherDate)]);
  return r?.next_no ?? 1;
}

/** Takes off the stock this day's live bills already have: the stock app doesn't know about them. */
async function batchPool(date: string) {
  const pool = await stockBatches();
  if (!pool) return null;
  const used = await query<{ data: Bill }>(`select data from route_order_bill where order_date = $1 and status = 'issued'`, [date]);
  for (const { data } of used) {
    for (const l of data.lines) {
      const b = l.stockId ? pool.get(l.stockId)?.find((x) => x.no === l.batch) : null;
      if (b) b.pieces -= l.pieces;
    }
  }
  return pool;
}

export type IssueResult = { ok: true; count: number; first: string; last: string } | { ok: false; error: string };

/** Makes the ready bills for [date], numbered from [startNo], each with its batches, and marks their orders invoiced. */
export async function issueBills(date: string, voucherDate: string, startNo: number, who: string): Promise<IssueResult> {
  const pool = await batchPool(date);
  const fy = fyOf(voucherDate);
  return tx(async (c): Promise<IssueResult> => {
    await c.query(`select pg_advisory_xact_lock(hashtext('route_order_bill'))`);
    const { ready } = await billingDay(date);
    if (!ready.length) return { ok: false, error: "No bills are ready for this date." };
    let no = startNo;
    let first = "", last = "";
    for (const draft of ready) {
      const b = allocateBatches(draft, pool, voucherDate);
      if (!balanced(b)) return { ok: false, error: `${b.partyName}: the bill doesn't balance, nothing was made.` };
      const voucherNo = `VD/${fy}/${no}`;
      const bill: Bill = { ...b, voucherNo, voucherDate };
      const clash = await c.query(`select 1 from route_order_bill where voucher_no = $1`, [voucherNo]);
      if (clash.rowCount) return { ok: false, error: `Bill number ${voucherNo} is already used. Nothing was made.` };
      const { rows } = await c.query<{ id: number }>(
        `insert into route_order_bill (voucher_no, voucher_date, order_date, party_id, ledger, party_name, route_name, channel, taxable, tax, roundoff, total, data, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning id`,
        [voucherNo, voucherDate, date, b.partyId, b.ledger, b.part ? `${b.partyName} (${b.part === "MILK" ? "Milk" : "Other"})` : b.partyName, b.routeName, b.channel, b.taxable, b.cgst + b.sgst + b.igst, b.roundoff, b.total, JSON.stringify(bill), who],
      );
      for (const uid of b.orderUids) {
        await c.query(`insert into route_order_bill_order (order_uid, bill_id) values ($1, $2)`, [uid, rows[0].id]);
        await c.query(
          `update fp_booking_order set invoice_quantity = total_quantity, updated_at = now(),
             invoice_number = (select string_agg(x.voucher_no, ', ' order by x.id) from route_order_bill_order bo join route_order_bill x on x.id = bo.bill_id where bo.order_uid = $1)
           where uid = $1`,
          [uid],
        );
      }
      first ||= voucherNo;
      last = voucherNo;
      no++;
    }
    await c.query(
      `insert into route_order_series (fy, next_no) values ($1, $2) on conflict (fy) do update set next_no = excluded.next_no`,
      [fy, no],
    );
    await c.query(
      `insert into master_audit (actor, slug, record_id, action, summary) values ($1, 'routeOrderBill', $2, 'create', $3)`,
      [who, date, `Made ${no - startNo} bills for ${date}: ${first} to ${last}`],
    );
    return { ok: true, count: no - startNo, first, last };
  });
}

/**
 * Cancels a bill and frees its orders to be billed again. A stockist's order can be on two bills (milk and the rest);
 * those go together, so the order can be billed again whole. Numbers aren't reused.
 */
export async function cancelBill(id: number, who: string): Promise<{ error: string } | { cancelled: string[] }> {
  return tx(async (c) => {
    const { rows: ids } = await c.query<{ id: number }>(
      `select id from route_order_bill where id = $1
       union
       select other.bill_id from route_order_bill_order mine join route_order_bill_order other on other.order_uid = mine.order_uid where mine.bill_id = $1`,
      [id],
    );
    const { rows } = await c.query<{ id: number; voucher_no: string }>(
      `select id, voucher_no from route_order_bill where id = any($1::int[]) and status = 'issued' order by id for update`,
      [ids.map((r) => r.id)],
    );
    if (!rows.length) return { error: "That bill is already cancelled." };
    const billIds = rows.map((r) => r.id);
    const { rows: orders } = await c.query<{ order_uid: string }>(`select distinct order_uid from route_order_bill_order where bill_id = any($1::int[])`, [billIds]);
    await c.query(`update route_order_bill set status = 'cancelled', cancelled_by = $2, cancelled_at = now() where id = any($1::int[])`, [billIds, who]);
    await c.query(`delete from route_order_bill_order where bill_id = any($1::int[])`, [billIds]);
    await c.query(`update fp_booking_order set invoice_number = null, invoice_quantity = null, updated_at = now() where uid = any($1::uuid[])`, [orders.map((o) => o.order_uid)]);
    const cancelled = rows.map((r) => r.voucher_no);
    await c.query(`insert into master_audit (actor, slug, record_id, action, summary) values ($1, 'routeOrderBill', $2, 'update', $3)`, [who, String(id), `Cancelled bill ${cancelled.join(", ")}`]);
    return { cancelled };
  });
}

/** The day's live bills for the Tally file, marked as downloaded. */
export async function billsForExport(date: string): Promise<Bill[]> {
  const rows = await query<{ data: Bill }>(`update route_order_bill set exported_at = now() where order_date = $1 and status = 'issued' returning data`, [date]);
  return rows.map((r) => r.data).sort((a, b) => a.voucherNo.localeCompare(b.voucherNo, undefined, { numeric: true }));
}

// ---------------------------------------------------------------- customers and products

export interface PartyRow extends BillParty {
  route_id: number | null;
  route: string | null;
  group_name: string | null;
  firm_uid: string | null;
  firm: string | null;
  active: boolean;
}

export const listParties = () =>
  query<PartyRow>(
    `select pt.*, r.name as route, f.name as firm
     from route_order_party pt left join route_order_route r on r.id = pt.route_id left join fp_firm f on f.uid = pt.firm_uid
     order by r.sort nulls last, pt.name`,
  );

export interface ProductRow extends BillProduct { id: number; category: string; weight_kg: number; active: boolean }
export const listProducts = () => query<ProductRow>(`select * from route_order_product order by sort, name`);

/** Firms that have ordered in the last 90 days and aren't matched to a customer. */
export const unmatchedFirms = () =>
  query<{ uid: string; name: string; code: string; city: string | null; orders: number }>(
    `select f.uid, f.name, f.firm_code as code, f.city, count(*)::int as orders
     from fp_booking_order b join fp_firm f on f.uid = b.from_firm_uid
     ${PARTY_OF_FIRM}
     where pt.id is null and (b.app_kind is not null or b.order_type = 'PRIMARY') and b.booking_time > now() - interval '90 days'
     group by f.uid order by orders desc, f.name`,
  );

/** Products ordered in the last 90 days whose SKU isn't in the product master. */
export const unmatchedSkus = () =>
  query<{ sku: string; name: string; orders: number }>(
    `select p.sku_code as sku, p.sku_name as name, count(*)::int as orders
     from fp_booking_order_item i join fp_booking_order b on b.uid = i.booking_order_uid join fp_product p on p.uid = i.product_uid
     ${PRODUCT_OF_SKU}
     where rp.id is null and (b.app_kind is not null or b.order_type = 'PRIMARY') and b.booking_time > now() - interval '90 days'
     group by 1, 2 order by orders desc`,
  );
