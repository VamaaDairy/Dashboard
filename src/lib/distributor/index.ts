import { tellBuyersOf } from "@/lib/orders/notify";
import "server-only";
import { priceWithOffers, writeOrderLines } from "./offers";
import { randomBytes, randomInt } from "node:crypto";
import type { NextRequest } from "next/server";
import { one, query, tx } from "@/lib/db";
import { listAllProducts, type ShopProduct } from "@/lib/shop/catalog";
import { hashPin, pinMatches } from "@/lib/shop/rider";
import { loadRecord, saveRecord } from "@/lib/masters/entity/service";
import { MASTERS } from "@/lib/masters/schemas";
import { issueInvoice } from "./invoice";
import { packsFor, splitUnits, type Pack, type Units } from "./packs";
import { markDemandsOrdered } from "./demands";

export { hashPin };

export const MAX_LINES = 60;
export const MAX_LINE_QTY = 100000;

export interface DistLogin {
  id: number;
  kind: "distributor" | "salesman" | "retailer";
  firmUid: string | null;
  staffUid: string | null;
  name: string;
  phone: string;
}

/** A distributor an order can be placed for, with its profile as on the dashboard's Customer Masters page. */
export interface DistFirm {
  uid: string;
  name: string;
  code: string;
  city: string | null;
  channel: string | null;
  /** DB, SS, MFS, IT, PT, RT ... (RT: a retailer, ordered at retail prices on its distributor) */
  channelCode: string | null;
  type: string | null;
  class: string | null;
  active: boolean;
  servedBy: string | null;
  route: string | null;
  erpCode: string | null;
  createdAt: string | null;
  contactPerson: string | null;
  phone: string | null;
  landline: string | null;
  email: string | null;
  address: string | null;
  area: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  gstin: string | null;
  pan: string | null;
  licenceNo: string | null;
  creditLimit: number | null;
  salesOfficer: string | null;
  salesOfficerPhone: string | null;
}

// the same joins and columns as the Customer Masters page (src/lib/masters/schemas/customers.ts)
const FIRM_SELECT = `
  select f.uid, f.name, f.firm_code as code, f.city, ch.channel, ch.channel_code as "channelCode", f.firm_type as type, f.firm_class as class,
         f.active = 1 as active, p.name as "servedBy", b.beat_name as route, f.erp_code as "erpCode", f.created_at as "createdAt",
         f.contact_person as "contactPerson", f.phone, f.landline, f.email, f.address, f.place as area, f.district, f.state_state as state, f.pincode,
         f.latitude as lat, f.longitude as lng, f.gstin, f.pan, f.license_no as "licenceNo", f.credit_limit as "creditLimit",
         nullif(trim(so.first_name || ' ' || coalesce(so.last_name, '')), '') as "salesOfficer", so.phone as "salesOfficerPhone"
  from fp_firm f
  left join fp_channel ch on ch.uid = f.channel_uid
  left join fp_firm p on p.uid = f.parent_firm_uid
  left join fp_staff so on so.uid = f.sales_contact_uid
  left join fp_beat b on b.uid = f.beat_uid`;

const LOGIN_SELECT = `
  select l.id, l.kind, l.firm_uid as "firmUid", l.staff_uid as "staffUid", l.phone,
         coalesce(f.name, trim(concat_ws(' ', s.first_name, s.last_name))) as name
  from dist_login l
  left join fp_firm f on f.uid = l.firm_uid
  left join fp_staff s on s.uid = l.staff_uid`;

/** A distributor can use the app only while its customer record is active; a sales officer's login is not tied to one. */
const FIRM_ACTIVE = `(l.kind = 'salesman' or f.active = 1)`;

/** A new session for one phone; the login's other phones stay signed in. */
async function openSession(loginId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await query(`insert into dist_session (token, login_id) values ($1, $2)`, [token, loginId]);
  return token;
}

/**
 * Phone + PIN -> a new session token for this phone (other phones stay signed in), null for a wrong number or PIN,
 * or "inactive" when the details are right but the customer is switched off in Customer Masters.
 */
export async function distLogin(phone: string, pin: string, kind?: DistLogin["kind"]): Promise<{ token: string; login: DistLogin } | "inactive" | null> {
  // sales officers have their own app (Gaia Salesforce, /api/salesforce): the partner app (no kind given) never opens their logins
  const r = await one<{ id: number; pin_hash: string; open: boolean }>(
    `select l.id, l.pin_hash, ${FIRM_ACTIVE} as open
       from dist_login l left join fp_firm f on f.uid = l.firm_uid
      where l.phone = $1 and l.active and (case when $2::text is null then l.kind <> 'salesman' else l.kind = $2 end)`,
    [phone, kind ?? null],
  );
  if (!r || !pinMatches(pin, r.pin_hash)) return null;
  if (!r.open) return "inactive";
  const token = await openSession(r.id);
  const login = await one<DistLogin>(`${LOGIN_SELECT} where l.id = $1`, [r.id]);
  return login ? { token, login } : null;
}

