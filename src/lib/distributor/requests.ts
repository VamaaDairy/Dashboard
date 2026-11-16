import "server-only";
import { one, query } from "@/lib/db";
import { saveRecord } from "@/lib/masters/entity/service";
import { MASTERS } from "@/lib/masters/schemas";

/**
 * New customers a sales officer proposes from the Sales app (db/104 dist_firm_request). Nothing is added to Customer
 * Masters until the office approves it; approving creates the customer - active, mapped to that officer - with the
 * code and channel the office gives it.
 */

export const REQUEST_KINDS = ["Distributor", "Super Stockist", "Retailer", "MFS", "Institution"] as const;

export interface FirmRequest {
  id: number;
  staffUid: string;
  officer: string | null;
  name: string;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  address: string;
  city: string | null;
  pincode: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  gstin: string | null;
  kind: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  firmUid: string | null;
  firmCode: string | null;
  reason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

const SELECT = `
  select r.id, r.staff_uid as "staffUid", nullif(trim(concat_ws(' ', s.first_name, s.last_name)), '') as officer, r.name,
         r.contact_person as "contactPerson", r.phone, r.email, r.address, r.city, r.pincode, r.state, r.lat, r.lng, r.gstin, r.kind, r.notes,
         r.status, r.firm_uid as "firmUid", f.firm_code as "firmCode", r.reason, r.decided_by as "decidedBy",
         r.decided_at as "decidedAt", r.created_at as "createdAt"
    from dist_firm_request r
    left join fp_staff s on s.uid = r.staff_uid
    left join fp_firm f on f.uid = r.firm_uid`;

const iso = (r: FirmRequest): FirmRequest => ({
  ...r,
  createdAt: new Date(r.createdAt).toISOString(),
  decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
});

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** A sales officer proposes a new customer. Checks what the app sent; nothing is trusted. */
export async function createFirmRequest(
  staffUid: string,
  loginId: number | null,
  b: Record<string, unknown>,
): Promise<{ ok: true; request: FirmRequest } | { ok: false; error: string; fields?: Record<string, string> }> {
  const fields: Record<string, string> = {};
  const name = text(b.name, 120);
  const digits = text(b.phone, 20).replace(/\D/g, "");
  const phone = digits.length > 10 ? digits.slice(-10) : digits;
  const address = text(b.address, 300);
  const pincode = text(b.pincode, 10).replace(/\D/g, "");
  const gstin = text(b.gstin, 15).toUpperCase();
  const email = text(b.email, 120);
  const kind = REQUEST_KINDS.includes(b.kind as (typeof REQUEST_KINDS)[number]) ? (b.kind as string) : "Distributor";
  const lat = typeof b.lat === "number" && Math.abs(b.lat) <= 90 ? b.lat : null;
  const lng = typeof b.lng === "number" && Math.abs(b.lng) <= 180 ? b.lng : null;
  if (name.length < 3) fields.name = "Enter the shop or firm name";
  if (!/^[6-9]\d{9}$/.test(phone)) fields.phone = "Enter a valid 10-digit mobile number";
  if (address.length < 10) fields.address = "Enter the full address";
  if (pincode && pincode.length !== 6) fields.pincode = "Pincode must be 6 digits";
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) fields.gstin = "Check the GSTIN";
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fields.email = "Check the email";
  if (Object.keys(fields).length) return { ok: false, error: "Please check the highlighted details.", fields };

  // the same phone already a customer, or already waiting
  const dup = await one<{ name: string; pending: boolean }>(
    `select name, false as pending from fp_firm where regexp_replace(coalesce(phone, ''), '\\D', '', 'g') like '%' || $1
     union all select name, true from dist_firm_request where phone = $1 and status = 'pending' limit 1`,
    [phone],
  );
  if (dup) return { ok: false, error: dup.pending ? `${dup.name} with this number is already waiting for approval.` : `${dup.name} already has this number.`, fields: { phone: "Already used" } };
  const recent = await one<{ n: number }>(`select count(*)::int as n from dist_firm_request where staff_uid = $1 and created_at > now() - interval '1 day'`, [staffUid]);
  if ((recent?.n ?? 0) >= 30) return { ok: false, error: "Too many new customers today. Please call the office." };

