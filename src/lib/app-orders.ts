import "server-only";
import { one, query } from "@/lib/db";

/**
 * Every order placed from the Gaia app, in three kinds:
 *  - D2C: home-delivery orders from customers (shop_order),
 *  - Retailers and Distributors: orders in the portal's order book (fp_booking_order). All primary orders are
 *    distributors'; the ones a retailer, distributor or sales officer placed from the app are marked by app_kind (db/063).
 * A trade order is a retailer's when the buyer is in the retail (RT) channel, else a distributor's.
 */

export type TradeKind = "retailers" | "distributors";

const IST_TODAY = `(now() at time zone 'Asia/Kolkata')::date`;

// ---------------------------------------------------------------- trade orders (retailers / distributors)

const TRADE_FROM = `fp_booking_order b
  join fp_firm f on f.uid = b.from_firm_uid
  left join fp_channel ch on ch.uid = f.channel_uid
  left join fp_firm sup on sup.uid = b.to_firm_uid
  left join fp_staff so on so.uid = b.staff_uid
  left join fp_staff sc on sc.uid = f.sales_contact_uid
  left join fp_beat bt on bt.uid = f.beat_uid
  left join fp_firm par on par.uid = f.parent_firm_uid
  left join dist_login dl on dl.id = b.app_login_id`;

const IS_RETAIL = `(b.app_kind = 'retailer' or ch.channel_code = 'RT')`;
// every primary order is a distributor's (whether placed from the app or the portal); retailer orders are the app's
const IS_TRADE = `(b.app_kind is not null or b.order_type = 'PRIMARY')`;
const tradeWhere = (kind: TradeKind) => `${IS_TRADE} and ${kind === "retailers" ? IS_RETAIL : `not ${IS_RETAIL}`}`;
const person = (a: string) => `nullif(trim(${a}.first_name || ' ' || coalesce(${a}.last_name, '')), '')`;

export interface TradeOrderRow {
  uid: string;
  orderId: number;
  placedAt: Date;
  status: string;
  reason: string | null;
  items: number;
  qty: number;
  total: number;
  appKind: "distributor" | "retailer" | "salesman" | null;
  notes: string | null;
  buyer: string;
  buyerCode: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  gstin: string | null;
  supplier: string | null;
  bookedBy: string | null;
}

const TRADE_ROW = `b.uid, b.order_id as "orderId", b.booking_time as "placedAt", b.status, b.rejection_reason as reason,
  b.total_item as items, b.total_quantity as qty, b.total_cost as total, b.app_kind as "appKind", b.app_notes as notes,
  f.name as buyer, f.firm_code as "buyerCode", f.city, f.state_state as state, coalesce(f.phone, dl.phone) as phone, f.gstin,
  sup.name as supplier, ${person("so")} as "bookedBy"`;

export async function listTradeOrders(kind: TradeKind, opts: { status?: string; q?: string } = {}): Promise<TradeOrderRow[]> {
  const params: unknown[] = [];
  const where = [tradeWhere(kind)];
  if (opts.status) {
    params.push(opts.status.toLowerCase());
    where.push(`lower(b.status) = $${params.length}`);
  }
  if (opts.q?.trim()) {
    params.push(`%${opts.q.trim()}%`);
    const p = `$${params.length}`;
    where.push(`(b.order_id::text ilike ${p} or f.name ilike ${p} or f.firm_code ilike ${p} or f.phone ilike ${p} or f.gstin ilike ${p} or f.city ilike ${p})`);
  }
  return query<TradeOrderRow>(`select ${TRADE_ROW} from ${TRADE_FROM} where ${where.join(" and ")} order by b.booking_time desc limit 300`, params);
}

/** The statuses that actually occur for this kind, most used first - for the filter chips. */
export async function tradeStatuses(kind: TradeKind): Promise<Array<{ status: string; n: number }>> {
  return query(`select b.status, count(*)::int as n from ${TRADE_FROM} where ${tradeWhere(kind)} group by b.status order by n desc`);
}

export interface TradeOrder extends TradeOrderRow {
  kind: TradeKind;
  reference: string | null;
  orderType: string;
  invoiceNumber: string | null;
  acceptedQty: number | null;
  cancelledQty: number | null;
  invoiceQty: number | null;
  updatedAt: Date;
  login: { phone: string; kind: string } | null;
  buyerProfile: {
    channel: string | null;
    type: string | null;
    class: string | null;
    active: boolean;
    contactPerson: string | null;
    email: string | null;
    address: string | null;
    area: string | null;
    district: string | null;
    pincode: string | null;
    lat: number | null;
    lng: number | null;
    pan: string | null;
    licenceNo: string | null;
    erpCode: string | null;
    creditLimit: number | null;
    route: string | null;
    servedBy: string | null;
    salesContact: string | null;
    salesContactPhone: string | null;
  };
  supplierCode: string | null;
  supplierCity: string | null;
  lines: Array<{ sku: string; name: string; qty: number; rate: number; mrp: number; amount: number; image: string | null }>;
}

