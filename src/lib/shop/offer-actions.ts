"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { one, query } from "@/lib/db";
import { normaliseCode, type Audience } from "./offers-engine";

const AUDIENCES: Audience[] = ["d2c", "distributor", "retailer", "partners"];
/** Both apps' offer pages see every change (the banner list too). */
function refresh() {
  for (const p of ["/shop-orders/offers", "/app-orders/marketing/offers"]) revalidatePath(p, "layout");
  for (const p of ["/shop-orders/banners", "/app-orders/marketing/banners"]) revalidatePath(p);
}

async function editor() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, "shop"), "edit") ? me : null;
}

const NO = { ok: false as const, error: "You do not have permission to change offers." };
type Result = { ok: true; id?: number } | { ok: false; error: string };

export interface OfferInput {
  title: string;
  badge: string;
  description: string;
  kind: "percent" | "flat" | "free_item";
  appliesTo: "cart" | "products" | "categories";
  skus: string[];
  categories: string[];
  percent: number | null;
  amount: number | null;
  maxDiscount: number | null;
  buyQty: number | null;
  freeSku: string | null;
  freeQty: number | null;
  repeat: boolean;
  minQty: number;
  minAmount: number;
  code: string;
  firstOrderOnly: boolean;
  perCustomerLimit: number | null;
  totalLimit: number | null;
  /** datetime-local values, India time (YYYY-MM-DDTHH:mm) */
  startsAt: string;
  endsAt: string;
  active: boolean;
  showInApp: boolean;
  priority: number;
  /** d2c, or the Gaia Distributors app: distributor / retailer / partners (both) */
  audience: Audience;
}

