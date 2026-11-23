import "server-only";
import { one, query } from "@/lib/db";
import { appCatalog } from "@/lib/products/app-products";
import { deliveryFor } from "./pricing";
import { applyOffers, isLive, normaliseCode, type Audience, type CartItem, type GiftProduct, type Offer, type Quote } from "./offers-engine";
import type { ShopProduct } from "./catalog";

const COLS = `id, title, badge, description, kind, applies_to as "appliesTo", skus, categories,
  percent::float as percent, amount::float as amount, max_discount::float as "maxDiscount", buy_qty as "buyQty",
  free_sku as "freeSku", free_qty as "freeQty", repeat, min_qty as "minQty", min_amount::float as "minAmount", code,
  first_order_only as "firstOrderOnly", per_customer_limit as "perCustomerLimit", total_limit as "totalLimit",
  to_char(starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "startsAt",
  to_char(ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "endsAt", active, show_in_app as "showInApp", priority, audience`;

/** Which app's offers: the D2C app's, or the Gaia Distributors app's (distributors, retailers, both). */
export type MarketingApp = "d2c" | "partners";
const OF_APP = (app: MarketingApp) => (app === "d2c" ? `audience = 'd2c'` : `audience <> 'd2c'`);

/** Every offer of one app, switched off or not (for the Dashboard). */
export const allOffers = (app: MarketingApp = "d2c") =>
  query<Offer>(`select ${COLS} from shop_offer where ${OF_APP(app)} order by active desc, priority desc, id desc`);

export const getOffer = (id: number) => one<Offer>(`select ${COLS} from shop_offer where id = $1`, [id]);

/** The offers for [audiences] that could apply now: on, and inside their dates. */
export const runningOffers = (audiences: Audience[] = ["d2c"]) =>
  query<Offer>(
    `select ${COLS} from shop_offer where active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()) and audience = any($1)`,
    [audiences],
  );

/** Orders that count towards an offer's limits: every one that was not cancelled or left unpaid. */
const COUNTED = `o.status not in ('cancelled', 'awaiting_payment')`;

async function usage(customerId: number | null, phone: string | null) {
  const total = await query<{ offer_id: number; n: number }>(
    `select x.offer_id, count(*)::int as n from shop_order_offer x join shop_order o on o.id = x.order_id where ${COUNTED} group by 1`,
  );
  const mine = customerId || phone
    ? await query<{ offer_id: number; n: number }>(
        `select x.offer_id, count(*)::int as n from shop_order_offer x join shop_order o on o.id = x.order_id
          where ${COUNTED} and (o.customer_id = $1 or o.phone = $2) group by 1`,
        [customerId, phone],
      )
    : [];
  const first = customerId || phone
    ? !(await one(`select 1 from shop_order o where (o.customer_id = $1 or o.phone = $2) and ${COUNTED} limit 1`, [customerId, phone]))
    : true;
  return { usedTotal: new Map(total.map((r) => [r.offer_id, r.n])), usedByCustomer: new Map(mine.map((r) => [r.offer_id, r.n])), firstOrder: first };
}

export interface PricedCart extends Quote {
  /** after discounts */
  itemsTotal: number;
  deliveryFee: number;
  total: number;
  /** what the free items would have cost */
  freeWorth: number;
  savings: number;
  /** SKUs in the request that are not on sale */
  unavailable: string[];
}

/**
 * The cart as the server prices it: today's prices, every offer that applies, delivery. This is what the
 * order is placed at, and what the app shows at the cart and checkout.
 */