/**
 * Forgot PIN, or the first PIN of a sign-in the office made (the number confirmed by SMS): the new PIN goes on the
 * number's partner sign-ins ([kind], else all of them) and this phone gets a fresh session; other phones are signed out.
 * Null when the number has no such sign-in; "inactive" when its firm is switched off.
 */
export async function distResetPin(phone: string, pin: string, kind?: "distributor" | "retailer"): Promise<{ token: string; login: DistLogin } | "inactive" | null> {
  const rows = await query<{ id: number; open: boolean }>(
    `select l.id, ${FIRM_ACTIVE} as open from dist_login l left join fp_firm f on f.uid = l.firm_uid
      where l.phone = $1 and l.active and l.kind <> 'salesman' and ($2::text is null or l.kind = $2) order by l.id`,
    [phone, kind ?? null],
  );
  if (!rows.length) return null;
  // the new PIN signs every phone out of these sign-ins; this one gets a session again below
  await query(
    `with gone as (delete from dist_session where login_id = any($1::int[]))
     update dist_login set pin_hash = $2 where id = any($1::int[])`,
    [rows.map((r) => r.id), hashPin(pin)],
  );
  const first = rows.find((r) => r.open);
  if (!first) return "inactive";
  const token = await openSession(first.id);
  const login = await one<DistLogin>(`${LOGIN_SELECT} where l.id = $1`, [first.id]);
  return login ? { token, login } : null;
}

/** True when the number has an active partner sign-in (Forgot PIN can text it a code). */
export const hasDistLogin = async (phone: string) =>
  !!(await one(`select 1 from dist_login where phone = $1 and active and kind <> 'salesman'`, [phone]));

/**
 * The login behind a request's bearer token. `scope` keeps the two apps apart: the Gaia Distributors app ("partner",
 * the default) only accepts distributors and retailers, the Gaia Salesforce app ("salesman") only sales officers;
 * "any" is for shared endpoints such as push registration.
 */
export async function distFromRequest(req: NextRequest, scope: "partner" | "salesman" | "any" = "partner"): Promise<DistLogin | null> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!t) return null;
  const kindOk = scope === "any" ? "true" : scope === "salesman" ? "l.kind = 'salesman'" : "l.kind <> 'salesman'";
  // checked on every call, so switching a customer off in the masters signs its phones out at once
  const login = await one<DistLogin>(
    `${LOGIN_SELECT} join dist_session ds on ds.login_id = l.id where ds.token = $1 and l.active and ${FIRM_ACTIVE} and ${kindOk}`,
    [t],
  );
  // "last seen" at most once an hour - enough to tell live sessions from forgotten phones
  if (login) await query(`update dist_session set last_seen = now() where token = $1 and last_seen < now() - interval '1 hour'`, [t]);
  return login;
}

/** Signs this phone out: its session ends; the login's other phones stay signed in. */
export async function endDistSession(req: NextRequest): Promise<void> {
  const t = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (t) await query(`delete from dist_session where token = $1`, [t]);
}

/** The distributors this login may order for: its own firm, or (sales officer) the firms they are the sales contact of; a sales officer with none mapped can book for any distributor. */
export async function firmsFor(login: DistLogin): Promise<DistFirm[]> {
  if (login.kind !== "salesman") {
    return query<DistFirm>(`${FIRM_SELECT} where f.uid = $1 and f.active = 1`, [login.firmUid]);
  }
  // every active party this officer is the sales contact for - super stockists, distributors, MFS, institutions,
  // PT and retailers - but never the company itself; nothing when none is mapped to them
  return query<DistFirm>(
    `${FIRM_SELECT}
     where f.sales_contact_uid = $1 and f.active = 1 and coalesce(ch.level, 9) > 1
     order by coalesce(ch.level, 9), ch.channel, f.name`,
    [login.staffUid],
  );
}

async function firmAllowed(login: DistLogin, firmUid: string | undefined): Promise<DistFirm | null> {
  const firms = await firmsFor(login);
  if (!firmUid) return firms.length === 1 ? firms[0] : null;
  return firms.find((f) => f.uid === firmUid) ?? null;
}

/** Which Product Master list a login orders from: retailers the Retail list, distributors and sales officers the Distributors list. */
export const appChannelOf = (login: DistLogin): "retail" | "distributor" => (login.kind === "retailer" ? "retail" : "distributor");

