import "server-only";
import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { listAllProducts } from "@/lib/shop/catalog";
import { applyOffers, type AppliedOffer, type Audience, type CartItem, type CodeStatus, type GiftProduct, type Offer } from "@/lib/shop/offers-engine";
import { firmPrices, type PricedLine } from "./index";

/**
 * Offers on Gaia Distributors app orders (Dashboard: Distributor & Retail > Marketing > Offers; db/122).
 *
 * The same offers engine as the D2C app (src/lib/shop/offers-engine.ts), priced INTO the order lines so the GST
 * invoice, the route-sheet bill and the Tally file - which all read a line's selling_price - carry the discount
 * with no change of their own:
 *   - a discounted line keeps dp = the list price; selling_price = what is paid per piece; total_cost = qty x that;
 *     scheme_discount = the line's rupees off. A whole-order discount is spread over the lines by value.
 *   - a free item is a line of its own at 0 (scheme_details.free = true).
 * The header's total_cost / dealer_cost is the net, scheme_discount the rupees off, scheme_details the offers and
 * code; dist_order_offer records which offers the order used (limits, stats).
 */

export type Channel = "retail" | "distributor";
/** A retail party gets retailer + both; anyone else distributor + both. */
export const audiencesFor = (channel: Channel): Audience[] => (channel === "retail" ? ["retailer", "partners"] : ["distributor", "partners"]);

const r2 = (n: number) => Math.round(n * 100) / 100;
/** a price per piece to the hundredth of a paisa, so qty x rate stays within paise of the discounted line */
const r4 = (n: number) => Math.round(n * 10000) / 10000;

const COLS = `id, title, badge, description, kind, applies_to as "appliesTo", skus, categories,
  percent::float as percent, amount::float as amount, max_discount::float as "maxDiscount", buy_qty as "buyQty",
  free_sku as "freeSku", free_qty as "freeQty", repeat, min_qty as "minQty", min_amount::float as "minAmount", code,
  first_order_only as "firstOrderOnly", per_customer_limit as "perCustomerLimit", total_limit as "totalLimit",
  to_char(starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "startsAt",
  to_char(ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "endsAt", active, show_in_app as "showInApp", priority, audience`;

export interface OfferLine extends PricedLine {
  name: string;
  /** what is paid per piece (dp less its share of the discount); 0 for a free item */
  rate: number;
  /** qty x rate */
  total: number;
  /** rupees off this line */
  discount: number;
  free: boolean;
  offerId: number | null;
  offerTitle: string | null;
}

export interface PartnerQuote {
  lines: OfferLine[];
  applied: AppliedOffer[];
  /** the lines at the list price */
  gross: number;
  discount: number;
  /** what the order costs: the sum of its lines */
  total: number;
  /** what the free items would have cost */
  freeWorth: number;
  code: string | null;
  codeStatus: CodeStatus;
  codeMessage: string | null;
  hints: string[];
}

/**
 * The offers that apply to an order of [channel]: running now; or, for an order being changed, the ones it was
 * placed under - running at its booking time, plus the ones it actually got (even if switched off or ended since),
 * so a later edit never loses a discount the buyer was given.
 */
async function offersFor(channel: Channel, placed?: { at: Date; uid: string }): Promise<{ offers: Offer[]; now: Date }> {
  if (!placed) {
    const offers = await query<Offer>(
      `select ${COLS} from shop_offer where active and audience = any($1) and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())`,
      [audiencesFor(channel)],
    );
    return { offers, now: new Date() };
  }
  const offers = await query<Offer>(
    `select ${COLS} from shop_offer o
      where audience = any($1)
        and (o.id in (select offer_id from dist_order_offer where order_uid = $3)
             or (o.active and o.created_at <= $2 and (o.starts_at is null or o.starts_at <= $2) and (o.ends_at is null or o.ends_at > $2)))`,
    [audiencesFor(channel), placed.at, placed.uid],
  );
  // judged as at the booking time, and the ones it got count as on
  return { offers: offers.map((o) => ({ ...o, active: true, startsAt: null, endsAt: null })), now: placed.at };
}

