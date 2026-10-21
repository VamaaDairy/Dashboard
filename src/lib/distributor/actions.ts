"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";
import { hashPin } from "@/lib/shop/rider";

type Result = { ok: boolean; error?: string };
const NO = { ok: false as const, error: "You do not have permission to change this." };
const PATH = "/shop-orders/distributors";

async function canEdit() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return !!me && atLeast(levelFor(me, "shop"), "edit");
}

/** Give a distributor (firm) or a salesman (staff) an app login: their mobile number + a PIN. */
export async function addDistLoginAction(kind: "distributor" | "salesman", uid: string, phone: string, pin: string): Promise<Result> {
  if (!(await canEdit())) return NO;
  const p = phone.replace(/\D/g, "").slice(-10);
  if (kind !== "distributor" && kind !== "salesman") return { ok: false, error: "Choose distributor or salesman." };
  if (!/^[0-9a-f-]{36}$/.test(uid)) return { ok: false, error: `Choose the ${kind}.` };
  if (!/^[6-9]\d{9}$/.test(p)) return { ok: false, error: "Enter a valid 10-digit mobile number." };
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: "The PIN must be 4 to 8 digits." };
  try {
    await query(
      `insert into dist_login (kind, firm_uid, staff_uid, phone, pin_hash) values ($1, $2, $3, $4, $5)`,
      [kind, kind === "distributor" ? uid : null, kind === "salesman" ? uid : null, p, hashPin(pin)],
    );
  } catch {
    return { ok: false, error: "This mobile number, or this distributor / salesman, already has a login." };
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function setDistLoginAction(id: number, patch: { active?: boolean; pin?: string }): Promise<Result> {
  if (!(await canEdit())) return NO;
  if (patch.pin !== undefined) {
    if (!/^\d{4,8}$/.test(patch.pin)) return { ok: false, error: "The PIN must be 4 to 8 digits." };
    // a new PIN also signs them out of any phone still holding the old session
    await query(`update dist_login set pin_hash = $2, token = null where id = $1`, [id, hashPin(patch.pin)]);
  }
  if (patch.active !== undefined) await query(`update dist_login set active = $2, token = case when $2 then token else null end where id = $1`, [id, patch.active]);
  revalidatePath(PATH);
  return { ok: true };
}
