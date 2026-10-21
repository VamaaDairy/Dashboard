import "server-only";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { one, query, tx } from "@/lib/db";
import { listProducts, type ShopProduct } from "@/lib/shop/catalog";
import { hashPin, pinMatches } from "@/lib/shop/rider";

export { hashPin };

export const MAX_LINES = 60;
export const MAX_LINE_QTY = 100000;

export interface DistLogin {
  id: number;
  kind: "distributor" | "salesman";
  firmUid: string | null;
  staffUid: string | null;
  name: string;
  phone: string;
}

export interface DistFirm {
  uid: string;
  name: string;
  code: string;
  city: string | null;
  /** The rest of the distributor's profile, for the app's Account page. */
  type: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  pan: string | null;
  licenceNo: string | null;
  creditLimit: number | null;
  salesOfficer: string | null;
  salesOfficerPhone: string | null;
}

const FIRM_SELECT = `
  select f.uid, f.name, f.firm_code as code, f.city, f.firm_type as type, f.contact_person as "contactPerson",
         f.phone, f.email, nullif(concat_ws(', ', nullif(f.address, ''), nullif(f.place, '')), '') as address,
         f.district, f.state_state as state, f.pincode, f.gstin, f.pan, f.license_no as "licenceNo",
         f.credit_limit as "creditLimit",
         nullif(trim(concat_ws(' ', so.first_name, so.last_name)), '') as "salesOfficer", so.phone as "salesOfficerPhone"
  from fp_firm f
  left join fp_staff so on so.uid = f.sales_contact_uid`;

const LOGIN_SELECT = `
  select l.id, l.kind, l.firm_uid as "firmUid", l.staff_uid as "staffUid", l.phone,
         coalesce(f.name, trim(concat_ws(' ', s.first_name, s.last_name))) as name
  from dist_login l
  left join fp_firm f on f.uid = l.firm_uid
  left join fp_staff s on s.uid = l.staff_uid`;

/** Phone + PIN -> a fresh session token (replaces any earlier one), or null. */
export async function distLogin(phone: string, pin: string, kind?: DistLogin["kind"]): Promise<{ token: string; login: DistLogin } | null> {
  // the distributor and sales-officer sign-ins are separate screens: each only opens its own kind of login
  const r = await one<{ id: number; pin_hash: string }>(
    `select id, pin_hash from dist_login where phone = $1 and active and ($2::text is null or kind = $2)`,
    [phone, kind ?? null],
  );
  if (!r || !pinMatches(pin, r.pin_hash)) return null;
  const token = randomBytes(32).toString("hex");
  await query(`update dist_login set token = $2 where id = $1`, [r.id, token]);
  const login = await one<DistLogin>(`${LOGIN_SELECT} where l.id = $1`, [r.id]);
  return login ? { token, login } : null;
}

export async function distFromRequest(req: NextRequest): Promise<DistLogin | null> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!t) return null;
  return one<DistLogin>(`${LOGIN_SELECT} where l.token = $1 and l.active`, [t]);
}

/** The distributors this login may order for: its own firm, or (sales officer) the firms they are the sales contact of; a sales officer with none mapped can book for any distributor. */
export async function firmsFor(login: DistLogin): Promise<DistFirm[]> {
  if (login.kind === "distributor") {
    return query<DistFirm>(`${FIRM_SELECT} where f.uid = $1 and f.active = 1`, [login.firmUid]);
  }
  const mapped = await query<DistFirm>(
    `${FIRM_SELECT} join fp_channel c on c.uid = f.channel_uid
     where f.sales_contact_uid = $1 and f.active = 1 and c.level <= 3
     order by f.name`,
    [login.staffUid],
  );
  if (mapped.length) return mapped;
  return query<DistFirm>(
    `${FIRM_SELECT} join fp_channel c on c.uid = f.channel_uid
     where f.active = 1 and c.level = 3
     order by f.name`,
  );
}