export async function priceCart(
  lines: Array<{ sku: string; qty: number }>,
  opts: { customerId?: number | null; phone?: string | null; code?: string | null; rule: { fee: number; freeAbove: number }; prices?: Map<string, ShopProduct> },
): Promise<PricedCart> {
  const offers = await runningOffers();
  // the gifts are priced together with the cart, so a gift that is not on sale is never given
  const giftSkus = offers.map((o) => o.freeSku).filter((s): s is string => !!s);
  const want = [...new Set([...lines.map((l) => l.sku), ...giftSkus])];
  const products = opts.prices ?? new Map((await appCatalog("d2c", want)).map((p) => [p.sku, p]));
  if (opts.prices) {
    const missing = giftSkus.filter((s) => !products.has(s));
    if (missing.length) for (const p of await appCatalog("d2c", missing)) products.set(p.sku, p);
  }
  const cart: CartItem[] = [];
  const unavailable: string[] = [];
  for (const l of lines) {
    const p = products.get(l.sku);
    if (!p) unavailable.push(l.sku);
    else cart.push({ sku: p.sku, name: p.size ? `${p.name} ${p.size}` : p.name, category: p.category, price: p.price, qty: l.qty, image: p.image });
  }
  // a product given free also counts when its own SKU is the one bought ("buy 2 get 1 free")
  const gifts = new Map<string, GiftProduct>();
  for (const p of products.values()) gifts.set(p.sku, { sku: p.sku, name: p.size ? `${p.name} ${p.size}` : p.name, price: p.price, image: p.image });

  const u = await usage(opts.customerId ?? null, opts.phone ?? null);
  const q = applyOffers(cart, offers, { now: new Date(), code: opts.code, gifts, ...u });
  const itemsTotal = Math.round((q.subtotal - q.discount) * 100) / 100;
  const deliveryFee = deliveryFor(itemsTotal, opts.rule);
  const freeWorth = Math.round(q.free.reduce((s, f) => s + f.worth * f.qty, 0) * 100) / 100;
  return { ...q, itemsTotal, deliveryFee, total: Math.round((itemsTotal + deliveryFee) * 100) / 100, freeWorth, savings: Math.round((q.discount + freeWorth) * 100) / 100, unavailable };
}

/** The live offers an app shows (badges, the offers strip): no limits checked, those need the customer. */
export async function appOffers(audiences: Audience[] = ["d2c"]) {
  const now = new Date();
  const offers = (await runningOffers(audiences)).filter((o) => o.showInApp && isLive(o, now));
  return offers
    .sort((a, b) => b.priority - a.priority || a.id - b.id)
    .map((o) => ({
      id: o.id,
      title: o.title,
      badge: o.badge,
      description: o.description,
      kind: o.kind,
      appliesTo: o.appliesTo,
      skus: o.skus,
      categories: o.categories,
      percent: o.percent,
      amount: o.amount,
      maxDiscount: o.maxDiscount,
      buyQty: o.buyQty,
      freeSku: o.freeSku,
      freeQty: o.freeQty,
      minQty: o.minQty,
      minAmount: o.minAmount,
      code: o.code,
      firstOrderOnly: o.firstOrderOnly,
      endsAt: o.endsAt,
    }));
}

/** Partner orders that count towards an offer: not cancelled. */
const DIST_COUNTED = `b.status is distinct from 'Cancelled'`;

/** How much each offer of [app] has been used (orders not cancelled), for the Dashboard. */
export const offerStats = (app: MarketingApp = "d2c") =>
  query<{ offer_id: number; orders: number; discount: number; free_units: number; last_used: string | null }>(
    app === "d2c"
      ? `select x.offer_id, count(*)::int as orders, coalesce(sum(x.discount), 0)::float as discount, coalesce(sum(x.free_units), 0)::int as free_units,
                to_char(max(o.created_at) at time zone 'Asia/Kolkata', 'DD Mon') as last_used
           from shop_order_offer x join shop_order o on o.id = x.order_id where ${COUNTED} group by 1`
      : `select x.offer_id, count(*)::int as orders, coalesce(sum(x.discount), 0)::float as discount, coalesce(sum(x.free_units), 0)::int as free_units,
                to_char(max(b.booking_time) at time zone 'Asia/Kolkata', 'DD Mon') as last_used
           from dist_order_offer x join fp_booking_order b on b.uid = x.order_uid where ${DIST_COUNTED} group by 1`,
  );

/** Orders of [app] that used at least one offer (not cancelled). */
export const ordersWithOffers = async (app: MarketingApp = "d2c") =>
  (await one<{ n: number }>(
    app === "d2c"
      ? `select count(distinct x.order_id)::int as n from shop_order_offer x join shop_order o on o.id = x.order_id where ${COUNTED}`
      : `select count(distinct x.order_uid)::int as n from dist_order_offer x join fp_booking_order b on b.uid = x.order_uid where ${DIST_COUNTED}`,
  ))?.n ?? 0;

export { normaliseCode };
