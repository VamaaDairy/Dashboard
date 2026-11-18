"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { confirmOrders, removeProductFromOrders, setLineFromSheet, type Actor } from "@/lib/orders/direct";

/** The route sheet's own changes: a quantity, confirming rows, taking a product off a day's orders. */

async function actor(): Promise<Actor | null> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me) return null;
  const ok = atLeast(levelFor(me, "routeorders"), "edit") || atLeast(levelFor(me, "apporders"), "edit");
  return ok ? { name: me.name || me.email, kind: "office" } : null;
}
const NO = { ok: false as const, error: "You do not have permission to change orders." };
const uidOk = (u: unknown): u is string => typeof u === "string" && /^[0-9a-f-]{36}$/i.test(u);
const refresh = () => {
  revalidatePath("/route-orders", "layout");
  revalidatePath("/app-orders", "layout");
};

/** One product's quantity for one customer: the cell must belong to a single order. */
export async function setCellAction(uids: string[], sku: string, qty: number, packs: number | null) {
  const who = await actor();
  if (!who) return NO;
  const list = (Array.isArray(uids) ? uids : []).filter(uidOk);
  if (list.length !== 1) return { ok: false as const, error: "This customer has this product on more than one order. Open the order to change it." };
  if (typeof sku !== "string" || !sku) return { ok: false as const, error: "Pick a product." };
  const r = await setLineFromSheet(list[0], sku, Number(qty), who, packs === null || packs === undefined ? null : Number(packs));
  refresh();
  return r;
}

export async function confirmRowsAction(uids: string[]) {
  const who = await actor();
  if (!who) return NO;
  const list = (Array.isArray(uids) ? uids : []).filter(uidOk).slice(0, 500);
  if (!list.length) return { ok: false as const, error: "Nothing to confirm." };
  const r = await confirmOrders(list, who);
  refresh();
  return { ok: true as const, ...r };
}

/** Takes one product off every order shown on the sheet (that day, those filters). */
export async function removeProductAction(uids: string[], sku: string, reason?: string) {
  const who = await actor();
  if (!who) return NO;
  const list = (Array.isArray(uids) ? uids : []).filter(uidOk).slice(0, 1000);
  if (!list.length || typeof sku !== "string" || !sku) return { ok: false as const, error: "Nothing to change." };
  const r = await removeProductFromOrders(list, sku, who, typeof reason === "string" ? reason : null);
  refresh();
  return { ok: true as const, ...r };
}
