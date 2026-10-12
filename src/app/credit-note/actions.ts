"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { query, tx } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { levelFor, atLeast } from "@/lib/access";
import { today } from "@/lib/dates";
import { activeScenarioId } from "@/lib/model/load";
import { joinQty } from "@/lib/creditnote/qty";

export type CreditResult = { ok: true; id: string } | { ok: false; error: string };
const fail = (error: string): CreditResult => ({ ok: false, error });

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The signed-in user, if they may change credit notes - checked here as well as in the proxy. */
async function editor() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, "creditnote"), "edit") ? me : null;
}

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const orNull = (f: FormData, k: string) => text(f, k) || null;

function date(raw: string, required: boolean, label: string): string | null {
  const v = raw.trim();
  if (!v) {
    if (required) throw new Error(`${label} is required`);
    return null;
  }
  if (!ISO.test(v)) throw new Error(`${label}: pick a valid date`);
  return v;
}

function qty(raw: string, label: string): number | null {
  const t = String(raw ?? "").replace(/,/g, "").trim();
  if (t === "") return null;
  const v = Number(t);
  if (!Number.isFinite(v) || v < 0) throw new Error(`${label}: "${raw}" is not a valid number`);
  return v;
}

interface ItemInput {
  material_name: string; reason: string; mfd: string; ubd: string; quality_remark: string; return_unit: string;
  claim_cases: string; claim_loose: string;
}

/** Items as typed (cases + loose pieces) -> rows with total pieces. The SKU, if the name is one, decides the case size. */
async function parseItems(f: FormData) {
  let raw: ItemInput[];
  try { raw = JSON.parse(text(f, "items")); } catch { throw new Error("Items could not be read"); }
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("Add at least one item");
  const skus = await query<{ code: string; name: string; case_unit: string; pcs_per_case: number }>(
    `select code, name, case_unit, pcs_per_case from sku where scenario_id = $1`, [await activeScenarioId()],
  );
  return raw.map((it, n) => {
    const label = `Item ${n + 1}`;
    const name = String(it.material_name ?? "").trim();
    if (!name) throw new Error(`${label}: name of the material is required`);
    const sku = skus.find((s) => s.name === name);
    const ppc = sku ? Number(sku.pcs_per_case) : 1;
    const unit = sku ? sku.case_unit : String(it.return_unit ?? "").trim() || "Pcs";
    const total = (c: string, l: string, what: string) => {
      const v = joinQty(String(c ?? ""), String(l ?? ""), ppc);
      if (v !== null && !Number.isFinite(v)) throw new Error(`${label}: ${what} is not a valid number`);
      return v;
    };
    const claim = total(it.claim_cases, it.claim_loose, "Claim Qty.");
    if (claim === null || claim <= 0) throw new Error(`${label}: Claim Qty. is required`);
    return {
      name, sku: sku?.code ?? null, ppc, unit, claim,
      reason: String(it.reason ?? "").trim() || null, mfd: date(String(it.mfd ?? ""), false, `${label}: MFD`), ubd: date(String(it.ubd ?? ""), false, `${label}: U.B.D.`),
      remark: String(it.quality_remark ?? "").trim() || null,
    };
  });
}