export async function getTradeOrder(uid: string): Promise<TradeOrder | null> {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return null;
  const o = await one<Omit<TradeOrder, "lines" | "kind"> & { retail: boolean }>(
    `select ${TRADE_ROW}, ${IS_RETAIL} as retail, b.reference, b.order_type as "orderType", b.invoice_number as "invoiceNumber",
            b.accepted_quantity as "acceptedQty", b.cancelled_quantity as "cancelledQty", b.invoice_quantity as "invoiceQty",
            b.updated_at as "updatedAt",
            case when dl.id is null then null else json_build_object('phone', dl.phone, 'kind', dl.kind) end as login,
            json_build_object(
              'channel', ch.channel, 'type', f.firm_type, 'class', f.firm_class, 'active', f.active = 1,
              'contactPerson', f.contact_person, 'email', f.email, 'address', f.address, 'area', f.place,
              'district', f.district, 'pincode', f.pincode, 'lat', f.latitude, 'lng', f.longitude, 'pan', f.pan,
              'licenceNo', f.license_no, 'erpCode', f.erp_code, 'creditLimit', f.credit_limit, 'route', bt.beat_name,
              'servedBy', par.name, 'salesContact', ${person("sc")}, 'salesContactPhone', sc.phone
            ) as "buyerProfile",
            sup.firm_code as "supplierCode", sup.city as "supplierCity"
     from ${TRADE_FROM} where b.uid = $1 and ${IS_TRADE}`,
    [uid],
  );
  if (!o) return null;
  const lines = await query<TradeOrder["lines"][number]>(
    `select p.sku_code as sku, p.sku_name as name, i.quantity as qty, i.selling_price as rate, i.mrp, i.total_cost as amount,
            (select case when pi.data is not null then '/api/shop/product-image/' || pi.uid else pi.image_url end
               from fp_product_image pi where pi.product_uid = p.uid order by pi.imagesno nulls last limit 1) as image
     from fp_booking_order_item i join fp_product p on p.uid = i.product_uid
     where i.booking_order_uid = $1 order by i.order_item_number`,
    [uid],
  );
  const { retail, ...rest } = o;
  return { ...rest, kind: retail ? "retailers" : "distributors", lines };
}

// ---------------------------------------------------------------- overview

export interface KindSummary {
  today: number;
  open: number;
  monthCount: number;
  monthValue: number;
}

/** Today's orders, the ones still waiting on someone, and this month's count and value, per kind. */
export async function summaries(): Promise<Record<"d2c" | TradeKind, KindSummary>> {
  const d2c = await one<KindSummary>(
    `select count(*) filter (where (o.created_at at time zone 'Asia/Kolkata')::date = ${IST_TODAY})::int as today,
            count(*) filter (where o.status in ('placed', 'confirmed', 'out_for_delivery'))::int as open,
            count(*) filter (where date_trunc('month', o.created_at at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata') and o.status <> 'cancelled')::int as "monthCount",
            coalesce(sum(o.total) filter (where date_trunc('month', o.created_at at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata') and o.status <> 'cancelled'), 0)::float as "monthValue"
     from shop_order o`,
  );
  const trade = await query<KindSummary & { kind: TradeKind }>(
    `select case when ${IS_RETAIL} then 'retailers' else 'distributors' end as kind,
            count(*) filter (where (b.booking_time at time zone 'Asia/Kolkata')::date = ${IST_TODAY})::int as today,
            count(*) filter (where lower(b.status) = 'pending')::int as open,
            count(*) filter (where date_trunc('month', b.booking_time at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata') and lower(b.status) <> 'cancelled')::int as "monthCount",
            coalesce(sum(b.total_cost) filter (where date_trunc('month', b.booking_time at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata') and lower(b.status) <> 'cancelled'), 0)::float as "monthValue"
     from ${TRADE_FROM} where ${IS_TRADE} group by 1`,
  );
  const zero: KindSummary = { today: 0, open: 0, monthCount: 0, monthValue: 0 };
  const by = Object.fromEntries(trade.map(({ kind, ...s }) => [kind, s])) as Partial<Record<TradeKind, KindSummary>>;
  return { d2c: d2c ?? zero, retailers: by.retailers ?? zero, distributors: by.distributors ?? zero };
}

/** The latest orders of all three kinds together, newest first. */
export async function latestOrders(limit = 12): Promise<Array<{ kind: "d2c" | TradeKind; id: string; no: string; who: string; placedAt: Date; status: string; total: number }>> {
  return query(
    `(select 'd2c' as kind, o.id::text as id, o.order_no as no, o.name as who, o.created_at as "placedAt", o.status, o.total::float as total
      from shop_order o order by o.created_at desc limit $1)
     union all
     (select case when ${IS_RETAIL} then 'retailers' else 'distributors' end, b.uid::text, b.order_id::text, f.name, b.booking_time, b.status, b.total_cost
      from ${TRADE_FROM} where ${IS_TRADE} order by b.booking_time desc limit $1)
     order by "placedAt" desc limit $1`,
    [limit],
  );
}

// ---------------------------------------------------------------- D2C

export interface D2cAccount {
  id: number;
  name: string;
  phone: string;
  orders: number;
  since: Date;
}

/** The customer account behind a D2C order (orders placed before accounts have none). */
export async function d2cAccount(orderId: number): Promise<D2cAccount | null> {
  return one<D2cAccount>(
    `select c.id, c.name, c.phone, c.created_at as since, (select count(*)::int from shop_order x where x.customer_id = c.id) as orders
     from shop_order o join shop_customer c on c.id = o.customer_id where o.id = $1`,
    [orderId],
  );
}
