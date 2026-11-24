import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { one, query } from "@/lib/db";
import { saveRecord } from "@/lib/masters/entity/service";
import { MASTERS } from "@/lib/masters/schemas";
import { consumeOtp } from "@/lib/employee";
import { hashPin } from "@/lib/shop/rider";
import { notifyStaff } from "@/lib/push";
import { addCustomer } from "@/lib/price-list";

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
  /** the rest of the customer master's details a distributor gives when it onboards itself (db/123) */
  landline: string | null;
  district: string | null;
  aadharNo: string | null;
  /** what the office chose when approving: the price list (null = the channel's rates), credit limit, class */
  priceListUid: string | null;
  priceList: string | null;
  creditLimit: number | null;
  firmClass: string | null;
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
         r.contact_person as "contactPerson", r.phone, r.email, r.address, r.city, r.pincode, r.state, r.lat, r.lng, r.gstin, r.area, r.pan, r.licence_no as "licenceNo", r.landline, r.district, r.aadhar_no as "aadharNo",
         r.price_list_uid as "priceListUid", sl.name as "priceList", r.credit_limit::float as "creditLimit", r.firm_class as "firmClass", r.kind, r.notes,
         r.status, r.firm_uid as "firmUid", f.firm_code as "firmCode", r.reason, r.decided_by as "decidedBy",
         r.decided_at as "decidedAt", r.created_at as "createdAt"
    from dist_firm_request r
    left join fp_staff s on s.uid = r.staff_uid
    left join fp_firm f on f.uid = r.firm_uid
    left join fp_slab sl on sl.uid = r.price_list_uid`;

const iso = (r: FirmRequest): FirmRequest => ({
  ...r,
  createdAt: new Date(r.createdAt).toISOString(),
  decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
});

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/**
 * A sales officer adds a new customer. Checks what the app sent; nothing is trusted. A retailer is added at once (no
 * approval: Customer Masters on the Retail channel, code RT + mobile, the officer as its sales contact); a distributor,
 * super stockist, MFS or institution waits for the office on New customers.
 */
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
  if (kind === "Retailer") {
    // a retailer needs no approval: added now, mapped to this officer, ready for orders
    const rt = await retailChannel();
    if (rt) {
      const done = await approveFirmRequest(r!.id, { code: await retailCode(phone), channelUid: rt }, "Sales app (retailer, automatic)", { quiet: true });
      if (!done.ok) console.error(`[customers] retailer ${phone} from the sales app stays for the office: ${done.error}`);
    }
  }
  return { ok: true, request: iso((await one<FirmRequest>(`${SELECT} where r.id = $1`, [r!.id]))!) };
}

/** The Retail channel (RT), where every retailer goes; null if it is not set up. */
const retailChannel = async () => (await one<{ uid: string }>(`select uid from fp_channel where upper(channel_code) = 'RT' order by level nulls last limit 1`))?.uid ?? null;

/** A retailer's customer code: RT + its mobile (RT<mobile>-2 ... if that is taken). */
async function retailCode(phone: string): Promise<string> {
  let code = `RT${phone}`;
  for (let i = 2; await one(`select 1 from fp_firm where upper(firm_code) = $1`, [code]); i++) code = `RT${phone}-${i}`;
  return code;
}

// ---------------------------------------------------------------- self sign-up (Gaia Distributors app)

export type SelfKind = "distributor" | "retailer";
/** ticket: what the app keeps to follow its application without signing in (signupStatus) */
type SignupResult = { ok: true; status: "pending" | "active"; ticket: string } | { ok: false; status: number; error: string; fields?: Record<string, string> };

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

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
/** Aadhaar: 12 digits, never starting with 0 or 1 */
const AADHAAR = /^[2-9]\d{11}$/;
/** a landline with its STD code (10-12 digits, starting 0 or not) */
const LANDLINE = /^0?\d{10,11}$/;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const coord = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max && v !== 0 ? v : null);

/**
 * Someone creates an account in the Gaia Distributors app (mobile proved with the SMS code, and the PIN they will sign
 * in with):
 *  - a retailer: shop name, owner, city (address, pincode, GSTIN and map pin optional). The account is ready at once:
 *    the customer is added to Customer Masters (Retail channel, code RT + mobile) and the login is switched on.
 *  - a distributor: every detail Customer Masters keeps for it - firm and owner's name, email, full address, area,
 *    city, district, state (one on the masters' list), pincode, map pin, GSTIN, PAN and FSSAI licence; landline and
 *    Aadhaar when it has them. It waits for the office on New customers - which sets its code, channel and rates - and
 *    cannot sign in until it is approved. The app follows it with the ticket returned here (signupStatus).
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
  const district = text(b.district, 60);
  const landline = text(b.landline, 20).replace(/[\s-]/g, "");
  const aadhar = text(b.aadharNo, 20).replace(/\s/g, "");
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
  if (landline && !LANDLINE.test(landline)) fields.landline = "Enter the landline with its STD code";
  if (aadhar && !AADHAAR.test(aadhar)) fields.aadharNo = "Aadhaar has 12 digits";
  // the state as Customer Masters spells it (its list), whatever case it came in
  const masterState = state ? (await one<{ state: string }>(`select state from fp_state where lower(state) = lower($1) limit 1`, [state]))?.state ?? null : null;
  if (kind === "distributor") {
    // the customer master's details: all needed before the office can approve
    if (!email) fields.email = "Enter the firm's email";
    if (address.length < 10) fields.address = "Enter the full address";
    if (area.length < 2) fields.area = "Enter the area / locality";
    if (district.length < 2) fields.district = "Enter the district";
    if (!masterState) fields.state = "Choose the state";
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

  const ticket = randomBytes(24).toString("hex");
  const r = await one<{ id: number }>(
    `insert into dist_firm_request (source, name, contact_person, phone, email, address, area, city, state, pincode, lat, lng, gstin, pan, licence_no, kind, pin_hash,
                                    landline, district, aadhar_no, ticket_hash)
     values ('app', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) returning id`,
    [name, owner, phone, email || null, address || null, area || null, city, masterState ?? (state || null), pincode || null, lat, lng,
      gstin || null, pan || null, licence || null, kind === "retailer" ? "Retailer" : "Distributor", hashPin(pin),
      landline || null, district || null, aadhar || null, sha(ticket)],
  );
  if (kind === "distributor") return { ok: true, status: "pending", ticket };

  // a retailer needs no approval: added to Customer Masters on the Retail channel and signed up at once
  const rt = await retailChannel();
  if (!rt) return { ok: true, status: "pending", ticket }; // no Retail channel set up: the office approves it as before
  const done = await approveFirmRequest(r!.id, { code: await retailCode(phone), channelUid: rt }, "Retailer sign-up (automatic)", { quiet: true });
  // should that fail the request stays pending for the office, and the retailer is told it is waiting
  return { ok: true, status: done.ok ? "active" : "pending", ticket };
}

export interface SignupStatus {
  status: "pending" | "approved" | "rejected";
  name: string;
  submittedAt: string;
  decidedAt: string | null;
  /** why the office did not approve it */
  reason: string | null;
  /** approved and its login is on: sign in with the PIN chosen while onboarding */
  canSignIn: boolean;
  /** what was sent, to fill the form again after a rejection (never the PIN) */
  details: Record<string, string | number | null>;
}

/** An application as the app follows it: by the mobile number and the ticket it was given. Null for a wrong pair. */
export async function signupStatus(phone: string, ticket: string): Promise<SignupStatus | null> {
  const p = phone.replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(p) || !/^[0-9a-f]{48}$/.test(ticket)) return null;
  const r = await one<FirmRequest & { login: boolean }>(
    `${SELECT.replace("select r.id,", "select exists (select 1 from dist_login l where l.firm_uid = r.firm_uid and l.active) as login, r.id,")}
      where r.phone = $1 and r.ticket_hash = $2 and r.source = 'app' order by r.created_at desc limit 1`,
    [p, sha(ticket)],
  );
  if (!r) return null;
  return {
    status: r.status, name: r.name, submittedAt: new Date(r.createdAt).toISOString(), decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
    reason: r.status === "rejected" ? r.reason : null,
    canSignIn: r.status === "approved" && r.login,
    details: {
      kind: r.kind === "Retailer" ? "retailer" : "distributor", firmName: r.name, ownerName: r.contactPerson, email: r.email, landline: r.landline,
      address: r.address, area: r.area, city: r.city, district: r.district, state: r.state, pincode: r.pincode, lat: r.lat, lng: r.lng,
      gstin: r.gstin, pan: r.pan, licenceNo: r.licenceNo, aadharNo: r.aadharNo, phone: r.phone,
    },
  };
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
  if (r?.status === "pending") return "Your application is with Gaia for approval. You can sign in with your PIN once it is approved - see My application.";
  if (r?.status === "rejected") {
    const why = r.reason?.trim().replace(/[.!]*$/, "");
    return `Your application was not approved${why ? `: ${why}.` : "."} Open My application to correct it and send it again.`;
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
 * The next free customer code for each channel, from the codes already used on it: its channel code and the next
 * number (MFS01 -> MFS02; none yet -> MFS001). The office can type any other.
 */
export async function nextFirmCodes(): Promise<Record<string, string>> {
  const rows = await query<{ uid: string; prefix: string; n: number | null; width: number | null }>(
    `select ch.uid::text as uid, upper(ch.channel_code) as prefix,
            max(substring(upper(f.firm_code) from '^' || upper(ch.channel_code) || '(\d+)$')::bigint) as n,
            max(length(substring(upper(f.firm_code) from '^' || upper(ch.channel_code) || '(\d+)$'))) as width
       from fp_channel ch left join fp_firm f on upper(f.firm_code) like upper(ch.channel_code) || '%'
      where coalesce(trim(ch.channel_code), '') <> ''
      group by ch.uid, ch.channel_code`,
  );
  const out: Record<string, string> = {};
  for (const r of rows) {
    let n = (r.n ?? 0) + 1;
    const width = r.width ?? 3;
    let code = `${r.prefix}${String(n).padStart(width, "0")}`;
    // the number may be used under another spelling: step on until free
    while (await one(`select 1 from fp_firm where upper(firm_code) = $1`, [code])) code = `${r.prefix}${String(++n).padStart(width, "0")}`;
    out[r.uid] = code;
  }
  return out;
}

export interface ApproveInput {
  code: string;
  channelUid: string;
  parentUid?: string | null;
  beatUid?: string | null;
  /** the sales officer who looks after it (default: the officer who proposed it) */
  salesContactUid?: string | null;
  /** its rates: a price list (Pricing > Price lists); none = its channel's rates */
  priceListUid?: string | null;
  creditLimit?: number | null;
  firmClass?: string | null;
}

/**
 * Approves a request: the customer is created in Customer Masters (active) with every detail it gave and what the
 * office chose - code, channel, who serves it, route, sales contact, credit limit, class - and put on the chosen price
 * list. A party that signed up itself gets its app login with the PIN it chose. All or nothing: should the price list
 * or the login fail, the customer is taken out again and the request stays pending with the reason.
 */
/** [quiet]: added automatically (a retailer) - the officer needs no "approved" message for what it just added. */
export async function approveFirmRequest(id: number, input: ApproveInput, who: string, opts: { quiet?: boolean } = {}): Promise<{ ok: true; firmUid: string } | { ok: false; error: string }> {
  const r = await one<FirmRequest>(`${SELECT} where r.id = $1`, [id]);
  if (!r) return { ok: false, error: "That request no longer exists." };
  if (r.status !== "pending") return { ok: false, error: `It was already ${r.status}.` };
  if (r.source === "app" && (await one(`select 1 from dist_login where phone = $1`, [r.phone]))) {
    return { ok: false, error: `${r.phone} already signs in to the app. Reject this request, or switch that login off first.` };
  }
  if (input.priceListUid && !(await one(`select 1 from fp_slab where uid = $1 and coalesce(active, 1) = 1`, [input.priceListUid]))) {
    return { ok: false, error: "That price list no longer exists." };
  }
  if (input.creditLimit != null && !(Number.isFinite(input.creditLimit) && input.creditLimit >= 0)) return { ok: false, error: "The credit limit must be 0 or more." };
  const f = new FormData();
  const put = (k: string, v: string | number | null | undefined) => { if (v !== null && v !== undefined && v !== "") f.set(k, String(v)); };
  put("firm_code", input.code.trim().toUpperCase());
  put("name", r.name);
  put("channel_uid", input.channelUid);
  put("firm_type", r.kind);
  put("parent_firm_uid", input.parentUid);
  put("sales_contact_uid", input.salesContactUid ?? r.staffUid);
  put("firm_class", input.firmClass?.trim());
  put("credit_limit", input.creditLimit);
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
  put("landline", r.landline);
  put("district", r.district);
  put("aadhar_no", r.aadharNo);
  put("latitude", r.lat);
  put("longitude", r.lng);
  const saved = await saveRecord(MASTERS.distribution, null, f, who);
  if (!saved.ok) {
    const fe = "fieldErrors" in saved && saved.fieldErrors ? Object.values(saved.fieldErrors).join("; ") : "";
    return { ok: false, error: [saved.error, fe].filter(Boolean).join(" - ") || "Could not create the customer." };
  }
  await query(`update fp_firm set active = 1 where uid = $1`, [saved.id]);
  // undone if what follows fails: the request stays pending, nothing half-made is left in Customer Masters
  const undo = async (error: string) => {
    await query(`delete from fp_slab_firm_mapping where firm_uid = $1`, [saved.id]).catch(() => null);
    await query(`delete from dist_login where firm_uid = $1`, [saved.id]).catch(() => null);
    await query(`delete from fp_firm_mapping where firm_uid = $1`, [saved.id]).catch(() => null);
    await query(`delete from fp_firm where uid = $1`, [saved.id]).catch(() => null);
    return { ok: false as const, error };
  };
  if (input.priceListUid) {
    const pl = await addCustomer(input.priceListUid, saved.id, who);
    if (!pl.ok) return undo(`Could not put it on the price list: ${pl.error}`);
  }
  // a party that signed up itself can now sign in to the Gaia Distributors app with the PIN it chose
  if (r.source === "app") {
    try {
      const made = await query(
        `insert into dist_login (kind, firm_uid, phone, pin_hash)
         select case when kind = 'Retailer' then 'retailer' else 'distributor' end, $2, phone, pin_hash
           from dist_firm_request where id = $1 and pin_hash is not null
         returning id`,
        [id, saved.id],
      );
      if (!made.length) return undo("Its sign-up has no PIN; ask them to send the application again.");
    } catch (e) {
      return undo(`Could not switch on its app login (${e instanceof Error ? e.message : String(e)}).`);
    }
  }
  await query(
    `update dist_firm_request set status = 'approved', firm_uid = $2, decided_by = $3, decided_at = now(),
            price_list_uid = $4, credit_limit = $5, firm_class = $6
      where id = $1 and status = 'pending'`,
    [id, saved.id, who, input.priceListUid ?? null, input.creditLimit ?? null, input.firmClass?.trim() || null],
  );
  // the officer who proposed it can now book orders for it
  if (!opts.quiet) await notifyStaff(r.staffUid, { title: "New customer approved", body: `${r.name} is added as ${input.code.trim().toUpperCase()}.`, data: { type: "customer" } });
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