/** The list an order for this party is priced from: a retailer (RT) party is on the Retail list, whoever books it. */
export const partyChannel = (login: DistLogin, firm: Pick<DistFirm, "channelCode">): "retail" | "distributor" =>
  login.kind === "retailer" || (firm.channelCode ?? "").toUpperCase() === "RT" ? "retail" : "distributor";

/** The catalogue the retail app shows, priced at this distributor's dealer price. */
export async function catalogFor(login: DistLogin, firmUid: string | undefined): Promise<Array<ShopProduct & { pack: Pack | null }> | null> {
  const firm = await firmAllowed(login, firmUid);
  if (!firm) return null;
  // the Product Master list for this app (Retail or Distributors), each product they have a price for
  const [products, prices] = await Promise.all([listAllProducts(partyChannel(login, firm)), dealerPrices(firm.uid)]);
  const packs = await packsFor(products.map((p) => p.sku));
  return products.flatMap((p) => {
    const dp = prices.get(p.sku);
    // pack: { unit: "CRT", per: 24, base: "PCS" } when it can be ordered by the crate / box as well as by the piece
    return dp && dp > 0 ? [{ ...p, price: dp, pack: packs.get(p.sku) ?? null }] : [];
  });
}

export interface FirmPrice {
  sku: string;
  price: number;
  /** Where the price came from: the customer's own price list, its channel's rate, or the product's own DP. */
  source: "list" | "channel" | "product";
  list: string | null;
}

/**
 * What a customer pays for each product - the one place this is worked out, used by the app's menu, its
 * orders and the dashboard's price check. In order: the customer's own price list, else its channel's rate
 * (one set for the customer's state wins over the all-states one), else the product's channel price
 * (retailers only), else its DP.
 */
export async function firmPrices(firmUid: string, skus?: string[]): Promise<FirmPrice[]> {
  const rows = await query<{ sku: string; pl: number | null; list: string | null; cr: number | null; cp: number | null; dp: number | null; retail: boolean }>(
    `select p.sku_code as sku, pl.dp as pl, pl.name as list, cr.dealer_price as cr, p.channel_price as cp, p.dp, f.retail
     from fp_product p
     cross join (
       select x.channel_uid, upper(coalesce(x.state_state, '')) as state, coalesce(upper(c.channel_code) = 'RT', false) as retail
       from fp_firm x left join fp_channel c on c.uid = x.channel_uid where x.uid = $1
     ) f
     -- the customer's own price list (Price list page), if it prices this product
     left join lateral (
       select sr.dp, sl.name from fp_slab_firm_mapping m
       join fp_slab sl on sl.uid = m.slab_uid and coalesce(sl.active, 1) = 1
       join fp_slab_rate sr on sr.slab_uid = sl.uid and sr.product_uid = p.uid and coalesce(sr.active, 1) = 1
                           and (sr.from_date is null or sr.from_date <= now())
       where m.firm_uid = $1 and sr.dp > 0
       order by sr.from_date desc nulls last, sr.updated_at desc limit 1
     ) pl on true
     left join lateral (
       select r.dealer_price from fp_channel_rate r
       where r.product_uid = p.uid and r.channel_uid = f.channel_uid and r.dealer_price > 0
         and (r.state_state is null or upper(r.state_state) = f.state)
       order by (r.state_state is not null) desc, r.updated_at desc limit 1
     ) cr on true
     where p.active = 1 and ($2::text[] is null or p.sku_code = any($2))`,
    [firmUid, skus ?? null],
  );
  const out: FirmPrice[] = [];
  for (const r of rows) {
    if (r.pl && r.pl > 0) out.push({ sku: r.sku, price: Number(r.pl), source: "list", list: r.list });
    else if (r.cr && r.cr > 0) out.push({ sku: r.sku, price: Number(r.cr), source: "channel", list: null });
    else if (r.retail && r.cp && r.cp > 0) out.push({ sku: r.sku, price: Number(r.cp), source: "channel", list: null });
    else if (r.dp && r.dp > 0) out.push({ sku: r.sku, price: Number(r.dp), source: "product", list: null });
  }
  return out;
}

/** sku -> what this customer pays (see firmPrices). */
async function dealerPrices(firmUid: string, skus?: string[]): Promise<Map<string, number>> {
  return new Map((await firmPrices(firmUid, skus)).map((r) => [r.sku, r.price]));
}

/** units: the split as ordered, e.g. { CRT: 2, PCS: 5 } (qty is always the total in pieces); null without a pack. */
export type PricedLine = { uid: string; sku: string; mrp: number; dp: number; qty: number; units?: Units | null };

