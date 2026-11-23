/**
 * The offers engine: given a cart (at the prices the server holds) and the offers that exist, works out every
 * discount and free item. Pure - no database - so the order code, the app's cart quote and the Dashboard's
 * preview all get exactly the same answer.
 *
 * Rules, in order:
 *  1. An offer counts only when it is on, inside its dates, under its limits, first-order-only is met, and -
 *     if it has a code - the customer entered that code.
 *  2. Its conditions (minimum quantity / amount) are measured on what it applies to.
 *  3. Item offers (% or ₹ off chosen products / categories): each line gets the single best one.
 *  4. Cart offers (% or ₹ off the whole order): the single best one, on what is left after item offers.
 *  5. Free-item offers: every one that qualifies adds its free items.
 */

export type OfferKind = "percent" | "flat" | "free_item";
export type OfferScope = "cart" | "products" | "categories";

export interface Offer {
  id: number;
  title: string;
  badge: string | null;
  description: string | null;
  kind: OfferKind;
  appliesTo: OfferScope;
  skus: string[];
  categories: string[];
  percent: number | null;
  amount: number | null;
  maxDiscount: number | null;
  buyQty: number | null;
  /** null: the same product as the one bought */
  freeSku: string | null;
  freeQty: number | null;
  repeat: boolean;
  minQty: number;
  minAmount: number;
  code: string | null;
  firstOrderOnly: boolean;
  perCustomerLimit: number | null;
  totalLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  showInApp: boolean;
  priority: number;
  /** which app: 'd2c', or the Gaia Distributors app - 'distributor', 'retailer', 'partners' (both) */
  audience?: Audience;
}

export type Audience = "d2c" | "distributor" | "retailer" | "partners";

export interface CartItem {
  sku: string;
  name: string;
  category: string;
  price: number;
  qty: number;
  image: string | null;
}

/** What the engine knows about a product it may give away. */
export interface GiftProduct {
  sku: string;
  name: string;
  price: number;
  image: string | null;
}

export interface OfferContext {
  now: Date;
  /** The code the customer typed, if any (any case). */
  code?: string | null;
  /** The customer has no earlier order (that was not cancelled). */
  firstOrder: boolean;
  /** Orders that already used each offer: this customer's, and everyone's. */
  usedByCustomer: Map<number, number>;
  usedTotal: Map<number, number>;
  /** Products that can be given free (on sale now), by SKU. */
  gifts: Map<string, GiftProduct>;
}

export interface QuotedLine extends CartItem {
  gross: number;
  discount: number;
  /** what the customer pays for this line */
  total: number;
  offerId: number | null;
  offerTitle: string | null;
}

export interface FreeLine {
  sku: string;
  name: string;
  image: string | null;
  qty: number;
  /** its normal price, to show what the gift is worth */
  worth: number;
  offerId: number;
  offerTitle: string;
}

export interface AppliedOffer {
  id: number;
  title: string;
  discount: number;
  freeUnits: number;
}

export type CodeStatus = "none" | "applied" | "invalid" | "not_eligible";

export interface Quote {
  lines: QuotedLine[];
  free: FreeLine[];
  applied: AppliedOffer[];
  subtotal: number;
  itemDiscount: number;
  cartDiscount: number;
  cartOfferTitle: string | null;
  cartOfferId: number | null;
  discount: number;
  code: string | null;
  codeStatus: CodeStatus;
  codeMessage: string | null;
  /** Nudges: "Add 1 more Paneer to get 1 Dahi free". */
  hints: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const lower = (s: string) => s.trim().toLowerCase();
export const normaliseCode = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);

/** Why an offer cannot be used right now, or null if it can (conditions on the cart aside). */
export function blockedReason(o: Offer, ctx: OfferContext): string | null {
  if (!o.active) return "This offer is not running.";
  const t = ctx.now.getTime();
  if (o.startsAt && new Date(o.startsAt).getTime() > t) return "This offer has not started yet.";
  if (o.endsAt && new Date(o.endsAt).getTime() <= t) return "This offer has ended.";
  if (o.totalLimit != null && (ctx.usedTotal.get(o.id) ?? 0) >= o.totalLimit) return "This offer has been fully used.";
  if (o.perCustomerLimit != null && (ctx.usedByCustomer.get(o.id) ?? 0) >= o.perCustomerLimit)
    return o.perCustomerLimit === 1 ? "You have already used this offer." : `You have already used this offer ${o.perCustomerLimit} times.`;
  if (o.firstOrderOnly && !ctx.firstOrder) return "This offer is for your first order only.";
  return null;
}

/** Is the offer inside its dates and switched on (for showing it, before any customer is known). */
export const isLive = (o: Offer, now: Date) =>
  o.active && (!o.startsAt || new Date(o.startsAt) <= now) && (!o.endsAt || new Date(o.endsAt) > now);

/** The cart lines an offer applies to. */
export function qualifying(o: Offer, lines: CartItem[]): CartItem[] {
  if (o.appliesTo === "cart") return lines;
  if (o.appliesTo === "products") {
    const s = new Set(o.skus);
    return lines.filter((l) => s.has(l.sku));
  }
  const c = new Set(o.categories.map(lower));
  return lines.filter((l) => c.has(lower(l.category)));
}