  const r = await one<{ id: number }>(
    `insert into dist_firm_request (staff_uid, login_id, name, contact_person, phone, email, address, city, pincode, state, lat, lng, gstin, kind, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) returning id`,
    [staffUid, loginId, name, text(b.contactPerson, 80) || null, phone, email || null, address, text(b.city, 60) || null, pincode || null,
      text(b.state, 60) || null, lat, lng, gstin || null, kind, text(b.notes, 300) || null],
  );
  return { ok: true, request: iso((await one<FirmRequest>(`${SELECT} where r.id = $1`, [r!.id]))!) };
}

/** An officer's own proposals, newest first. */
export const myFirmRequests = async (staffUid: string) =>
  (await query<FirmRequest>(`${SELECT} where r.staff_uid = $1 order by r.created_at desc limit 100`, [staffUid])).map(iso);

/** For the office: pending first, then the last 60 days of decided ones. */
export const firmRequests = async () =>
  (await query<FirmRequest>(`${SELECT} where r.status = 'pending' or r.created_at > now() - interval '60 days' order by (r.status = 'pending') desc, r.created_at desc limit 300`)).map(iso);

export const pendingFirmRequests = async () => (await one<{ n: number }>(`select count(*)::int as n from dist_firm_request where status = 'pending'`))?.n ?? 0;

/**
 * Approves a proposal: the customer is created in Customer Masters (active, sales contact = the officer) with the
 * code and channel the office chose, and optionally who serves it and its beat.
 */
export async function approveFirmRequest(
  id: number,
  input: { code: string; channelUid: string; parentUid?: string | null; beatUid?: string | null },
  who: string,
): Promise<{ ok: true; firmUid: string } | { ok: false; error: string }> {
  const r = await one<FirmRequest>(`${SELECT} where r.id = $1`, [id]);
  if (!r) return { ok: false, error: "That request no longer exists." };
  if (r.status !== "pending") return { ok: false, error: `It was already ${r.status}.` };
  const f = new FormData();
  const put = (k: string, v: string | number | null | undefined) => { if (v !== null && v !== undefined && v !== "") f.set(k, String(v)); };
  put("firm_code", input.code.trim().toUpperCase());
  put("name", r.name);
  put("channel_uid", input.channelUid);
  put("firm_type", r.kind);
  put("parent_firm_uid", input.parentUid);
  put("sales_contact_uid", r.staffUid);
  put("beat_uid", input.beatUid);
  put("phone", r.phone);
  put("email", r.email);
  put("contact_person", r.contactPerson);
  // the state must be one on the masters' list: matched whatever its spelling case, else left for the office
  const state = r.state ? (await one<{ state: string }>(`select state from fp_state where lower(state) = lower($1) limit 1`, [r.state.trim()]))?.state : null;
  put("state_state", state);
  put("city", r.city);
  put("pincode", r.pincode);
  put("address", r.address);
  put("gstin", r.gstin);
  put("latitude", r.lat);
  put("longitude", r.lng);
  const saved = await saveRecord(MASTERS.distribution, null, f, who);
  if (!saved.ok) {
    const fe = "fieldErrors" in saved && saved.fieldErrors ? Object.values(saved.fieldErrors).join("; ") : "";
    return { ok: false, error: [saved.error, fe].filter(Boolean).join(" - ") || "Could not create the customer." };
  }
  await query(`update fp_firm set active = 1 where uid = $1`, [saved.id]);
  await query(
    `update dist_firm_request set status = 'approved', firm_uid = $2, decided_by = $3, decided_at = now() where id = $1 and status = 'pending'`,
    [id, saved.id, who],
  );
  return { ok: true, firmUid: saved.id };
}

export async function rejectFirmRequest(id: number, reason: string, who: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const why = reason.trim().slice(0, 300);
  if (!why) return { ok: false, error: "Give a reason, so the officer knows." };
  const r = await one<{ id: number }>(
    `update dist_firm_request set status = 'rejected', reason = $2, decided_by = $3, decided_at = now() where id = $1 and status = 'pending' returning id`,
    [id, why, who],
  );
  return r ? { ok: true } : { ok: false, error: "It was already decided." };
}
