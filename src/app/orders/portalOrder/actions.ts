"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { decideOrder, type Decision, type DecisionResult } from "@/lib/orders/primary";

/** Confirm / cancel a pending primary order. Checked here as well as in the proxy: an action can be posted to any page. */
export async function decideOrderAction(uid: string, action: Decision, reason?: string): Promise<DecisionResult> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "fp.portalOrder"), "edit")) return { ok: false, error: "You do not have permission to change this." };
  const r = await decideOrder(uid, action === "cancel" ? "cancel" : "confirm", me.name || me.email, reason);
  if (r.ok) revalidatePath("/orders/portalOrder");
  return r;
}
