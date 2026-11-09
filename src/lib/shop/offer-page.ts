import "server-only";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { listProductsForDisplay } from "./catalog";
import type { Offer } from "./offers-engine";
import type { OfferInput } from "./offer-actions";
import type { PickProduct } from "@/components/shop/OfferForm";

export async function canEditShop() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return !!me && atLeast(levelFor(me, "shop"), "edit");
}

/** The D2C products (on sale first, out of stock after) and the app's categories, in the app's order. */
export async function offerChoices(): Promise<{ products: PickProduct[]; categories: string[] }> {
  const list = await listProductsForDisplay();
  const products = list.map((p) => ({ sku: p.sku, name: p.size ? `${p.name} ${p.size}` : p.name, category: p.category, price: p.price, image: p.image, available: p.available !== false }));
  return { products, categories: [...new Set(list.map((p) => p.category))] };
}

/** A UTC time as the form's India-time "YYYY-MM-DDTHH:mm". */
const toLocal = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 16) : "";

export const BLANK: OfferInput = {
  title: "", badge: "", description: "", kind: "percent", appliesTo: "products", skus: [], categories: [], percent: null, amount: null,
  maxDiscount: null, buyQty: 2, freeSku: null, freeQty: 1, repeat: true, minQty: 0, minAmount: 0, code: "", firstOrderOnly: false,
  perCustomerLimit: null, totalLimit: null, startsAt: "", endsAt: "", active: true, showInApp: true, priority: 0,
};

export const toInput = (o: Offer): OfferInput => ({
  title: o.title, badge: o.badge ?? "", description: o.description ?? "", kind: o.kind, appliesTo: o.appliesTo, skus: o.skus, categories: o.categories,
  percent: o.percent, amount: o.amount, maxDiscount: o.maxDiscount, buyQty: o.buyQty, freeSku: o.freeSku, freeQty: o.freeQty, repeat: o.repeat,
  minQty: o.minQty, minAmount: o.minAmount, code: o.code ?? "", firstOrderOnly: o.firstOrderOnly, perCustomerLimit: o.perCustomerLimit,
  totalLimit: o.totalLimit, startsAt: toLocal(o.startsAt), endsAt: toLocal(o.endsAt), active: o.active, showInApp: o.showInApp, priority: o.priority,
});

export type OfferState = "live" | "scheduled" | "ended" | "paused" | "used_up";
export function offerState(o: Offer, used: number, now = new Date()): OfferState {
  if (!o.active) return "paused";
  if (o.endsAt && new Date(o.endsAt) <= now) return "ended";
  if (o.totalLimit != null && used >= o.totalLimit) return "used_up";
  if (o.startsAt && new Date(o.startsAt) > now) return "scheduled";
  return "live";
}
