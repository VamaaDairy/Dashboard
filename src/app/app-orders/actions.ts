"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import type { Decision, DecisionResult } from "@/lib/orders/primary";
import { cancelOrder, CANCELLED, CONFIRMED, confirmOrders } from "@/lib/orders/direct";

/**
 * Confirm / cancel a pending retailer or distributor order from App orders. The step is logged in the order's history and the buyer's phone gets a notification.
 */
export async function decideAppOrderAction(uid: string, action: Decision, reason?: string): Promise<DecisionResult> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !(atLeast(levelFor(me, "apporders"), "edit") || atLeast(levelFor(me, "fp.portalOrder"), "edit"))) {
    return { ok: false, error: "You do not have permission to change this." };
  }
  const who = { name: me.name || me.email, kind: "office" as const };
  let r: DecisionResult;
  if (action === "cancel") {
    if (!(reason ?? "").trim()) return { ok: false, error: "Give a reason for cancelling." };
    const c = await cancelOrder(uid, who, reason ?? "");
    r = c.ok ? { ok: true, status: CANCELLED } : c;
  } else {
    const c = await confirmOrders([uid], who);
    r = c.confirmed ? { ok: true, status: CONFIRMED } : { ok: false, error: c.errors[0] ?? "Could not confirm." };
  }
  if (r.ok) {
    revalidatePath("/app-orders", "layout");
    revalidatePath("/orders/portalOrder");
  }
  return r;
}
