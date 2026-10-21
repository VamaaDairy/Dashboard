"use server";

import { randomInt } from "node:crypto";
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

export type BulkResult = { ok: boolean; error?: string; csv?: string; created?: number; skipped?: string[] };

/**
 * Give every active distributor (level 3) and every active employee an app login that does not have one yet,
 * on their registered mobile number with a random 6-digit PIN. Returns the new credentials as CSV - the PINs
 * are stored hashed, so this is the only time they can be handed out. Numbers already in use are skipped.
 */
export async function createAllDistLoginsAction(): Promise<BulkResult> {
  if (!(await canEdit())) return NO;
  const people = await query<{ kind: "distributor" | "salesman"; uid: string; name: string; code: string | null; phone: string | null }>(
    `select 'distributor' as kind, f.uid, f.name, f.firm_code as code, f.phone
       from fp_firm f join fp_channel c on c.uid = f.channel_uid
       where f.active = 1 and c.level = 3 and not exists (select 1 from dist_login l where l.firm_uid = f.uid)
     union all
     select 'salesman', s.uid, trim(concat_ws(' ', s.first_name, s.last_name)), s.employee_code, s.phone
       from fp_staff s where s.active = 1 and not exists (select 1 from dist_login l where l.staff_uid = s.uid)
     order by 1, 3`,
  );
  const taken = new Set((await query<{ phone: string }>(`select phone from dist_login`)).map((r) => r.phone));
  const rows: string[] = ["Type,Name,Code,Mobile,PIN"];
  const skipped: string[] = [];
  let created = 0;
  for (const p of people) {
    const phone = (p.phone ?? "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) { skipped.push(`${p.name}: no valid mobile number`); continue; }
    if (taken.has(phone)) { skipped.push(`${p.name}: ${phone} is already used by another login`); continue; }
    const pin = String(randomInt(100000, 1000000));
    await query(
      `insert into dist_login (kind, firm_uid, staff_uid, phone, pin_hash) values ($1, $2, $3, $4, $5)`,
      [p.kind, p.kind === "distributor" ? p.uid : null, p.kind === "salesman" ? p.uid : null, phone, hashPin(pin)],
    );
    taken.add(phone);
    created++;
    rows.push([p.kind === "distributor" ? "Distributor" : "Sales officer", p.name, p.code ?? "", phone, pin].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  revalidatePath(PATH);
  return { ok: true, csv: rows.join("\r\n"), created, skipped };
}