async function firmAllowed(login: DistLogin, firmUid: string | undefined): Promise<DistFirm | null> {
  const firms = await firmsFor(login);
  if (!firmUid) return firms.length === 1 ? firms[0] : null;
  return firms.find((f) => f.uid === firmUid) ?? null;
}

/** The catalogue the retail app shows, priced at this distributor's dealer price. */
export async function catalogFor(login: DistLogin, firmUid: string | undefined): Promise<ShopProduct[] | null> {
  const firm = await firmAllowed(login, firmUid);
  if (!firm) return null;
  const [products, prices] = await Promise.all([listProducts(), dealerPrices(firm.uid)]);
  return products.flatMap((p) => {
    const dp = prices.get(p.sku);
    return dp && dp > 0 ? [{ ...p, price: dp }] : [];
  });
}

/** sku -> the distributor channel's dealer price, falling back to the product's DP. */
async function dealerPrices(firmUid: string, skus?: string[]): Promise<Map<string, number>> {
  const rows = await query<{ sku: string; dp: number | null }>(
    `select p.sku_code as sku, coalesce(cr.dealer_price, p.dp) as dp
     from fp_product p
     left join lateral (
       select r.dealer_price from fp_channel_rate r
       where r.product_uid = p.uid and r.channel_uid = (select channel_uid from fp_firm where uid = $1)
       order by r.updated_at desc limit 1
     ) cr on true
     where p.active = 1 and ($2::text[] is null or p.sku_code = any($2))`,
    [firmUid, skus ?? null],
  );
  return new Map(rows.filter((r) => r.dp != null).map((r) => [r.sku, Number(r.dp)]));
}

export type PlaceResult = { ok: true; orderId: number; total: number } | { ok: false; error: string };

