import "server-only";
import { one, query } from "@/lib/db";
import { saveRecord } from "@/lib/masters/entity/service";
import { MASTERS } from "@/lib/masters/schemas";
import { consumeOtp } from "@/lib/employee";
import { hashPin } from "@/lib/shop/rider";
import { notifyStaff } from "@/lib/push";

/**
 * New customers a sales officer proposes from the Sales app (db/104 dist_firm_request). Nothing is added to Customer
 * Masters until the office approves it; approving creates the customer - active, mapped to that officer - with the
 * code and channel the office gives it.
 *
 * Distributors and retailers can also ask for an account themselves in the Gaia Distributors app (source "app",
 * db/105): approving that also switches on their app login with the PIN they chose.
 */

export const REQUEST_KINDS = ["Distributor", "Super Stockist", "Retailer", "MFS", "Institution"] as const;

export interface FirmRequest {
  id: number;
  /** null for a party that signed up itself in the Gaia Distributors app */
  staffUid: string | null;
  source: "sales" | "app";
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
  /** given by a distributor that signs up itself in the app */
  area: string | null;
  pan: string | null;
  licenceNo: string | null;
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
  select r.id, r.staff_uid as "staffUid", r.source, nullif(trim(concat_ws(' ', s.first_name, s.last_name)), '') as officer, r.name,
         r.contact_person as "contactPerson", r.phone, r.email, r.address, r.city, r.pincode, r.state, r.lat, r.lng, r.gstin, r.area, r.pan, r.licence_no as "licenceNo", r.kind, r.notes,
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

// ---------------------------------------------------------------- self sign-up (Gaia Distributors app)

export type SelfKind = "distributor" | "retailer";
type SignupResult = { ok: true; status: "pending" | "active" } | { ok: false; status: number; error: string; fields?: Record<string, string> };

/**
 * Why this number cannot ask for an account, or null when it can: it already signs in, or it is already waiting.
 * Checked before the SMS code is sent and again when the request is made.
 */
export async function selfSignupBlocked(phone: string): Promise<string | null> {
  const login = await one(`select 1 from dist_login where phone = $1`, [phone]);
  if (login) return "This number already has an account. Please sign in.";
  const firm = await one<{ name: string }>(
    `select name from fp_firm where right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = $1 limit 1`,
    [phone],
  );
  if (firm) return `This number is already with Gaia (${firm.name}). Please ask Gaia for your PIN.`;
  const waiting = await one(`select 1 from dist_firm_request where phone = $1 and status = 'pending'`, [phone]);
  if (waiting) return "Your account request is already waiting for Gaia's approval.";
  return null;
}

const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const coord = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max && v !== 0 ? v : null);

/**
 * Someone creates an account in the Gaia Distributors app (mobile proved with the SMS code, and the PIN they will sign
 * in with):
 *  - a retailer: shop name, owner, city (address, pincode, GSTIN and map pin optional). The account is ready at once:
 *    the customer is added to Customer Masters (Retail channel, code RT + mobile) and the login is switched on.
 *  - a distributor: every detail the customer master needs - firm and owner's name, full address, area, city, state,
 *    pincode, GSTIN, PAN, FSSAI licence and the map pin (email optional). It waits for the office on App orders >
 *    New customers, and cannot sign in until it is approved.
 */