/** Each line's split: [packs] (packs ordered, by SKU) where given, else whole packs that fit; none without a pack. */
export async function withUnits(lines: PricedLine[], packs: Map<string, number>, keep?: Map<string, { qty: number; units: Units | null }>): Promise<PricedLine[]> {
  const defs = await packsFor(lines.map((l) => l.sku));
  return lines.map((l) => {
    const old = keep?.get(l.sku);
    const given = packs.has(l.sku) ? packs.get(l.sku)! : old && old.qty === l.qty && old.units ? (old.units[defs.get(l.sku)?.unit ?? ""] ?? null) : null;
    return { ...l, units: splitUnits(l.qty, defs.get(l.sku), given) };
  });
}

/**
 * Prices order lines server-side for one buyer: each SKU must be on that app's Product Master list and have a
 * dealer price for the firm. Used when an order is placed and when it is edited (by the buyer or the office).
 */
export async function priceDistLines(
  channel: "retail" | "distributor", firmUid: string, merged: Map<string, number>,
): Promise<{ ok: true; lines: PricedLine[] } | { ok: false; error: string }> {
  const skus = [...merged.keys()];
  const [listed, prices, prods] = await Promise.all([
    listAllProducts(channel),
    dealerPrices(firmUid, skus),
    query<{ uid: string; sku: string; mrp: number }>(`select uid, sku_code as sku, mrp from fp_product where sku_code = any($1) and active = 1`, [skus]),
  ]);
  const visible = new Set(listed.map((p) => p.sku));
  const byUid = new Map(prods.map((p) => [p.sku, p]));
  const lines: PricedLine[] = [];
  for (const [sku, qty] of merged) {
    const p = byUid.get(sku);
    const dp = prices.get(sku);
    if (!p || !visible.has(sku) || !dp || dp <= 0) return { ok: false, error: `${sku} is not available to order.` };
    lines.push({ uid: p.uid, sku, mrp: Number(p.mrp), dp, qty });
  }
  return { ok: true, lines };
}

export type PlaceResult = { ok: true; orderId: number; total: number } | { ok: false; error: string };

/**
 * The cart priced exactly as placeDistOrder would place it - the firm's prices and the partner offers that apply -
 * for the app's cart and checkout (POST /api/distributor/quote).
 */
export async function quoteDistOrder(
  login: DistLogin, input: { firmUid?: string; lines: Array<{ sku: string; qty: number; packs?: number | null }>; code?: string | null },
): Promise<{ ok: true; quote: import("./offers").PartnerQuote } | { ok: false; error: string }> {
  const firm = await firmAllowed(login, input.firmUid);
  if (!firm) return { ok: false, error: "Choose the party this order is for." };
  const merged = new Map<string, number>();
  const packsOrdered = new Map<string, number>();
  for (const l of input.lines) {
    merged.set(l.sku, (merged.get(l.sku) ?? 0) + l.qty);
    if (l.packs !== undefined && l.packs !== null) packsOrdered.set(l.sku, (packsOrdered.get(l.sku) ?? 0) + l.packs);
  }
  if (!merged.size) return { ok: false, error: "The cart is empty." };
  if (merged.size > MAX_LINES) return { ok: false, error: `At most ${MAX_LINES} products per order.` };
  const channel = partyChannel(login, firm);
  const priced = await priceDistLines(channel, firm.uid, merged);
  if (!priced.ok) return priced;
  return { ok: true, quote: await priceWithOffers(channel, firm.uid, await withUnits(priced.lines, packsOrdered), input.code?.trim() || null) };
}

