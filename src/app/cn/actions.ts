"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";
import { query, tx } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { levelFor, atLeast } from "@/lib/access";
import { addDays, today } from "@/lib/dates";
import {
  CATEGORIES, CUSTOMER_TYPES, DEPARTMENTS, QTY_UNITS, levelCovers, levelNames, requiredLevel, rupees,
} from "@/lib/cn/sop";

export type CnResult = { ok: true; id: string } | { ok: false; error: string };
const fail = (error: string): CnResult => ({ ok: false, error });

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The signed-in user, if they may act on this part of CN management - checked here as well as in the proxy. */
async function actor(key: "cn" | "cn.approve" | "cn.finance") {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, key), "edit") ? me : null;
}
const denied = () => fail("You do not have permission to do this.");

const s = (v: unknown) => String(v ?? "").trim();
const need = (v: unknown, label: string) => {
  const t = s(v);
  if (!t) throw new Error(`${label} is required`);
  return t;
};
const date = (v: unknown, label: string, required = false) => {
  const t = s(v);
  if (!t) {
    if (required) throw new Error(`${label} is required`);
    return null;
  }
  if (!ISO.test(t)) throw new Error(`${label}: pick a valid date`);
  return t;
};
const money = (v: unknown, label: string) => {
  const n = Number(s(v).replace(/,/g, ""));
  if (!s(v) || !Number.isFinite(n) || n <= 0) throw new Error(`${label} must be an amount above zero`);
  return Math.round(n * 100) / 100;
};
const oneOf = (v: unknown, list: string[], label: string) => {
  const t = s(v);
  if (!list.includes(t)) throw new Error(`${label}: pick one from the list`);
  return t;
};

async function log(c: PoolClient, id: string, by: string, action: string, remark?: string | null) {
  await c.query(`insert into cn_event (complaint_id, by_name, action, remark) values ($1,$2,$3,$4)`, [id, by, action, remark || null]);
}

/**
 * Moves a complaint from one stage to the next, only if it is still in the stage the
 * caller saw (so two people cannot act on the same step), and writes the audit line.
 * `sets` are column=value pairs applied together with the stage change.
 */
async function advance(
  c: PoolClient, id: string, from: string, to: string, by: string, action: string, remark: string | null,
  sets: Record<string, unknown> = {},
) {
  const cols = Object.keys(sets);
  const assign = cols.map((k, i) => `${k} = $${i + 4}`).join(", ");
  const r = await c.query(
    `update cn_complaint set stage = $2, stage_on = $3${assign ? ", " + assign : ""} where id = $1 and stage = '${from}' returning id`,
    [id, to, today(), ...cols.map((k) => sets[k])],
  );
  if (r.rowCount === 0) throw new Error("This complaint has already moved on - refresh the page.");
  await log(c, id, by, action, remark);
}