/** Does a product fall under the offer (for badges on product cards)? */
export function covers(o: Offer, p: { sku: string; category: string }): boolean {
  if (o.appliesTo === "products") return o.skus.includes(p.sku);
  if (o.appliesTo === "categories") return o.categories.some((c) => lower(c) === lower(p.category));
  return false;
}

/** The free units an offer gives for these lines: [sku, qty][] (before checking the gift is on sale). */
function giftsFor(o: Offer, q: CartItem[]): Array<[string, number]> {
  const free = o.freeQty ?? 1;
  if (o.appliesTo === "cart") return o.freeSku ? [[o.freeSku, free]] : [];
  const buy = o.buyQty ?? 1;
  const times = (units: number) => (o.repeat ? Math.floor(units / buy) : units >= buy ? 1 : 0);
  if (!o.freeSku) return q.map((l) => [l.sku, times(l.qty) * free] as [string, number]).filter(([, n]) => n > 0);
  const n = times(q.reduce((s, l) => s + l.qty, 0)) * free;
  return n > 0 ? [[o.freeSku, n]] : [];
}

/** "Paneer" / "these items": how the hint names what to add. */
function scopeName(o: Offer, q: CartItem[]): string {
  if (o.appliesTo === "products" && o.skus.length === 1) return q[0]?.name ?? "of this item";
  if (o.appliesTo === "categories" && o.categories.length === 1) return o.categories[0];
  return "eligible items";
}