export async function placeDistOrder(
  login: DistLogin,
  input: {
    firmUid?: string; lines: Array<{ sku: string; qty: number; packs?: number | null }>; notes?: string | null; visitId?: number | null;
    /** the retailer requirements (db/100_retailer_demands.sql) this distributor order covers */
    demandIds?: number[];
    /** a partner offer's coupon code (Marketing > Offers in the Dashboard) */
    code?: string | null;
  },
): Promise<PlaceResult> {
  // a retailer sends its requirement to its distributor instead (src/lib/distributor/demands.ts). Until every retailer
  // has the app version that can send one (Gaia Distributors 1.0.5), direct orders stay open: set
  // RETAILER_DIRECT_ORDERS=off in .env to stop them.
  if (login.kind === "retailer" && process.env.RETAILER_DIRECT_ORDERS === "off") return { ok: false, error: "Retailers send their requirement to their distributor. Please update the Gaia Distributors app." };
  const firm = await firmAllowed(login, input.firmUid);
  if (!firm) return { ok: false, error: "Choose the party this order is for." };

  const merged = new Map<string, number>();
  const packsOrdered = new Map<string, number>();
  for (const l of input.lines) {
    merged.set(l.sku, (merged.get(l.sku) ?? 0) + l.qty);
    if (l.packs !== undefined && l.packs !== null) packsOrdered.set(l.sku, (packsOrdered.get(l.sku) ?? 0) + l.packs);
  }
  if (!merged.size) return { ok: false, error: "The cart is empty." };
  if (merged.size > MAX_LINES) return { ok: false, error: `At most ${MAX_LINES} products per order.` };

  const channel = partyChannel(login, firm);
  const priced = await priceDistLines(channel, firm.uid, merged);
  if (!priced.ok) return priced;
  const units = await withUnits(priced.lines, packsOrdered);
  // the partner offers that apply, priced into the lines (src/lib/distributor/offers.ts)
  const quote = await priceWithOffers(channel, firm.uid, units, input.code?.trim() || null);
  if (input.code?.trim() && quote.codeStatus !== "applied") return { ok: false, error: quote.codeMessage ?? "This code is not valid." };
  const lines = quote.lines;
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const total = quote.total;

  // a retailer orders from the distributor that serves it: none (or one no longer active) means it can't order yet
  if (channel === "retail" && !(await one(`select 1 from fp_firm f join fp_firm p on p.uid = f.parent_firm_uid where f.uid = $1 and p.active = 1`, [firm.uid]))) {
    return { ok: false, error: "Your distributor isn't set yet. Please contact Gaia." };
  }

  const placed = await tx(async (c) => {
    await c.query(`select pg_advisory_xact_lock(hashtext('dist_order_no'))`);
    // follow the portal's own vocabulary instead of inventing one
    const [{ n }] = (await c.query<{ n: number }>(`select coalesce(max(order_id), 0) + 1 as n from fp_booking_order`)).rows;
    const statuses = (await c.query<{ status: string }>(`select distinct status from fp_booking_order`)).rows.map((r) => r.status);
    const status = statuses.find((s) => /^(pending|open|new|booked|created|placed)/i.test(s)) ?? "Pending";
    // a retailer's order (placed by the retailer or booked for one by a sales officer) is a secondary order on its distributor
    const retailer = channel === "retail";
    const type = (await c.query<{ t: string | null }>(
      `select mode() within group (order by b.order_type) as t
       from fp_booking_order b join fp_firm f on f.uid = b.from_firm_uid join fp_channel ch on ch.uid = f.channel_uid
       where ${retailer ? "ch.channel_code = 'RT'" : "ch.level <= 3"}`,
    )).rows[0]?.t ?? (retailer ? "SECONDARY" : "PRIMARY");
    const to = (await c.query<{ uid: string | null }>(
      `select coalesce(f.parent_firm_uid, (select x.uid from fp_firm x join fp_channel ch on ch.uid = x.channel_uid where ch.level = 1 and x.active = 1 order by x.name limit 1)) as uid
       from fp_firm f where f.uid = $1`,
      [firm.uid],
    )).rows[0]?.uid ?? null;

    const now = new Date();
    const notes = (input.notes ?? "").trim().slice(0, 300);
    const ins = await c.query<{ uid: string }>(
      `insert into fp_booking_order
         (order_uid, order_id, order_type, booking_time, booking_date, total_item, week_of_month, total_quantity,
          total_cost, dealer_cost, status, current_status, reference, from_firm_uid, to_firm_uid, staff_uid,
          app_kind, app_login_id, app_notes, sf_visit_id, delivery_date)
       values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $9, $10, $11, $12, $13, $14, $15, $16, $17,
               (now() at time zone 'Asia/Kolkata')::date + 1)
       returning uid`,
      [
        n, type, now, now.toISOString().slice(0, 10), lines.length, Math.ceil(now.getDate() / 7), totalQty,
        total, status, notes || `Gaia app (${login.kind}: ${login.name})`,
        firm.uid, to, login.kind === "salesman" ? login.staffUid : null,
        // marks it as an app order for the dashboard's App orders section
        login.kind, login.id || null, notes || null,
        // the store visit a sales officer booked it during
        input.visitId ?? null,
      ],
    );
    const orderUid = ins.rows[0].uid;
    await c.query(
      `insert into dist_order_event (order_uid, action, actor, actor_kind) values ($1, 'placed', $2, 'app')`,
      [orderUid, `${login.name} (${login.kind})`],
    );
    if (login.kind === "distributor" && input.demandIds?.length) {
      await markDemandsOrdered(c, firm.uid, input.demandIds, orderUid, `${login.name} (${login.kind})`);
    }
    await writeOrderLines(c, orderUid, quote);
    // its GST invoice, numbered now; should that fail the order still stands and the invoice is issued when first opened
    await c.query("savepoint invoice");
    try {
      await issueInvoice(c, orderUid);
      await c.query("release savepoint invoice");
    } catch (e) {
      await c.query("rollback to savepoint invoice");
      console.error("invoice for order", n, e);
    }
    return { ok: true as const, orderId: n, total, uid: orderUid };
  });
  // a sales officer booked it: the party hears of it in its own app (every sign-in of the firm)
  if (login.kind === "salesman") {
    await tellBuyersOf([placed.uid], (o) => ({
      title: `New order #${o.orderId} from Sales officer ${login.name}`,
      body: `${lines.length} ${lines.length === 1 ? "product" : "products"} · ₹${total.toLocaleString("en-IN")}. You can change it in the app until 8 pm the day before delivery.`,
    }));
  }
  return { ok: true as const, orderId: placed.orderId, total: placed.total };
}

