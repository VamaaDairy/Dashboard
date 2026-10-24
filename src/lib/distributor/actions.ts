"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";
import { hashPin } from "@/lib/shop/rider";
import { createMissingDistLogins } from "@/lib/distributor";

type Result = { ok: boolean; error?: string };
type Kind = "distributor" | "salesman" | "retailer";
const NO = { ok: false as const, error: "You do not have permission to change this." };

/** App logins are managed on the master the person is listed in: Customer Masters (distributors) and Employee Profile (sales officers). */
const SCREEN: Record<Kind, { slug: string; table: string; col: string }> = {
  distributor: { slug: "distribution", table: "fp_firm", col: "firm_uid" },
  retailer: { slug: "distribution", table: "fp_firm", col: "firm_uid" },
  salesman: { slug: "staffs", table: "fp_staff", col: "staff_uid" },
};

async function canEdit(kind: Kind) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return !!me && atLeast(levelFor(me, `fp.${SCREEN[kind].slug}`), "edit");
}

const done = (kind: Kind): Result => {
  revalidatePath(`/orders/${SCREEN[kind].slug}`);
  return { ok: true };
};

/** Gives a distributor or retailer (firm) or sales officer (employee) an app login: the mobile number on their master record + a PIN. A firm in the retailer channel gets a retailer login. */
export async function addAppLoginAction(kind: Kind, uid: string, pin: string): Promise<Result> {
  if (kind !== "distributor" && kind !== "salesman" && kind !== "retailer") return NO;
  if (!(await canEdit(kind))) return NO;
  if (!/^[0-9a-f-]{36}$/.test(uid)) return { ok: false, error: "That record no longer exists." };
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: "The PIN must be 4 to 8 digits." };
  const s = SCREEN[kind];
  const rows = await query<{ phone: string | null }>(`select phone from ${s.table} where uid = $1`, [uid]);
  if (!rows.length) return { ok: false, error: "That record no longer exists." };
  const phone = (rows[0].phone ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) return { ok: false, error: "Add a valid 10-digit mobile number to this record first - the app signs in with it." };
  if (kind !== "salesman") {
    const ch = await query<{ code: string | null }>(`select c.channel_code as code from fp_firm f left join fp_channel c on c.uid = f.channel_uid where f.uid = $1`, [uid]);
    kind = ch[0]?.code === "RT" ? "retailer" : "distributor";
  }
  try {
    await query(
      `insert into dist_login (kind, firm_uid, staff_uid, phone, pin_hash) values ($1, $2, $3, $4, $5)`,
      [kind, kind !== "salesman" ? uid : null, kind === "salesman" ? uid : null, phone, hashPin(pin)],
    );
  } catch {
    return { ok: false, error: "This record, or its mobile number, already has an app login." };
  }
  return done(kind);
}

/** Sets a new PIN (which also signs them out of any phone still holding the old session) and/or switches the login off or on. */
export async function setAppLoginAction(kind: Kind, uid: string, patch: { active?: boolean; pin?: string }): Promise<Result> {
  if (kind !== "distributor" && kind !== "salesman" && kind !== "retailer") return NO;
  if (!(await canEdit(kind))) return NO;
  if (!/^[0-9a-f-]{36}$/.test(uid)) return { ok: false, error: "That record no longer exists." };
  const col = SCREEN[kind].col;
  if (patch.pin !== undefined) {
    if (!/^\d{4,8}$/.test(patch.pin)) return { ok: false, error: "The PIN must be 4 to 8 digits." };
    await query(`update dist_login set pin_hash = $2, token = null where ${col} = $1`, [uid, hashPin(patch.pin)]);
  }
  if (patch.active !== undefined) {
    await query(`update dist_login set active = $2, token = case when $2 then token else null end where ${col} = $1`, [uid, patch.active]);
  }
  return done(kind);
}

export type BulkResult = { ok: boolean; error?: string; csv?: string; created?: number; skipped?: string[] };

/**
 * Gives everyone listed on this master who has no app login one, on the mobile number in their record with a random
 * 6-digit PIN. Distributors include inactive ones (they simply cannot sign in until switched on in Customer Masters).
 * Returns the new credentials as CSV - the PINs are stored hashed, so this is the only time they can be handed out.
 */
export async function createMissingAppLoginsAction(kind: Kind): Promise<BulkResult> {
  if (kind !== "distributor" && kind !== "salesman" && kind !== "retailer") return NO;
  if (!(await canEdit(kind))) return NO;
  const r = await createMissingDistLogins(kind);
  revalidatePath(`/orders/${SCREEN[kind].slug}`);
  return { ok: true, ...r };
}