const rupee = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function applyOffers(cart: CartItem[], offers: Offer[], ctx: OfferContext): Quote {
  const code = normaliseCode(ctx.code) || null;
  const lines: QuotedLine[] = cart.map((l) => {
    const gross = r2(l.price * l.qty);
    return { ...l, gross, discount: 0, total: gross, offerId: null, offerTitle: null };
  });
  const subtotal = r2(lines.reduce((s, l) => s + l.gross, 0));
  const hints: string[] = [];
  const usable: Offer[] = [];
  let codeOffer: Offer | null = null;
  let codeMessage: string | null = null;

  for (const o of [...offers].sort((a, b) => b.priority - a.priority || a.id - b.id)) {
    if (o.code) {
      if (o.code !== code) continue;
      codeOffer = o;
    }
    const why = blockedReason(o, ctx);
    if (why) {
      if (o === codeOffer) codeMessage = why;
      continue;
    }
    const q = qualifying(o, cart);
    const units = q.reduce((s, l) => s + l.qty, 0);
    const amount = r2(q.reduce((s, l) => s + l.price * l.qty, 0));
    if (!q.length || units < o.minQty || amount < o.minAmount) {
      let hint: string | null = null;
      if (o.minAmount > amount && (amount > 0 || o.appliesTo === "cart") && subtotal > 0)
        hint = `Add ${rupee(r2(o.minAmount - amount))} more${o.appliesTo === "cart" ? "" : ` of ${scopeName(o, q)}`} to get ${o.title}`;
      else if (o.minQty > units && units > 0) hint = `Add ${o.minQty - units} more ${scopeName(o, q)} to get ${o.title}`;
      if (hint && !o.code) hints.push(hint);
      if (o === codeOffer) codeMessage = o.minAmount > amount
        ? `Add ${rupee(r2(o.minAmount - amount))} more${o.appliesTo === "cart" ? "" : " of the eligible items"} to use this code.`
        : q.length ? `Add ${o.minQty - units} more eligible ${o.minQty - units === 1 ? "item" : "items"} to use this code.` : "Your cart has no items this code applies to.";
      continue;
    }
    usable.push(o);
  }

  const applied = new Map<number, AppliedOffer>();
  const credit = (o: Offer, discount: number, freeUnits: number) => {
    const a = applied.get(o.id) ?? { id: o.id, title: o.title, discount: 0, freeUnits: 0 };
    a.discount = r2(a.discount + discount);
    a.freeUnits += freeUnits;
    applied.set(o.id, a);
  };

  // 3. item offers: the best one for each line (a capped % offer is scaled down across its lines)
  const itemOffers = usable.filter((o) => o.kind !== "free_item" && o.appliesTo !== "cart");
  const lineValue = (o: Offer, l: QuotedLine) => (o.kind === "percent" ? (l.gross * (o.percent ?? 0)) / 100 : Math.min(l.gross, (o.amount ?? 0) * l.qty));
  const best = new Map<number, Offer>();
  for (const l of lines) {
    let top: Offer | null = null;
    let topV = 0;
    for (const o of itemOffers) {
      if (!covers(o, l)) continue;
      const v = lineValue(o, l);
      if (v > topV + 1e-9) [top, topV] = [o, v];
    }
    if (top) best.set(lines.indexOf(l), top);
  }
  for (const o of itemOffers) {
    const idx = [...best].filter(([, b]) => b === o).map(([i]) => i);
    if (!idx.length) continue;
    const raw = idx.map((i) => lineValue(o, lines[i]));
    const sum = raw.reduce((s, v) => s + v, 0);
    const scale = o.maxDiscount != null && sum > o.maxDiscount ? o.maxDiscount / sum : 1;
    idx.forEach((i, k) => {
      const d = r2(raw[k] * scale);
      lines[i].discount = d;
      lines[i].total = r2(lines[i].gross - d);
      lines[i].offerId = o.id;
      lines[i].offerTitle = o.title;
      credit(o, d, 0);
    });
  }
  const itemDiscount = r2(lines.reduce((s, l) => s + l.discount, 0));

  // 4. cart offers: the best one, on what is left
  const left = r2(subtotal - itemDiscount);
  let cartDiscount = 0;
  let cartOffer: Offer | null = null;
  for (const o of usable.filter((x) => x.kind !== "free_item" && x.appliesTo === "cart")) {
    let v = o.kind === "percent" ? (left * (o.percent ?? 0)) / 100 : Math.min(left, o.amount ?? 0);
    if (o.maxDiscount != null) v = Math.min(v, o.maxDiscount);
    v = r2(v);
    if (v > cartDiscount) [cartDiscount, cartOffer] = [v, o];
  }
  if (cartOffer) credit(cartOffer, cartDiscount, 0);

  // 5. free items: every free-item offer that qualifies
  const free: FreeLine[] = [];
  for (const o of usable.filter((x) => x.kind === "free_item")) {
    const q = qualifying(o, cart);
    const got = giftsFor(o, q);
    let units = 0;
    for (const [sku, n] of got) {
      const g = ctx.gifts.get(sku);
      if (!g || n <= 0) continue;
      const same = free.find((f) => f.sku === sku && f.offerId === o.id);
      if (same) same.qty += n;
      else free.push({ sku, name: g.name, image: g.image, qty: n, worth: g.price, offerId: o.id, offerTitle: o.title });
      units += n;
    }
    if (units) credit(o, 0, units);
    // nudge towards the first free item (not for codes: they are not advertised by the cart)
    if (!units && !o.code && o.buyQty && o.appliesTo !== "cart") {
      const have = o.freeSku ? q.reduce((s, l) => s + l.qty, 0) : Math.max(0, ...q.map((l) => l.qty));
      if (have > 0 && have < o.buyQty) hints.push(`Add ${o.buyQty - have} more ${scopeName(o, q)} to get ${o.title}`);
    }
  }
  // the free-item offers whose units could not all be met (e.g. a gift that is out of stock) give nothing silently

  // the code: did it do anything?
  let codeStatus: CodeStatus = "none";
  if (code) {
    if (!codeOffer) {
      codeStatus = "invalid";
      codeMessage = "This code is not valid.";
    } else if (applied.has(codeOffer.id) && (applied.get(codeOffer.id)!.discount > 0 || applied.get(codeOffer.id)!.freeUnits > 0)) {
      codeStatus = "applied";
      codeMessage = null;
    } else {
      codeStatus = "not_eligible";
      codeMessage ??= codeOffer.kind === "free_item"
        ? "The free item for this code is not available right now."
        : "Your cart already has a better offer on these items.";
    }
  }

  const discount = Math.min(subtotal, r2(itemDiscount + cartDiscount));
  return {
    lines,
    free,
    applied: [...applied.values()].filter((a) => a.discount > 0 || a.freeUnits > 0),
    subtotal,
    itemDiscount,
    cartDiscount,
    cartOfferTitle: cartOffer?.title ?? null,
    cartOfferId: cartOffer?.id ?? null,
    discount,
    code: codeStatus === "applied" ? code : null,
    codeStatus,
    codeMessage,
    hints: [...new Set(hints)].slice(0, 3),
  };
}

/** One line in plain words, for the Dashboard list and the app: "20% off Paneer, up to ₹100". */
export function describeOffer(o: Pick<Offer, "kind" | "appliesTo" | "percent" | "amount" | "maxDiscount" | "buyQty" | "freeQty" | "repeat" | "minAmount" | "minQty">, names: { scope: string; gift: string }): string {
  const what = o.appliesTo === "cart" ? "your order" : names.scope;
  const cond = [o.minAmount > 0 ? `on ${rupee(o.minAmount)}+` : "", o.minQty > 0 ? `when you buy ${o.minQty}+` : ""].filter(Boolean).join(", ");
  let s: string;
  const pct = o.percent ? `${o.percent}%` : "…%";
  const amt = o.amount ? rupee(o.amount) : "₹…";
  if (o.kind === "percent") s = `${pct} off ${what}${o.maxDiscount ? `, up to ${rupee(o.maxDiscount)}` : ""}`;
  else if (o.kind === "flat") s = o.appliesTo === "cart" ? `${amt} off your order` : `${amt} off each ${what}`;
  else if (o.appliesTo === "cart") s = `${o.freeQty ?? 1} ${names.gift} free with your order`;
  else s = `Buy ${o.buyQty ?? 1} ${what}, get ${o.freeQty ?? 1} ${names.gift} free${o.repeat ? "" : " (once per order)"}`;
  return cond ? `${s} ${cond}` : s;
}