export interface DistOrderRow {
  orderId: number;
  date: string;
  distributor: string;
  status: string;
  items: number;
  qty: number;
  total: number;
  /** why the office cancelled it */
  reason: string | null;
  /** its GST invoice number, once issued */
  invoiceNo: string | null;
  /** who put it in: "Distributor", "Retailer", "Sales officer <name>" or "Gaia" (the office) */
  placedBy: string;
  /** the party it is for (Customer Masters uid) */
  firmUid: string;
  /** the 4-digit code the buyer gives the transporter at delivery; null once it is delivered or cancelled */
  deliveryCode: string | null;
  /** rupees off by offers, and the coupon code it was placed with */
  discount: number;
  code: string | null;
  /** units: the split as ordered, e.g. { CRT: 2, PCS: 5 }; null when ordered by the piece only */
  /** rate: paid per piece; listRate: before any offer; discount: rupees off; free: given by an offer (offer: its name) */
  lines: Array<{ sku: string; name: string; qty: number; rate: number; listRate: number; amount: number; discount: number; free: boolean; offer: string | null; units: Units | null }>;
  /** internal: the API adds the order's delivery date, edit window and history from it, then drops it */
  uid: string;
}

/**
 * Which orders a login sees - one history per party, the same whoever placed them: a distributor or retailer every
 * order of its own firm (its own and those a sales officer booked for it), a sales officer every order of the parties
 * they are the sales contact of (whoever placed it) plus any they booked themselves.
 */
const visibleTo = (login: DistLogin) =>
  login.kind !== "salesman"
    ? { where: "b.from_firm_uid = $1", arg: login.firmUid }
    : { where: "(b.staff_uid = $1 or b.from_firm_uid in (select uid from fp_firm where sales_contact_uid = $1 and active = 1))", arg: login.staffUid };

/** The order's uid when this login may see it (as on its Orders list), else null. */
export async function distOrderUid(login: DistLogin, orderId: number): Promise<string | null> {
  const v = visibleTo(login);
  const r = await one<{ uid: string }>(`select b.uid from fp_booking_order b where b.order_id = $2 and ${v.where}`, [v.arg, orderId]);
  return r?.uid ?? null;
}

/** An order the plant supplies (no supplier, or the company): billed in Tally, so its bill is the Tally bill. */
export const PLANT_ORDER = (b: string) =>
  `(${b}.to_firm_uid is null or exists (select 1 from fp_firm sx join fp_channel cx on cx.uid = sx.channel_uid where sx.uid = ${b}.to_firm_uid and (cx.channel_code in ('CMP', 'CO') or coalesce(cx.level, 9) <= 1)))`;

