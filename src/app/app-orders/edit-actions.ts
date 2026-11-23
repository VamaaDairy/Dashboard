"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { confirmOrders, editOrder, MAX_DESK_QTY, reopenOrder, type Actor } from "@/lib/orders/direct";

/** App orders: editing, confirming (one or many) and reopening direct orders from the Gaia Distributors app. */

async function officeActor(): Promise<Actor | null> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !(atLeast(levelFor(me, "apporders"), "edit") || atLeast(levelFor(me, "fp.portalOrder"), "edit"))) return null;
  return { name: me.name || me.email, kind: "office" };
}

const NO_RIGHTS = "You do not have permission to change orders.";
const refresh = () => {
  revalidatePath("/app-orders", "layout");
  revalidatePath("/route-orders");
};

export async function editOrderAction(uid: string, lines: Array<{ sku: string; qty: number }>, note: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const who = await officeActor();
  if (!who) return { ok: false, error: NO_RIGHTS };
  if (!Array.isArray(lines) || lines.length > 200) return { ok: false, error: "Invalid order." };
  const map = new Map<string, number>();
  for (const l of lines) {
    const q = Number(l?.qty);
    if (typeof l?.sku !== "string" || !Number.isInteger(q) || q < 0 || q > MAX_DESK_QTY) return { ok: false, error: "Check the quantities." };
    map.set(l.sku, (map.get(l.sku) ?? 0) + q);
  }
  // the order page's editor holds only what is paid for (free items are shown apart)
  const r = await editOrder(uid, map, who, note);
  if (r.ok) refresh();
  return r;
}

export async function confirmManyAction(uids: string[]): Promise<{ ok: true; confirmed: number; errors: string[] } | { ok: false; error: string }> {
  const who = await officeActor();
  if (!who) return { ok: false, error: NO_RIGHTS };
  if (!Array.isArray(uids) || !uids.length) return { ok: false, error: "Select at least one order." };
  const r = await confirmOrders(uids.filter((u) => typeof u === "string").slice(0, 500), who);
  refresh();
  return { ok: true, ...r };
}

export async function reopenOrderAction(uid: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const who = await officeActor();
  if (!who) return { ok: false, error: NO_RIGHTS };
  const r = await reopenOrder(uid, who, String(reason ?? ""));
  if (r.ok) refresh();
  return r;
}

/** The order list's "Confirm selected": the ticked pending orders, from a plain form post. */
export async function confirmSelectedAction(form: FormData): Promise<void> {
  const who = await officeActor();
  if (!who) return;
  const uids = form.getAll("uid").map(String).filter((u) => /^[0-9a-f-]{36}$/i.test(u));
  if (uids.length) await confirmOrders(uids.slice(0, 500), who);
  refresh();
}
