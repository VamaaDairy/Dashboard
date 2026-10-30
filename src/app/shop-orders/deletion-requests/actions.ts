"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { closeDeletionRequest } from "@/lib/shop/deletion";

/** Marks a customer's deletion request done (the account was deleted) or rejected. */
export async function closeDeletionRequestAction(id: number, status: "done" | "rejected"): Promise<{ ok: boolean; error?: string }> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "shop"), "edit")) return { ok: false, error: "You do not have permission to do this." };
  await closeDeletionRequest(id, status, me.name);
  revalidatePath("/shop-orders/deletion-requests");
  return { ok: true };
}