export async function listDistOrders(login: DistLogin): Promise<DistOrderRow[]> {
  const v = visibleTo(login);
  const rows = await query<Omit<DistOrderRow, "lines"> & { uid: string }>(
    `select b.uid, b.order_id as "orderId", b.booking_time as date, f.name as distributor, f.uid as "firmUid", b.status,
            b.total_item as items, b.total_quantity as qty, b.total_cost as total, coalesce(b.scheme_discount, 0) as discount,
            b.scheme_details->>'code' as code,
            nullif(trim(b.rejection_reason), '') as reason,
            case when lower(b.status) in ('cancelled', 'rejected') or exists (select 1 from dist_trip_stop x where x.order_uid = b.uid and x.status = 'delivered')
                 then null else b.delivery_code end as "deliveryCode",
            -- an order from the plant shows its Tally bill (once made); one supplied by a distributor, that distributor's invoice
            case when ${PLANT_ORDER("b")}
                 then (select string_agg(x.voucher_no, ', ' order by x.id) from route_order_bill_order bo join route_order_bill x on x.id = bo.bill_id
                        where bo.order_uid = b.uid and x.status = 'issued')
                 else (select v.invoice_no from dist_invoice v where v.booking_order_uid = b.uid) end as "invoiceNo",
            case b.app_kind when 'distributor' then 'Distributor' when 'retailer' then 'Retailer'
                 when 'salesman' then 'Sales officer' || coalesce(' ' || nullif(trim(so.first_name || ' ' || coalesce(so.last_name, '')), ''), '')
                 else 'Gaia' end as "placedBy"
     from fp_booking_order b join fp_firm f on f.uid = b.from_firm_uid
     left join fp_staff so on so.uid = b.staff_uid
     where ${v.where}
     order by b.booking_time desc limit 200`,
    [v.arg],
  );
  if (!rows.length) return [];
  // rate: paid per piece; listRate: before any offer; discount: rupees off the line; free: given by an offer
  const items = await query<{ b: string; sku: string; name: string; qty: number; rate: number; listRate: number; amount: number; discount: number; free: boolean; offer: string | null; units: Units | null }>(
    `select i.booking_order_uid as b, p.sku_code as sku, p.sku_name as name, i.quantity as qty, i.selling_price as rate, coalesce(i.dp, i.selling_price) as "listRate",
            i.total_cost as amount, coalesce(i.scheme_discount, 0) as discount, coalesce((i.scheme_details->>'free')::boolean, false) as free,
            i.scheme_details->>'offer' as offer, i.units
     from fp_booking_order_item i join fp_product p on p.uid = i.product_uid
     where i.booking_order_uid = any($1) order by i.order_item_number`,
    [rows.map((r) => r.uid)],
  );
  return rows.map(({ uid, ...r }) => ({
    ...r,
    uid,
    date: new Date(r.date).toISOString(),
    lines: items.filter((i) => i.b === uid).map(({ b: _b, ...l }) => l),
  }));
}


// ---- editing the distributor's own details from the app ----

/** App field -> Customer Masters field. Only these can be changed from the phone; code, name, channel, route, credit limit etc. stay with the office. */
const EDITABLE: Record<string, string> = {
  contactPerson: "contact_person", phone: "phone", email: "email", address: "address", area: "place", city: "city",
  state: "state_state", pincode: "pincode", gstin: "gstin", pan: "pan", licenceNo: "license_no", lat: "latitude", lng: "longitude",
};

/** Checks what the app sent; returns the cleaned text for each master field, or the problems by app field name. */
function cleanChanges(input: Record<string, unknown>): { ok: true; set: Record<string, string> } | { ok: false; fields: Record<string, string> } {
  const set: Record<string, string> = {};
  const fields: Record<string, string> = {};
  for (const [key, col] of Object.entries(EDITABLE)) {
    if (!(key in input)) continue;
    const raw = input[key];
    let v = raw === null || raw === undefined ? "" : String(raw).trim().replace(/\s+/g, " ");
    if (key === "gstin" || key === "pan") v = v.toUpperCase();
    const bad = (m: string) => (fields[key] = m);
    if (v.length > 300) bad("That is too long.");
    else if (key === "phone") {
      v = v.replace(/\D/g, "").slice(-10);
      if (!/^[6-9]\d{9}$/.test(v)) bad("Enter a valid 10-digit mobile number.");
    } else if (key === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) bad("Enter a valid e-mail address.");
    else if (key === "pincode" && v && !/^\d{6}$/.test(v)) bad("Pincode must be 6 digits.");
    else if (key === "gstin" && v && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(v)) bad("GSTIN should be 15 characters, like 22AAAAA0000A1Z5.");
    else if (key === "pan" && v && !/^[A-Z]{5}\d{4}[A-Z]$/.test(v)) bad("PAN should be 10 characters, like ABCDE1234F.");
    else if ((key === "lat" || key === "lng") && v && !(Number.isFinite(Number(v)) && Math.abs(Number(v)) <= (key === "lat" ? 90 : 180))) bad("Not a valid location.");
    set[col] = v;
  }
  if (!Object.keys(set).length && !Object.keys(fields).length) fields.form = "Nothing to change.";
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, set };
}

export type SaveFirmResult = { ok: true; firm: DistFirm; login: { kind: string; name: string; phone: string } } | { ok: false; error: string; fields?: Record<string, string> };

/**
 * Saves a distributor's details through the Customer Masters' own save (same checks, same history,
 * same parent links), so a change made in the app lands exactly where the office would have put it.
 * A distributor edits its own firm; a sales officer the firms he may order for.
 */