/** Usage for the limits: this firm's orders and everyone's (cancelled ones and [except] left out). */
async function usage(firmUid: string, except: string | null) {
  const counted = `b.status is distinct from 'Cancelled' and b.uid is distinct from $2::uuid`;
  const total = await query<{ offer_id: number; n: number }>(
    `select x.offer_id, count(*)::int as n from dist_order_offer x join fp_booking_order b on b.uid = x.order_uid where ${counted} and $1::text is not null group by 1`,
    [firmUid, except],
  );
  const mine = await query<{ offer_id: number; n: number }>(
    `select x.offer_id, count(*)::int as n from dist_order_offer x join fp_booking_order b on b.uid = x.order_uid where ${counted} and b.from_firm_uid = $1 group by 1`,
    [firmUid, except],
  );
  const earlier = await query(
    `select 1 from fp_booking_order b where b.from_firm_uid = $1 and ${counted} limit 1`,
    [firmUid, except],
  );
  return { usedTotal: new Map(total.map((r) => [r.offer_id, r.n])), usedByCustomer: new Map(mine.map((r) => [r.offer_id, r.n])), firstOrder: earlier.length === 0 };
}

/**
 * Prices [lines] (already priced at the firm's list price by priceDistLines) with the partner offers that apply.
 * [placed]: the order being changed (its booking time and uid), so it keeps the offers it was placed under and its own
 * use does not count against the limits.
 */
export async function priceWithOffers(
  channel: Channel, firmUid: string, lines: PricedLine[], code: string | null, placed?: { at: Date; uid: string },
): Promise<PartnerQuote> {
  const [{ offers, now }, listed] = await Promise.all([offersFor(channel, placed), listAllProducts(channel)]);
  const info = new Map(listed.map((p) => [p.sku, p]));
  const nameOf = (sku: string) => {
    const p = info.get(sku);
    return p ? (p.size ? `${p.name} ${p.size}` : p.name) : sku;
  };

  // gifts: what this firm can be given - on its app list and priced for it
  const giftSkus = [...new Set(offers.map((o) => o.freeSku).filter((s): s is string => !!s))];
  const giftPrice = new Map((await firmPrices(firmUid, [...new Set([...giftSkus, ...lines.map((l) => l.sku)])])).map((p) => [p.sku, p.price]));
  const gifts = new Map<string, GiftProduct>();
  for (const sku of new Set([...giftSkus, ...lines.map((l) => l.sku)])) {
    const price = giftPrice.get(sku);
    if (price && price > 0 && info.has(sku)) gifts.set(sku, { sku, name: nameOf(sku), price, image: info.get(sku)?.image ?? null });
  }

  const cart: CartItem[] = lines.map((l) => ({ sku: l.sku, name: nameOf(l.sku), category: info.get(l.sku)?.category ?? "", price: l.dp, qty: l.qty, image: null }));
  const q = applyOffers(cart, offers, { now, code, gifts, ...(await usage(firmUid, placed?.uid ?? null)) });

  // the whole-order discount spread over the lines by what they cost after their own discount
  const afterItem = q.lines.map((l) => l.total);
  const base = afterItem.reduce((s, x) => s + x, 0);
  const share = afterItem.map((x) => (base > 0 ? (q.cartDiscount * x) / base : 0));
  const out: OfferLine[] = lines.map((l, i) => {
    const net = Math.max(0, afterItem[i] - share[i]);
    const rate = r4(net / l.qty);
    const total = r2(rate * l.qty);
    const ql = q.lines[i];
    const cart = share[i] > 0;
    return {
      ...l, name: nameOf(l.sku), rate, total, discount: r2(l.qty * l.dp - total), free: false,
      offerId: ql.offerId ?? (cart ? q.cartOfferId : null),
      offerTitle: ql.offerTitle ?? (cart ? q.cartOfferTitle : null),
    };
  });

  // free items: their own lines at 0
  if (q.free.length) {
    const prods = new Map((await query<{ uid: string; sku: string; mrp: number }>(
      `select uid, sku_code as sku, mrp::float as mrp from fp_product where sku_code = any($1) and active = 1`, [q.free.map((f) => f.sku)],
    )).map((p) => [p.sku, p]));
    for (const f of q.free) {
      const p = prods.get(f.sku);
      if (!p) continue;
      out.push({ uid: p.uid, sku: f.sku, mrp: Number(p.mrp), dp: gifts.get(f.sku)?.price ?? f.worth, qty: f.qty, units: null, name: nameOf(f.sku), rate: 0, total: 0, discount: 0, free: true, offerId: f.offerId, offerTitle: f.offerTitle });
    }
  }

  const gross = r2(lines.reduce((s, l) => s + l.qty * l.dp, 0));
  const total = r2(out.reduce((s, l) => s + l.total, 0));
  // what each offer gave (the engine's figures), the paise of rounding put on the biggest, so they add up to the order
  const discount = r2(gross - total);
  const applied = q.applied.map((a) => ({ ...a, freeUnits: out.filter((l) => l.free && l.offerId === a.id).reduce((s, l) => s + l.qty, 0) }))
    .filter((a) => a.discount > 0 || a.freeUnits > 0);
  const biggest = [...applied].sort((a, b) => b.discount - a.discount)[0];
  if (biggest && biggest.discount > 0) biggest.discount = r2(biggest.discount + discount - applied.reduce((s, a) => s + a.discount, 0));
  return {
    lines: out, applied, gross, discount, total,
    freeWorth: r2(out.filter((l) => l.free).reduce((s, l) => s + l.qty * l.dp, 0)),
    code: q.code, codeStatus: q.codeStatus, codeMessage: q.codeMessage, hints: q.hints,
  };
}

