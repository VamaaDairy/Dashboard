"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";
import { assignRider, setOrderStatus } from "./orders";
import { hashPin } from "./rider";
import { STATUS_LABEL } from "./pricing";

/** Staff changing an order's status - needs edit access to Shop orders. */
export async function setStatusAction(id: number, status: string): Promise<{ ok: boolean; error?: string }> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "shop"), "edit")) return { ok: false, error: "You do not have permission to change this." };
  if (!(status in STATUS_LABEL)) return { ok: false, error: "Unknown status." };
  const ok = await setOrderStatus(id, status);
  if (ok) revalidatePath("/shop-orders");
  return ok ? { ok: true } : { ok: false, error: "That order no longer exists." };
}

async function canEdit() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return !!me && atLeast(levelFor(me, "shop"), "edit");
}

const NO = { ok: false as const, error: "You do not have permission to change this." };

export async function assignRiderAction(orderId: number, riderId: number | null): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEdit())) return NO;
  const ok = await assignRider(orderId, riderId);
  if (ok) revalidatePath("/shop-orders");
  return ok ? { ok: true } : { ok: false, error: "This order can no longer be given to a rider." };
}

export async function addRiderAction(name: string, phone: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEdit())) return NO;
  const p = phone.replace(/\D/g, "").slice(-10);
  if (name.trim().length < 2) return { ok: false, error: "Enter the rider's name." };
  if (!/^[6-9]\d{9}$/.test(p)) return { ok: false, error: "Enter a valid 10-digit mobile number." };
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: "The PIN must be 4 to 8 digits." };
  try {
    await query(`insert into shop_rider (name, phone, pin_hash) values ($1, $2, $3)`, [name.trim(), p, hashPin(pin)]);
  } catch {
    return { ok: false, error: "A rider with this number already exists." };
  }
  revalidatePath("/shop-orders/riders");
  return { ok: true };
}

export async function setRiderAction(id: number, patch: { active?: boolean; pin?: string }): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEdit())) return NO;
  if (patch.pin !== undefined) {
    if (!/^\d{4,8}$/.test(patch.pin)) return { ok: false, error: "The PIN must be 4 to 8 digits." };
    // a new PIN also signs the rider out of any phone still holding the old session
    await query(`update shop_rider set pin_hash = $2, token = null where id = $1`, [id, hashPin(patch.pin)]);
  }
  if (patch.active !== undefined) await query(`update shop_rider set active = $2, token = case when $2 then token else null end where id = $1`, [id, patch.active]);
  revalidatePath("/shop-orders/riders");
  return { ok: true };
}
