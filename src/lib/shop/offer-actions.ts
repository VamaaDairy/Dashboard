"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { one, query } from "@/lib/db";
import { normaliseCode } from "./offers-engine";

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

  const vals = [
    o.title, o.badge || null, o.description || null, o.kind, o.appliesTo, o.skus, o.categories, o.percent, o.amount, o.maxDiscount,
    o.buyQty, o.freeSku, o.freeQty, o.repeat, o.minQty, o.minAmount, o.code || null, o.firstOrderOnly, o.perCustomerLimit, o.totalLimit,
    local(o.startsAt), local(o.endsAt), o.active, o.showInApp, o.priority,
  ];
  const cols = `title, badge, description, kind, applies_to, skus, categories, percent, amount, max_discount, buy_qty, free_sku, free_qty, repeat,
                min_qty, min_amount, code, first_order_only, per_customer_limit, total_limit, starts_at, ends_at, active, show_in_app, priority`;
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
  revalidatePath("/shop-orders/offers", "layout");
  return { ok: true, id: saved };
}

export async function setOfferActiveAction(id: number, active: boolean): Promise<Result> {
  if (!(await editor())) return NO;
  await query(`update shop_offer set active = $2, updated_at = now() where id = $1`, [id, active]);
  revalidatePath("/shop-orders/offers", "layout");
  return { ok: true };
}

/** A copy to start a similar offer from: switched off, without its code. */
export async function duplicateOfferAction(id: number): Promise<Result> {
  const me = await editor();
  if (!me) return NO;
  const r = await one<{ id: number }>(
    `insert into shop_offer (title, badge, description, kind, applies_to, skus, categories, percent, amount, max_discount, buy_qty, free_sku, free_qty,
                             repeat, min_qty, min_amount, code, first_order_only, per_customer_limit, total_limit, starts_at, ends_at, active, show_in_app, priority, created_by)
     select left('Copy of ' || title, 80), badge, description, kind, applies_to, skus, categories, percent, amount, max_discount, buy_qty, free_sku, free_qty,
            repeat, min_qty, min_amount, null, first_order_only, per_customer_limit, total_limit, starts_at, ends_at, false, show_in_app, priority, $2
       from shop_offer where id = $1 returning id`,
    [id, me.name ?? me.email ?? null],
  );
  revalidatePath("/shop-orders/offers", "layout");
  return r ? { ok: true, id: r.id } : { ok: false, error: "That offer no longer exists." };
}

/** An offer that orders have used is only switched off (orders keep pointing at it); an unused one is deleted. */
export async function deleteOfferAction(id: number): Promise<Result> {
  if (!(await editor())) return NO;
  if (await one(`select 1 from shop_order_offer where offer_id = $1 limit 1`, [id])) {
    await query(`update shop_offer set active = false, updated_at = now() where id = $1`, [id]);
    revalidatePath("/shop-orders/offers", "layout");
    return { ok: false, error: "Orders have used this offer, so it was switched off instead of deleted (their bills still show it)." };
  }
  await query(`update shop_banner set offer_id = null where offer_id = $1`, [id]);
  await query(`delete from shop_offer where id = $1`, [id]);
  revalidatePath("/shop-orders/offers", "layout");
  return { ok: true };
}