/** Writes an order's lines and money as priced (the lines are replaced; the header keeps everything else). */
export async function writeOrderLines(c: PoolClient, uid: string, q: PartnerQuote): Promise<void> {
  await c.query(`delete from fp_booking_order_item where booking_order_uid = $1`, [uid]);
  let n = 0;
  for (const l of q.lines) {
    await c.query(
      `insert into fp_booking_order_item
         (mrp, selling_price, dp, quantity, stock, total_cost, booking_order_uid, product_uid, order_item_number, units, scheme_discount, scheme_details, remark)
       values ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        l.mrp, l.rate, l.dp, l.qty, l.total, uid, l.uid, ++n, l.units ? JSON.stringify(l.units) : null,
        l.discount || null,
        l.free || l.offerId ? JSON.stringify({ free: l.free, offerId: l.offerId, offer: l.offerTitle }) : null,
        l.free ? `Free: ${l.offerTitle ?? "offer"}`.slice(0, 200) : null,
      ],
    );
  }
  await c.query(
    `update fp_booking_order set total_item = $2, total_quantity = $3, total_cost = $4, dealer_cost = $4, scheme_discount = $5, scheme_details = $6,
            modified_time = now(), updated_at = now()
      where uid = $1`,
    [uid, q.lines.length, q.lines.reduce((s, l) => s + l.qty, 0), q.total, q.discount || null,
     q.applied.length || q.code ? JSON.stringify({ code: q.code, offers: q.applied }) : null],
  );
  await c.query(`delete from dist_order_offer where order_uid = $1`, [uid]);
  for (const a of q.applied) {
    await c.query(`insert into dist_order_offer (order_uid, offer_id, title, discount, free_units) values ($1, $2, $3, $4, $5)`, [uid, a.id, a.title, a.discount, a.freeUnits]);
  }
}

/** The code an order was placed with (kept for its edits). */
export async function orderCode(c: PoolClient | null, uid: string): Promise<string | null> {
  const sql = `select scheme_details->>'code' as code from fp_booking_order where uid = $1`;
  const r = c ? (await c.query<{ code: string | null }>(sql, [uid])).rows[0] : (await query<{ code: string | null }>(sql, [uid]))[0];
  return r?.code ?? null;
}