const pos = (n: number | null, max: number) => n == null || (Number.isFinite(n) && n > 0 && n <= max);
const whole = (n: number | null) => n == null || Number.isInteger(n);
const local = (s: string) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00+05:30` : null);

/** Checks an offer from the form; the database has the same rules as constraints. */
function check(o: OfferInput): string | null {
  if (o.title.trim().length < 2) return "Give the offer a name customers will see.";
  if (o.title.trim().length > 80) return "Keep the name under 80 characters.";
  if (o.badge.trim().length > 24) return "Keep the badge under 24 characters.";
  if (!["percent", "flat", "free_item"].includes(o.kind)) return "Choose the kind of offer.";
  if (!["cart", "products", "categories"].includes(o.appliesTo)) return "Choose what the offer applies to.";
  if (o.appliesTo === "products" && !o.skus.length) return "Pick at least one product.";
  if (o.appliesTo === "categories" && !o.categories.length) return "Pick at least one category.";
  if (o.kind === "percent" && !(o.percent && o.percent > 0 && o.percent <= 100)) return "The discount must be between 1% and 100%.";
  if (o.kind === "flat" && !pos(o.amount, 100000)) return "Enter the rupees off.";
  if (o.kind === "flat" && o.amount == null) return "Enter the rupees off.";
  if (!pos(o.maxDiscount, 100000)) return "The most discount must be more than 0.";
  if (o.kind === "free_item") {
    if (!o.freeQty || !whole(o.freeQty) || o.freeQty < 1 || o.freeQty > 20) return "Free quantity must be 1 to 20.";
    if (o.appliesTo === "cart" && !o.freeSku) return "Pick the product given free with the order.";
    if (o.appliesTo !== "cart" && (!o.buyQty || !whole(o.buyQty) || o.buyQty < 1 || o.buyQty > 100)) return "Enter how many must be bought (1 to 100).";
  }
  if (!whole(o.minQty) || o.minQty < 0 || o.minQty > 1000) return "Minimum quantity must be a whole number.";
  if (!(o.minAmount >= 0 && o.minAmount <= 1000000)) return "Minimum amount must be 0 or more.";
  if (o.code && !/^[A-Z0-9]{3,20}$/.test(o.code)) return "A code is 3 to 20 letters and digits.";
  if (!whole(o.perCustomerLimit) || !pos(o.perCustomerLimit, 1000)) return "Uses per customer must be a whole number.";
  if (!whole(o.totalLimit) || !pos(o.totalLimit, 10000000)) return "Total uses must be a whole number.";
  if (o.startsAt && !local(o.startsAt)) return "Check the start date and time.";
  if (o.endsAt && !local(o.endsAt)) return "Check the end date and time.";
  if (o.startsAt && o.endsAt && o.endsAt <= o.startsAt) return "The offer must end after it starts.";
  if (!whole(o.priority) || Math.abs(o.priority) > 10000) return "Priority must be a whole number.";
  if (!AUDIENCES.includes(o.audience)) return "Choose who the offer is for.";
  return null;
}

export async function saveOfferAction(id: number | null, raw: OfferInput): Promise<Result> {
  const me = await editor();
  if (!me) return NO;
  const o: OfferInput = {
    ...raw,
    title: raw.title.trim(),
    badge: raw.badge.trim().toUpperCase(),
    description: raw.description.trim().slice(0, 500),
    code: normaliseCode(raw.code),
    skus: raw.appliesTo === "products" ? [...new Set(raw.skus)].slice(0, 200) : [],
    categories: raw.appliesTo === "categories" ? [...new Set(raw.categories)].slice(0, 50) : [],
    percent: raw.kind === "percent" ? raw.percent : null,
    amount: raw.kind === "flat" ? raw.amount : null,
    maxDiscount: raw.kind === "percent" ? raw.maxDiscount : null,
    buyQty: raw.kind === "free_item" && raw.appliesTo !== "cart" ? raw.buyQty : null,
    freeSku: raw.kind === "free_item" ? raw.freeSku || null : null,
    freeQty: raw.kind === "free_item" ? raw.freeQty : null,
  };
  const bad = check(o);
  if (bad) return { ok: false, error: bad };

  const known = new Set((await query<{ sku_code: string }>(`select sku_code from fp_product where sku_code = any($1)`, [[...o.skus, ...(o.freeSku ? [o.freeSku] : [])]])).map((r) => r.sku_code));
  if (o.skus.some((s) => !known.has(s)) || (o.freeSku && !known.has(o.freeSku))) return { ok: false, error: "One of the chosen products no longer exists." };
  if (o.code && (await one(`select 1 from shop_offer where code = $1 and id is distinct from $2`, [o.code, id]))) return { ok: false, error: `The code ${o.code} is already used by another offer.` };
  // an offer stays in its app: a D2C offer never becomes a partner one or the other way round
  if (id) {
    const was = await one<{ audience: Audience }>(`select audience from shop_offer where id = $1`, [id]);
    if (was && (was.audience === "d2c") !== (o.audience === "d2c")) return { ok: false, error: "An offer cannot move between the D2C app and the Distributors app." };
  }

  const vals = [
    o.title, o.badge || null, o.description || null, o.kind, o.appliesTo, o.skus, o.categories, o.percent, o.amount, o.maxDiscount,
    o.buyQty, o.freeSku, o.freeQty, o.repeat, o.minQty, o.minAmount, o.code || null, o.firstOrderOnly, o.perCustomerLimit, o.totalLimit,
    local(o.startsAt), local(o.endsAt), o.active, o.showInApp, o.priority, o.audience,
  ];
  const cols = `title, badge, description, kind, applies_to, skus, categories, percent, amount, max_discount, buy_qty, free_sku, free_qty, repeat,
                min_qty, min_amount, code, first_order_only, per_customer_limit, total_limit, starts_at, ends_at, active, show_in_app, priority, audience`;
  let saved: number;
  try {
    if (id) {
      const set = cols.split(",").map((c, i) => `${c.trim()} = $${i + 2}`).join(", ");
      const r = await one<{ id: number }>(`update shop_offer set ${set}, updated_at = now() where id = $1 returning id`, [id, ...vals]);
      if (!r) return { ok: false, error: "That offer no longer exists." };
      saved = r.id;
    } else {
      const r = await one<{ id: number }>(
        `insert into shop_offer (${cols}, created_by) values (${vals.map((_, i) => `$${i + 1}`).join(", ")}, $${vals.length + 1}) returning id`,
        [...vals, me.name ?? me.email ?? null],
      );
      saved = r!.id;
    }
  } catch (e) {
    return { ok: false, error: `Could not save the offer: ${(e as Error).message}` };
  }
  await syncOfferBanner(saved);
  refresh();
  return { ok: true, id: saved };
}

/**
 * An offer shown in the app is one of the moving banners at the top of the home screen: designed with
 * its product and badge, and tapping it adds the offer to the cart. The banner is made the first time and
 * kept in step with the offer's name, details and product (a poster uploaded on Banners stays); it is
 * switched off with the offer, and the app only shows it while the offer runs.
 */
async function syncOfferBanner(id: number) {
  const o = await one<{ title: string; description: string | null; show_in_app: boolean; active: boolean; applies_to: string; sku: string | null; code: string | null; priority: number; audience: Audience }>(
    `select title, description, show_in_app, active, applies_to, coalesce(skus[1], free_sku) as sku, code, priority, audience from shop_offer where id = $1`,
    [id],
  );
  if (!o) return;
  const on = o.show_in_app && o.active;
  const cta = o.applies_to === "cart" ? (o.code ? `Use ${o.code}` : "Shop now") : "Tap to add";
  const has = await one(`select 1 from shop_banner where offer_id = $1`, [id]);
  if (has) {
    await query(
      `update shop_banner set title = left($2, 60), subtitle = left($3, 100), cta = $4, sku_code = $5, active = $6, audience = $7, updated_at = now() where offer_id = $1`,
      [id, o.title, o.description, cta, o.sku, on, o.audience],
    );
  } else if (on) {
    await query(
      `insert into shop_banner (title, subtitle, cta, sku_code, offer_id, priority, active, audience) values (left($1, 60), left($2, 100), $3, $4, $5, $6, true, $7)`,
      [o.title, o.description, cta, o.sku, id, 100 + o.priority, o.audience],
    );
  }
}

export async function setOfferActiveAction(id: number, active: boolean): Promise<Result> {
  if (!(await editor())) return NO;
  await query(`update shop_offer set active = $2, updated_at = now() where id = $1`, [id, active]);
  await syncOfferBanner(id);
  refresh();
  return { ok: true };
}

/** A copy to start a similar offer from: switched off, without its code. */
export async function duplicateOfferAction(id: number): Promise<Result> {
  const me = await editor();
  if (!me) return NO;
  const r = await one<{ id: number }>(
    `insert into shop_offer (title, badge, description, kind, applies_to, skus, categories, percent, amount, max_discount, buy_qty, free_sku, free_qty,
                             repeat, min_qty, min_amount, code, first_order_only, per_customer_limit, total_limit, starts_at, ends_at, active, show_in_app, priority, created_by, audience)
     select left('Copy of ' || title, 80), badge, description, kind, applies_to, skus, categories, percent, amount, max_discount, buy_qty, free_sku, free_qty,
            repeat, min_qty, min_amount, null, first_order_only, per_customer_limit, total_limit, starts_at, ends_at, false, show_in_app, priority, $2, audience
       from shop_offer where id = $1 returning id`,
    [id, me.name ?? me.email ?? null],
  );
  refresh();
  return r ? { ok: true, id: r.id } : { ok: false, error: "That offer no longer exists." };
}

/** An offer that orders have used is only switched off (orders keep pointing at it); an unused one is deleted. */
export async function deleteOfferAction(id: number): Promise<Result> {
  if (!(await editor())) return NO;
  if (await one(`select 1 from shop_order_offer where offer_id = $1 union all select 1 from dist_order_offer where offer_id = $1 limit 1`, [id])) {
    await query(`update shop_offer set active = false, updated_at = now() where id = $1`, [id]);
    await syncOfferBanner(id);
    refresh();
    return { ok: false, error: "Orders have used this offer, so it was switched off instead of deleted (their bills still show it)." };
  }
  // its own banner goes with it
  await query(`delete from shop_banner where offer_id = $1`, [id]);
  await query(`delete from shop_offer where id = $1`, [id]);
  refresh();
  return { ok: true };
}