export async function placeDistOrder(
  login: DistLogin,
  input: { firmUid?: string; lines: Array<{ sku: string; qty: number }>; notes?: string | null },
): Promise<PlaceResult> {
  const firm = await firmAllowed(login, input.firmUid);
  if (!firm) return { ok: false, error: "Choose the distributor this order is for." };

  const merged = new Map<string, number>();
  for (const l of input.lines) merged.set(l.sku, (merged.get(l.sku) ?? 0) + l.qty);
  if (!merged.size) return { ok: false, error: "The cart is empty." };
  if (merged.size > MAX_LINES) return { ok: false, error: `At most ${MAX_LINES} products per order.` };

  const skus = [...merged.keys()];
  // only what the shop lists (same visibility as the retail app), priced server-side
  const [listed, prices, prods] = await Promise.all([
    listProducts(),
    dealerPrices(firm.uid, skus),
    query<{ uid: string; sku: string; mrp: number }>(`select uid, sku_code as sku, mrp from fp_product where sku_code = any($1) and active = 1`, [skus]),
  ]);
  const visible = new Set(listed.map((p) => p.sku));
  const byUid = new Map(prods.map((p) => [p.sku, p]));
  const lines: Array<{ uid: string; mrp: number; dp: number; qty: number }> = [];
  for (const [sku, qty] of merged) {
    const p = byUid.get(sku);
    const dp = prices.get(sku);
    if (!p || !visible.has(sku) || !dp || dp <= 0) return { ok: false, error: `${sku} is not available to order.` };
    lines.push({ uid: p.uid, mrp: Number(p.mrp), dp, qty });
  }
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const total = Math.round(lines.reduce((s, l) => s + l.qty * l.dp, 0) * 100) / 100;

  return tx(async (c) => {
    await c.query(`select pg_advisory_xact_lock(hashtext('dist_order_no'))`);
    // follow the portal's own vocabulary instead of inventing one
    const [{ n }] = (await c.query<{ n: number }>(`select coalesce(max(order_id), 0) + 1 as n from fp_booking_order`)).rows;
    const statuses = (await c.query<{ status: string }>(`select distinct status from fp_booking_order`)).rows.map((r) => r.status);
    const status = statuses.find((s) => /^(pending|open|new|booked|created|placed)/i.test(s)) ?? "Pending";
    const type = (await c.query<{ t: string | null }>(
      `select mode() within group (order by b.order_type) as t
       from fp_booking_order b join fp_firm f on f.uid = b.from_firm_uid join fp_channel ch on ch.uid = f.channel_uid
       where ch.level <= 3`,
    )).rows[0]?.t ?? "PRIMARY";
    const to = (await c.query<{ uid: string | null }>(
      `select coalesce(f.parent_firm_uid, (select x.uid from fp_firm x join fp_channel ch on ch.uid = x.channel_uid where ch.level = 1 and x.active = 1 order by x.name limit 1)) as uid
       from fp_firm f where f.uid = $1`,
      [firm.uid],
    )).rows[0]?.uid ?? null;

    const now = new Date();
    const ins = await c.query<{ uid: string }>(
      `insert into fp_booking_order
         (order_uid, order_id, order_type, booking_time, booking_date, total_item, week_of_month, total_quantity,
          total_cost, dealer_cost, status, current_status, reference, from_firm_uid, to_firm_uid, staff_uid)
       values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $9, $10, $11, $12, $13)
       returning uid`,
      [
        n, type, now, now.toISOString().slice(0, 10), lines.length, Math.ceil(now.getDate() / 7), totalQty,
        total, status, (input.notes ?? "").trim().slice(0, 300) || `Gaia app (${login.kind}: ${login.name})`,
        firm.uid, to, login.kind === "salesman" ? login.staffUid : null,
      ],
    );
    const orderUid = ins.rows[0].uid;
    let i = 0;
    for (const l of lines) {
      await c.query(
        `insert into fp_booking_order_item
           (mrp, selling_price, dp, quantity, stock, total_cost, booking_order_uid, product_uid, order_item_number)
         values ($1, $2, $2, $3, 0, $4, $5, $6, $7)`,
        [l.mrp, l.dp, l.qty, Math.round(l.qty * l.dp * 100) / 100, orderUid, l.uid, ++i],
      );
    }
    return { ok: true as const, orderId: n, total };
  });
}

export interface DistOrderRow {
  orderId: number;
  date: string;
  distributor: string;
  status: string;
  items: number;
  qty: number;
  total: number;
  lines: Array<{ sku: string; name: string; qty: number; rate: number; amount: number }>;
}

export async function listDistOrders(login: DistLogin): Promise<DistOrderRow[]> {
  const rows = await query<Omit<DistOrderRow, "lines"> & { uid: string }>(
    `select b.uid, b.order_id as "orderId", b.booking_time as date, f.name as distributor, b.status,
            b.total_item as items, b.total_quantity as qty, b.total_cost as total
     from fp_booking_order b join fp_firm f on f.uid = b.from_firm_uid
     where ${login.kind === "distributor" ? "b.from_firm_uid = $1" : "b.staff_uid = $1"}
     order by b.booking_time desc limit 100`,
    [login.kind === "distributor" ? login.firmUid : login.staffUid],
  );
  if (!rows.length) return [];
  const items = await query<{ b: string; sku: string; name: string; qty: number; rate: number; amount: number }>(
    `select i.booking_order_uid as b, p.sku_code as sku, p.sku_name as name, i.quantity as qty, i.selling_price as rate, i.total_cost as amount
     from fp_booking_order_item i join fp_product p on p.uid = i.product_uid
     where i.booking_order_uid = any($1) order by i.order_item_number`,
    [rows.map((r) => r.uid)],
  );
  return rows.map(({ uid, ...r }) => ({
    ...r,
    date: new Date(r.date).toISOString(),
    lines: items.filter((i) => i.b === uid).map(({ b: _b, ...l }) => l),
  }));
}