/** Creates a credit note (always pending), or edits one that has not been decided yet. */
export async function saveCreditNote(id: string | null, f: FormData): Promise<CreditResult> {
  const me = await editor();
  if (!me) return fail("You do not have permission to change credit notes.");
  try {
    const challanNo = text(f, "challan_no");
    const customer = text(f, "customer_name");
    if (!challanNo) throw new Error("Challan No. is required");
    if (!customer) throw new Error("Customer name is required");
    const items = await parseItems(f);
    const head = [
      challanNo, date(text(f, "challan_date"), true, "Date"), customer, orNull(f, "contact_no"), orNull(f, "address"),
      orNull(f, "checked_by"), orNull(f, "vehicle_no"), orNull(f, "dispatch_challan_no"),
      date(text(f, "dispatch_date"), false, "Dispatch date"), orNull(f, "team_name"),
    ];

    const noteId = await tx(async (c) => {
      let nid = id;
      if (nid) {
        const r = await c.query(
          `update credit_note set challan_no=$2, challan_date=$3, customer_name=$4, contact_no=$5, address=$6, checked_by=$7,
             vehicle_no=$8, dispatch_challan_no=$9, dispatch_date=$10, team_name=$11, updated_at=now()
           where id=$1 and status='pending' returning id`,
          [nid, ...head],
        );
        if (r.rowCount === 0) throw new Error("This credit note has already been decided and can no longer be edited");
        await c.query(`delete from credit_note_item where credit_note_id = $1`, [nid]);
      } else {
        const r = await c.query(
          `insert into credit_note (challan_no, challan_date, customer_name, contact_no, address, checked_by, vehicle_no,
             dispatch_challan_no, dispatch_date, team_name, created_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
          [...head, me.name],
        );
        nid = r.rows[0].id as string;
      }
      for (const [pos, it] of items.entries()) {
        await c.query(
          `insert into credit_note_item (credit_note_id, position, material_name, reason, ubd, return_unit, quality_remark, claim_qty, sku_code, pcs_per_case, mfd)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [nid, pos, it.name, it.reason, it.ubd, it.unit, it.remark, it.claim, it.sku, it.ppc, it.mfd],
        );
      }
      return nid!;
    });
    revalidatePath("/credit-note", "layout");
    return { ok: true, id: noteId };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

/** Approved quantity per item id, in total pieces. */
export type Approved = Record<string, string>;

/**
 * Approves or rejects a pending note; stamps who decided and when. Approving needs an
 * approved quantity for every item, and it cannot exceed what was claimed.
 */
export async function decideCreditNote(
  id: string, decision: "approved" | "rejected", approved: Approved, note: string,
): Promise<CreditResult> {
  const me = await editor();
  if (!me) return fail("You do not have permission to change credit notes.");
  try {
    if (decision === "rejected" && !note.trim()) throw new Error("Say why it is rejected");
    await tx(async (c) => {
      const r = await c.query(
        `update credit_note set status=$2, approved_by=$3, approved_on=$4, decision_note=$5, updated_at=now()
          where id=$1 and status='pending' returning id`,
        [id, decision, me.name, today(), note.trim() || null],
      );
      if (r.rowCount === 0) throw new Error("This credit note has already been decided");
      const items = (await c.query(
        `select id, material_name, claim_qty::float8 as claim from credit_note_item where credit_note_id = $1`, [id],
      )).rows as { id: string; material_name: string; claim: number | null }[];
      for (const it of items) {
        let a: number | null = 0;
        if (decision === "approved") {
          a = qty(approved[it.id] ?? "", `Approved Qty. for ${it.material_name}`);
          if (a === null) throw new Error(`Enter the approved quantity for ${it.material_name}`);
          if (it.claim !== null && a > it.claim) throw new Error(`${it.material_name}: Approved Qty. cannot be more than the Claim Qty.`);
        }
        await c.query(`update credit_note_item set approved_qty = $2 where id = $1`, [it.id, a]);
      }
    });
    revalidatePath("/credit-note", "layout");
    return { ok: true, id };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

/** Puts a decided note back to pending so it can be corrected and decided again. */
export async function reopenCreditNote(id: string): Promise<CreditResult> {
  const me = await editor();
  if (!me) return fail("You do not have permission to change credit notes.");
  const rows = await query<{ id: string }>(
    `update credit_note set status='pending', approved_by=null, approved_on=null, decision_note=null, updated_at=now()
      where id=$1 and status<>'pending' returning id`,
    [id],
  );
  if (rows.length === 0) return fail("Nothing to reopen");
  await query(`update credit_note_item set approved_qty = null where credit_note_id = $1`, [id]);
  revalidatePath("/credit-note", "layout");
  return { ok: true, id };
}

/** Deletes a credit note together with its items. */
export async function deleteCreditNote(id: string): Promise<CreditResult> {
  const me = await editor();
  if (!me) return fail("You do not have permission to change credit notes.");
  const rows = await query<{ id: string }>(`delete from credit_note where id = $1 returning id`, [id]);
  if (rows.length === 0) return fail("Credit note not found");
  revalidatePath("/credit-note", "layout");
  return { ok: true, id };
}