export async function saveFirmDetails(login: DistLogin, firmUid: string | undefined, input: Record<string, unknown>): Promise<SaveFirmResult> {
  const firm = await firmAllowed(login, firmUid);
  if (!firm) return { ok: false, error: "Choose the distributor first." };
  const cleaned = cleanChanges(input);
  if (!cleaned.ok) return { ok: false, error: Object.values(cleaned.fields)[0], fields: cleaned.fields };

  const def = MASTERS.distribution;
  const current = await loadRecord(def, firm.uid);
  if (!current) return { ok: false, error: "This distributor no longer exists." };
  // the whole row goes in so the screen's rules see every value; only the changed fields are written
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...current, ...cleaned.set })) form.set(k, v ?? "");

  const who = `${login.kind === "salesman" ? "Sales officer" : login.kind === "retailer" ? "Retailer" : "Distributor"} ${login.name} (Gaia app)`;
  const r = await saveRecord(def, firm.uid, form, who, { only: Object.keys(cleaned.set), from: "Gaia app" });
  if (!r.ok) {
    const back = Object.fromEntries(Object.entries(EDITABLE).map(([k, col]) => [col, k]));
    const fields = Object.fromEntries(Object.entries(r.fieldErrors ?? {}).map(([c, m]) => [back[c] ?? c, m]));
    return { ok: false, error: Object.values(fields)[0] ?? r.error, fields };
  }
  const fresh = await query<DistFirm>(`${FIRM_SELECT} where f.uid = $1`, [firm.uid]);
  const me = await one<DistLogin>(`${LOGIN_SELECT} where l.id = $1`, [login.id]);
  return { ok: true, firm: fresh[0], login: { kind: login.kind, name: me?.name ?? login.name, phone: me?.phone ?? login.phone } };
}

/**
 * Gives every distributor (level 3 - active or not) and every active employee that has no app login one, on their
 * registered mobile number with a random 6-digit PIN. The PINs are stored hashed, so the returned CSV is the only
 * time they can be handed out. Numbers missing, invalid or already used are skipped and listed.
 */
export async function createMissingDistLogins(only?: DistLogin["kind"]): Promise<{ csv: string; created: number; skipped: string[] }> {
  const everyone = await query<{ kind: DistLogin["kind"]; uid: string; name: string; code: string | null; phone: string | null; status: string }>(
    `select 'distributor' as kind, f.uid, f.name, f.firm_code as code, f.phone, case when f.active = 1 then 'Active' else 'Inactive' end as status
       from fp_firm f join fp_channel c on c.uid = f.channel_uid
       where c.level = 3 and not exists (select 1 from dist_login l where l.firm_uid = f.uid)
     union all
     select 'retailer', f.uid, f.name, f.firm_code, f.phone, case when f.active = 1 then 'Active' else 'Inactive' end
       from fp_firm f join fp_channel c on c.uid = f.channel_uid
       where c.channel_code = 'RT' and not exists (select 1 from dist_login l where l.firm_uid = f.uid)
     union all
     select 'salesman', s.uid, trim(concat_ws(' ', s.first_name, s.last_name)), s.employee_code, s.phone, 'Active'
       from fp_staff s where s.active = 1 and not exists (select 1 from dist_login l where l.staff_uid = s.uid)
     order by 1, 3`,
  );
  const people = everyone.filter((p) => !only || p.kind === only);
  const taken = new Set((await query<{ phone: string }>(`select phone from dist_login`)).map((r) => r.phone));
  const rows: string[] = ["Type,Name,Code,Customer status,Mobile,PIN"];
  const skipped: string[] = [];
  let created = 0;
  for (const p of people) {
    const phone = (p.phone ?? "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) { skipped.push(`${p.name} (${p.code ?? "-"}, ${p.status}): no valid mobile number`); continue; }
    if (taken.has(phone)) { skipped.push(`${p.name} (${p.code ?? "-"}, ${p.status}): ${phone} is already used by another login`); continue; }
    const pin = String(randomInt(100000, 1000000));
    await query(
      `insert into dist_login (kind, firm_uid, staff_uid, phone, pin_hash) values ($1, $2, $3, $4, $5)`,
      [p.kind, p.kind !== "salesman" ? p.uid : null, p.kind === "salesman" ? p.uid : null, phone, hashPin(pin)],
    );
    taken.add(phone);
    created++;
    rows.push([p.kind === "distributor" ? "Distributor" : p.kind === "retailer" ? "Retailer" : "Sales officer", p.name, p.code ?? "", p.status, phone, pin].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  return { csv: rows.join("\r\n"), created, skipped };
}