async function run(id: string, fn: () => Promise<void>): Promise<CnResult> {
  try {
    await fn();
    revalidatePath("/cn", "layout");
    return { ok: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(/cn_complaint_cn_number_uq/.test(msg) ? "That CN number has already been posted against another complaint." : msg);
  }
}

// ---------------------------------------------------------------- 1. registration

export interface RegisterInput {
  complaint_date: string; customer_name: string; customer_type: string; region: string; contact_no: string;
  invoice_no: string; invoice_date: string; product_name: string; batch_no: string; qty_affected: string; qty_unit: string;
  category: string; description: string; evidence_url: string; claim_value: string;
}

/** Registers a complaint and gives it its number. Stops duplicates of the same invoice + product + customer. */
export async function registerComplaint(i: RegisterInput): Promise<CnResult> {
  const me = await actor("cn");
  if (!me) return denied();
  try {
    const customer = need(i.customer_name, "Customer name");
    const invoice = need(i.invoice_no, "Invoice no.");
    const product = need(i.product_name, "Product");
    const evidence = need(i.evidence_url, "Photo / video link");
    if (!/^https?:\/\/\S+$/i.test(evidence)) throw new Error("Photo / video link must be a web link (http…)");
    const qty = Number(s(i.qty_affected).replace(/,/g, ""));
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("Quantity affected must be above zero");
    const head = [
      date(i.complaint_date, "Complaint date", true), customer, oneOf(i.customer_type, CUSTOMER_TYPES, "Customer type"),
      s(i.region) || null, s(i.contact_no) || null, invoice, date(i.invoice_date, "Invoice date"), product, s(i.batch_no) || null,
      qty, s(i.qty_unit) && QTY_UNITS.includes(s(i.qty_unit)) ? s(i.qty_unit) : "Pcs",
      oneOf(i.category, CATEGORIES, "Complaint type"), need(i.description, "Description of the complaint"), evidence,
      money(i.claim_value, "Claim value"), me.name,
    ];
    if (head[0]! > today()) throw new Error("Complaint date cannot be in the future");

    const id = await tx(async (c) => {
      const dup = await c.query(
        `select complaint_no from cn_complaint where lower(customer_name)=lower($1) and lower(invoice_no)=lower($2)
           and lower(product_name)=lower($3) and stage <> 'rejected' limit 1`,
        [customer, invoice, product],
      );
      if (dup.rows[0]) throw new Error(`Already registered as ${dup.rows[0].complaint_no} (same customer, invoice and product).`);
      const r = await c.query(
        `insert into cn_complaint (complaint_date, customer_name, customer_type, region, contact_no, invoice_no, invoice_date, product_name,
           batch_no, qty_affected, qty_unit, category, description, evidence_url, claim_value, registered_by, stage_on)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id, complaint_no`,
        [...head, today()],
      );
      await log(c, r.rows[0].id, me.name, `Complaint registered as ${r.rows[0].complaint_no}`);
      return r.rows[0].id as string;
    });
    revalidatePath("/cn", "layout");
    return { ok: true, id };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------- 2. MIS verification

/** MIS checks the information and the evidence, then logs the complaint - or rejects it as invalid. */
export async function misVerify(id: string, verified: boolean, infoComplete: boolean, evidenceSeen: boolean, remark: string): Promise<CnResult> {
  const me = await actor("cn");
  if (!me) return denied();
  return run(id, async () => {
    if (verified) {
      if (!infoComplete || !evidenceSeen) throw new Error("Confirm that the information is complete and the evidence has been checked.");
      await tx((c) => advance(c, id, "registered", "logged", me.name, "MIS verified and logged", s(remark) || null, { mis_by: me.name, mis_on: today(), mis_remark: s(remark) || null }));
    } else {
      const why = need(remark, "Reason for rejecting");
      await tx((c) => advance(c, id, "registered", "rejected", me.name, "Rejected at MIS verification", why,
        { mis_by: me.name, mis_on: today(), mis_remark: why, outcome: "rejected" }));
    }
  });
}

// ---------------------------------------------------------------- 3. department assignment

export async function assignDepartment(id: string, department: string, tatDays: number, remark: string): Promise<CnResult> {
  const me = await actor("cn");
  if (!me) return denied();
  return run(id, async () => {
    const dep = oneOf(department, DEPARTMENTS, "Department");
    if (!Number.isInteger(tatDays) || tatDays < 1 || tatDays > 15) throw new Error("Investigation TAT must be 1 to 15 days");
    await tx((c) => advance(c, id, "logged", "assigned", me.name, `Assigned to ${dep}`, s(remark) || null,
      { department: dep, assigned_by: me.name, assigned_on: today(), tat_due: addDays(today(), tatDays) }));
  });
}

/** The department was wrong: send it to another one, with the reason. The TAT restarts. */
export async function reassignDepartment(id: string, department: string, tatDays: number, remark: string): Promise<CnResult> {
  const me = await actor("cn");
  if (!me) return denied();
  return run(id, async () => {
    const dep = oneOf(department, DEPARTMENTS, "Department");
    const why = need(remark, "Reason for reassigning");
    if (!Number.isInteger(tatDays) || tatDays < 1 || tatDays > 15) throw new Error("Investigation TAT must be 1 to 15 days");
    await tx((c) => advance(c, id, "assigned", "assigned", me.name, `Reassigned to ${dep}`, why,
      { department: dep, assigned_by: me.name, assigned_on: today(), tat_due: addDays(today(), tatDays) }));
  });
}

// ---------------------------------------------------------------- 4-6. investigation, RCA, CAPA

export interface RcaInput {
  investigation: string; root_cause: string; corrective_action: string; preventive_action: string; capa_owner: string; capa_target_date: string;
}

export async function submitRca(id: string, i: RcaInput): Promise<CnResult> {
  const me = await actor("cn");
  if (!me) return denied();
  return run(id, async () => {
    const target = date(i.capa_target_date, "CAPA target date", true)!;
    if (target < today()) throw new Error("CAPA target date cannot be in the past");
    await tx((c) => advance(c, id, "assigned", "rca_done", me.name, "Investigation, RCA and CAPA submitted", null, {
      investigation: need(i.investigation, "Investigation findings"), root_cause: need(i.root_cause, "Root cause"),
      corrective_action: need(i.corrective_action, "Corrective action"), preventive_action: need(i.preventive_action, "Preventive action"),
      capa_owner: need(i.capa_owner, "CAPA owner"), capa_target_date: target, rca_by: me.name, rca_on: today(),
    }));
  });
}

// ---------------------------------------------------------------- 7. CN recommendation

/** Recommend a CN (value, and whether material comes back) - or close the complaint with no CN. */
export async function recommendCn(id: string, recommend: boolean, value: string, returnRequired: boolean, remark: string): Promise<CnResult> {
  const me = await actor("cn");
  if (!me) return denied();
  return run(id, async () => {
    if (!recommend) {
      const why = need(remark, "Reason for no credit note");
      await tx((c) => advance(c, id, "rca_done", "closed", me.name, "Closed - no credit note", why,
        { outcome: "no_cn", recommend_remark: why, recommended_by: me.name, recommended_on: today(), closed_by: me.name, closed_on: today(), closure_remark: why }));
      return;
    }
    const v = money(value, "Recommended CN value");
    await tx(async (c) => {
      const row = (await c.query(`select claim_value::float8 as claim from cn_complaint where id = $1`, [id])).rows[0];
      if (!row) throw new Error("Complaint not found");
      if (v > row.claim) throw new Error(`Recommended value cannot exceed the claim of ${rupees(row.claim)}.`);
      await advance(c, id, "rca_done", "recommended", me.name, `CN recommended for ${rupees(v)}`, s(remark) || null, {
        recommended_value: v, return_required: !!returnRequired, recommend_remark: s(remark) || null,
        recommended_by: me.name, recommended_on: today(), approval_level: requiredLevel(v),
      });
    });
  });
}

// ---------------------------------------------------------------- 8. approval

/** Approve (at a level that covers the value, for no more than was recommended) or reject. */
export async function decideCn(id: string, approve: boolean, authority: string, value: string, remark: string): Promise<CnResult> {
  const me = await actor("cn.approve");
  if (!me) return denied();
  return run(id, async () => {
    const row = (await query<{ recommended_value: number; approval_level: string; recommended_by: string; registered_by: string }>(
      `select recommended_value::float8 as recommended_value, approval_level, recommended_by, registered_by from cn_complaint where id = $1 and stage = 'recommended'`, [id],
    ))[0];
    if (!row) throw new Error("This complaint is not waiting for approval.");
    if (me.role !== "owner" && (me.name === row.recommended_by || me.name === row.registered_by)) {
      throw new Error("You registered or recommended this complaint - someone else must approve it.");
    }
    if (!approve) {
      const why = need(remark, "Reason for rejecting");
      await tx((c) => advance(c, id, "recommended", "rejected", me.name, "Credit note rejected by approver", why,
        { outcome: "rejected", approved_by: me.name, approved_on: today(), approval_remark: why }));
      return;
    }
    if (!levelNames.includes(authority)) throw new Error("Pick the authority you are approving as.");
    if (!levelCovers(authority, row.approval_level)) throw new Error(`This value needs approval by ${row.approval_level} or higher.`);
    const v = money(value, "Approved value");
    if (v > row.recommended_value) throw new Error(`Approved value cannot exceed the recommended ${rupees(row.recommended_value)}.`);
    await tx((c) => advance(c, id, "recommended", "approved", me.name, `CN approved for ${rupees(v)} as ${authority}`, s(remark) || null,
      { approved_value: v, approver_level: authority, approved_by: me.name, approved_on: today(), approval_remark: s(remark) || null }));
  });
}

// ---------------------------------------------------------------- 9. finance posting

/** Finance posts the credit note; the value must be exactly what was approved. */
export async function postCn(id: string, cnNumber: string, cnDate: string, cnValue: string, remark: string): Promise<CnResult> {
  const me = await actor("cn.finance");
  if (!me) return denied();
  return run(id, async () => {
    const no = need(cnNumber, "CN number");
    const d = date(cnDate, "CN date", true);
    const v = money(cnValue, "CN value");
    await tx(async (c) => {
      const row = (await c.query(`select approved_value::float8 as approved, approved_by from cn_complaint where id = $1 and stage = 'approved'`, [id])).rows[0];
      if (!row) throw new Error("This complaint is not waiting for posting.");
      if (me.role !== "owner" && me.name === row.approved_by) throw new Error("The approver cannot also post the credit note.");
      if (v !== row.approved) throw new Error(`CN value must equal the approved value of ${rupees(row.approved)}.`);
      await advance(c, id, "approved", "posted", me.name, `CN ${no} posted for ${rupees(v)}`, s(remark) || null,
        { cn_number: no, cn_date: d, cn_value: v, finance_by: me.name, finance_on: today() });
    });
  });
}

// ---------------------------------------------------------------- 10-11. return material, closure

export async function verifyReturn(id: string, remark: string): Promise<CnResult> {
  const me = await actor("cn");
  if (!me) return denied();
  return run(id, async () => {
    const r = await query(
      `update cn_complaint set return_verified_by=$2, return_verified_on=$3, return_remark=$4
        where id=$1 and stage='posted' and return_required and return_verified_on is null returning id`,
      [id, me.name, today(), need(remark, "Return verification note (what was received)")],
    );
    if (r.length === 0) throw new Error("Nothing to verify on this complaint.");
    await tx((c) => log(c, id, me.name, "Return material verified", s(remark)));
  });
}

export async function closeComplaint(id: string, remark: string): Promise<CnResult> {
  const me = await actor("cn");
  if (!me) return denied();
  return run(id, async () => {
    await tx(async (c) => {
      const row = (await c.query(`select return_required, return_verified_on from cn_complaint where id = $1 and stage = 'posted'`, [id])).rows[0];
      if (!row) throw new Error("This complaint is not ready to close.");
      if (row.return_required && !row.return_verified_on) throw new Error("Verify the returned material before closing.");
      await advance(c, id, "posted", "closed", me.name, "Complaint closed", s(remark) || null,
        { outcome: "cn_issued", closed_by: me.name, closed_on: today(), closure_remark: s(remark) || null });
    });
  });
}

// ---------------------------------------------------------------- 12. CAPA effectiveness review

export async function reviewCapa(id: string, effective: boolean, remark: string): Promise<CnResult> {
  const me = await actor("cn");
  if (!me) return denied();
  return run(id, async () => {
    if (!effective && !s(remark)) throw new Error("Say what is still going wrong");
    const r = await query(
      `update cn_complaint set capa_effective=$2, capa_review_by=$3, capa_review_on=$4, capa_review_remark=$5
        where id=$1 and stage='closed' and root_cause is not null and capa_review_on is null returning id`,
      [id, effective, me.name, today(), s(remark) || null],
    );
    if (r.length === 0) throw new Error("There is no CAPA waiting for review on this complaint.");
    await tx((c) => log(c, id, me.name, effective ? "CAPA reviewed - effective" : "CAPA reviewed - not effective", s(remark)));
  });
}