export async function createSelfSignup(b: Record<string, unknown>): Promise<SignupResult> {
  const kind: SelfKind | null = b.kind === "distributor" || b.kind === "retailer" ? b.kind : null;
  const name = text(b.firmName, 120);
  const owner = text(b.ownerName, 80);
  const city = text(b.city, 60);
  const phone = text(b.phone, 20).replace(/\D/g, "").slice(-10);
  const code = text(b.code, 10).replace(/\D/g, "");
  const pin = text(b.pin, 10);
  const address = text(b.address, 300);
  const area = text(b.area, 80);
  const state = text(b.state, 60);
  const pincode = text(b.pincode, 10).replace(/\D/g, "");
  const gstin = text(b.gstin, 15).toUpperCase();
  const pan = text(b.pan, 10).toUpperCase();
  const licence = text(b.licenceNo, 30).replace(/\s/g, "");
  const email = text(b.email, 120);
  const lat = coord(b.lat, 90);
  const lng = coord(b.lng, 180);
  const fields: Record<string, string> = {};
  if (!kind) return { ok: false, status: 400, error: "Choose Distributor or Retailer." };
  if (name.length < 3) fields.firmName = kind === "retailer" ? "Enter your shop's name" : "Enter your firm's name";
  if (owner.length < 2) fields.ownerName = "Enter the owner's name";
  if (city.length < 2) fields.city = "Enter your city";
  if (!/^[6-9]\d{9}$/.test(phone)) fields.phone = "Enter a valid 10-digit mobile number";
  if (!/^\d{4,8}$/.test(pin)) fields.pin = "The PIN must be 4 to 8 digits";
  if (pincode && pincode.length !== 6) fields.pincode = "Pincode must be 6 digits";
  if (gstin && !GSTIN.test(gstin)) fields.gstin = "Check the GSTIN";
  if (pan && !PAN.test(pan)) fields.pan = "Check the PAN (like ABCDE1234F)";
  if (licence && !/^\d{14}$/.test(licence)) fields.licenceNo = "The FSSAI licence number has 14 digits";
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fields.email = "Check the email";
  if (kind === "distributor") {
    // the customer master's details: all needed before the office can approve
    if (address.length < 10) fields.address = "Enter the full address";
    if (area.length < 2) fields.area = "Enter the area / locality";
    if (state.length < 2) fields.state = "Choose the state";
    if (pincode.length !== 6) fields.pincode = "Enter the 6-digit pincode";
    if (!gstin) fields.gstin = "Enter the GSTIN";
    if (!pan) fields.pan = "Enter the PAN";
    if (!licence) fields.licenceNo = "Enter the FSSAI licence number";
    if (lat === null || lng === null) fields.location = "Mark the firm's location on the map";
  }
  if (Object.keys(fields).length) return { ok: false, status: 400, error: Object.values(fields)[0], fields };
  if (code.length !== 6) return { ok: false, status: 400, error: "Enter the 6-digit code we sent by SMS." };

  const blocked = await selfSignupBlocked(phone);
  if (blocked) return { ok: false, status: 409, error: blocked };
  if (!(await consumeOtp(phone, code))) return { ok: false, status: 401, error: "That code is wrong or has expired. Ask for a new one." };

  const r = await one<{ id: number }>(
    `insert into dist_firm_request (source, name, contact_person, phone, email, address, area, city, state, pincode, lat, lng, gstin, pan, licence_no, kind, pin_hash)
     values ('app', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) returning id`,
    [name, owner, phone, email || null, address || null, area || null, city, state || null, pincode || null, lat, lng,
      gstin || null, pan || null, licence || null, kind === "retailer" ? "Retailer" : "Distributor", hashPin(pin)],
  );
  if (kind === "distributor") return { ok: true, status: "pending" };

  // a retailer needs no approval: added to Customer Masters on the Retail channel and signed up at once
  const rt = await one<{ uid: string }>(`select uid from fp_channel where upper(channel_code) = 'RT' order by level nulls last limit 1`);
  if (!rt) return { ok: true, status: "pending" }; // no Retail channel set up: the office approves it as before
  let firmCode = `RT${phone}`;
  for (let i = 2; await one(`select 1 from fp_firm where upper(firm_code) = $1`, [firmCode]); i++) firmCode = `RT${phone}-${i}`;
  const done = await approveFirmRequest(r!.id, { code: firmCode, channelUid: rt.uid }, "Retailer sign-up (automatic)");
  // should that fail the request stays pending for the office, and the retailer is told it is waiting
  return { ok: true, status: done.ok ? "active" : "pending" };
}

/**
 * What to tell someone signing in whose number has no login yet but did ask for one: still waiting, or not approved
 * (with the office's reason). Null when there is nothing to say.
 */
export async function selfSignupNotice(phone: string): Promise<string | null> {
  const r = await one<{ status: string; reason: string | null }>(
    `select status, reason from dist_firm_request where phone = $1 and source = 'app' order by created_at desc limit 1`,
    [phone],
  );
  if (r?.status === "pending") return "Your account is waiting for Gaia's approval. You can sign in once it is approved.";
  if (r?.status === "rejected") {
    const why = r.reason?.trim().replace(/[.!]*$/, "");
    return `Your account request was not approved${why ? `: ${why}.` : "."} Please contact Gaia.`;
  }
  return null;
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
  if (r.source === "app" && (await one(`select 1 from dist_login where phone = $1`, [r.phone]))) {
    return { ok: false, error: `${r.phone} already signs in to the app. Reject this request, or switch that login off first.` };
  }
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
  put("place", r.area);
  put("gstin", r.gstin);
  put("pan", r.pan);
  put("license_no", r.licenceNo);
  put("latitude", r.lat);
  put("longitude", r.lng);
  const saved = await saveRecord(MASTERS.distribution, null, f, who);
  if (!saved.ok) {
    const fe = "fieldErrors" in saved && saved.fieldErrors ? Object.values(saved.fieldErrors).join("; ") : "";
    return { ok: false, error: [saved.error, fe].filter(Boolean).join(" - ") || "Could not create the customer." };
  }
  await query(`update fp_firm set active = 1 where uid = $1`, [saved.id]);
  // a party that signed up itself can now sign in to the Gaia Distributors app with the PIN it chose
  if (r.source === "app") {
    await query(
      `insert into dist_login (kind, firm_uid, phone, pin_hash)
       select case when kind = 'Retailer' then 'retailer' else 'distributor' end, $2, phone, pin_hash
         from dist_firm_request where id = $1 and pin_hash is not null
       on conflict do nothing`,
      [id, saved.id],
    );
  }
  await query(
    `update dist_firm_request set status = 'approved', firm_uid = $2, decided_by = $3, decided_at = now() where id = $1 and status = 'pending'`,
    [id, saved.id, who],
  );
  // the officer who proposed it can now book orders for it
  await notifyStaff(r.staffUid, { title: "New customer approved", body: `${r.name} is added as ${input.code.trim().toUpperCase()}.`, data: { type: "customer" } });
  return { ok: true, firmUid: saved.id };
}

export async function rejectFirmRequest(id: number, reason: string, who: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const why = reason.trim().slice(0, 300);
  if (!why) return { ok: false, error: "Give a reason, so they know why." };
  const r = await one<{ id: number; staff_uid: string | null; name: string }>(
    `update dist_firm_request set status = 'rejected', reason = $2, decided_by = $3, decided_at = now() where id = $1 and status = 'pending' returning id, staff_uid, name`,
    [id, why, who],
  );
  if (!r) return { ok: false, error: "It was already decided." };
  await notifyStaff(r.staff_uid, { title: "New customer not approved", body: `${r.name}: ${why}`, data: { type: "customer" } });
  return { ok: true };
}
