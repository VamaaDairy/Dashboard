/**
 * Self-test of a new distributor onboarding itself (src/lib/distributor/requests.ts, db/123): every Customer Master
 * detail required, its application followed by ticket, the office approving with its rates, and signing in with the
 * PIN it chose; a rejection corrected and sent again; retailers still instant. Local database only; it removes what it
 * makes (a test state and price list too).
 *
 *   DATABASE_URL=postgres://localhost:5432/costing_erp npx tsx db/onboarding-selftest.ts
 */
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const m = require("node:module"); const p = require.resolve("server-only");
require.cache[p] = new m.Module(p); require.cache[p].loaded = true; require.cache[p].exports = {};
let failures = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };

// the SMS code: in development the SMS is printed to the log - read it from there
let lastSms = "";
const log = console.log;
console.log = (...a: unknown[]) => { const t = a.map(String).join(" "); if (t.startsWith("[sms:dev]")) lastSms = t; else log(...a); };
const codeFromSms = () => /\b(\d{6})\b(?!.*\b\d{6}\b)/.exec(lastSms.split(": ").slice(1).join(": "))?.[1] ?? "";

(async () => {
  const { one, query, pool } = await import("@/lib/db");
  const { sendEmployeeOtp } = await import("@/lib/employee");
  const { createSelfSignup, signupStatus, selfSignupNotice, approveFirmRequest, rejectFirmRequest, createFirmRequest } = await import("@/lib/distributor/requests");
  const { distLogin, firmPrices } = await import("@/lib/distributor");

  const STATE = "Selftest Pradesh";
  const phone = `9${String(Date.now()).slice(-9)}`;
  const phone2 = `8${String(Date.now()).slice(-9)}`;
  const made = { firms: [] as string[], requests: [] as number[], list: null as string | null, phones: [phone, phone2] };
  const ch = (await one<{ uid: string }>(`select uid from fp_channel where upper(channel_code) <> 'RT' order by level desc limit 1`))!;
  const product = (await one<{ uid: string; sku: string }>(`select uid, sku_code as sku from fp_product where active = 1 and dp > 0 order by sku_code limit 1`))!;
  const staff = (await one<{ uid: string }>(`select uid from fp_staff order by first_name limit 1`))!;

  const full = {
    kind: "distributor", firmName: "Selftest Traders", ownerName: "Ravi Test", email: "ravi@selftest.in", landline: "07712345678",
    address: "12, Station Road, Near Bus Stand", area: "Civil Lines", city: "Raipur", district: "Raipur", state: STATE.toUpperCase(), pincode: "492001",
    lat: 21.25, lng: 81.63, gstin: "22AAAAA0000A1Z5", pan: "ABCDE1234F", licenceNo: "12345678901234", aadharNo: "234567890123", pin: "4826",
  };
  const otp = async (ph: string) => { await query(`delete from emp_otp where phone = $1`, [ph]); await sendEmployeeOtp(ph); return codeFromSms(); };

  try {
    await query(`insert into fp_state (region, state, code, gstin_code) values ('Test', $1, 'ST', '99')`, [STATE]);
    // a price list with this product at a price of its own
    made.list = (await one<{ uid: string }>(
      `insert into fp_slab (name, active, created_staff_uid, updated_staff_uid) values ('Selftest list', 1, $1, $1) returning uid`, [staff.uid],
    ))!.uid;
    await query(`insert into fp_slab_rate (slab_uid, product_uid, sp, dp, max_allowed_discount, active) values ($1, $2, 11.11, 11.11, 0, 1)`, [made.list, product.uid]);

    // 1. every Customer Master detail is needed, field by field
    for (const f of ["email", "address", "area", "district", "state", "pincode", "gstin", "pan", "licenceNo"] as const) {
      const r = await createSelfSignup({ ...full, phone, code: "000000", [f]: "" });
      check(!r.ok && !!(r as { fields?: Record<string, string> }).fields?.[f], `without ${f}: refused, that field marked`);
    }
    const noPin = await createSelfSignup({ ...full, phone, code: "000000", lat: 0, lng: 0 });
    check(!noPin.ok && !!(noPin as { fields?: Record<string, string> }).fields?.location, "without the map pin: refused");
    const badAadhaar = await createSelfSignup({ ...full, phone, code: "000000", aadharNo: "1234" });
    check(!badAadhaar.ok && !!(badAadhaar as { fields?: Record<string, string> }).fields?.aadharNo, "a wrong Aadhaar: refused");
    const wrongState = await createSelfSignup({ ...full, phone, code: "000000", state: "Atlantis" });
    check(!wrongState.ok && !!(wrongState as { fields?: Record<string, string> }).fields?.state, "a state not on the masters' list: refused");

    // 2. sent in full: pending, with a ticket
    const s1 = await createSelfSignup({ ...full, phone, code: await otp(phone) });
    check(s1.ok && s1.status === "pending" && s1.ok && /^[0-9a-f]{48}$/.test(s1.ticket), "a full application is saved, waiting, with its ticket");
    if (!s1.ok) throw new Error(s1.error);
    const req1 = (await one<{ id: number; state: string }>(`select id, state from dist_firm_request where phone = $1 order by id desc limit 1`, [phone]))!;
    made.requests.push(req1.id);
    check(req1.state === STATE, "its state saved as Customer Masters spells it");
    const st1 = await signupStatus(phone, s1.ticket);
    check(st1?.status === "pending" && st1.canSignIn === false && st1.details.district === "Raipur", "My application: waiting, cannot sign in yet, details there");
    check((await signupStatus(phone, "0".repeat(48))) === null && (await signupStatus(phone2, s1.ticket)) === null, "a wrong ticket or number sees nothing");
    check(/My application/.test((await selfSignupNotice(phone)) ?? ""), "signing in while waiting points to My application");
    check((await distLogin(phone, full.pin, "distributor")) === null, "no sign-in before approval");
    const again = await createSelfSignup({ ...full, phone, code: await otp(phone) });
    check(!again.ok, "a second application while one is waiting: refused");

    // 3. the office approves it on a price list: every detail in Customer Masters, its rates, its login with its own PIN
    const code = `STT${Date.now().toString().slice(-6)}`;
    const ap = await approveFirmRequest(req1.id, { code, channelUid: ch.uid, priceListUid: made.list, creditLimit: 50000, firmClass: "A", salesContactUid: staff.uid }, "Self-test");
    check(ap.ok, `approved (${ap.ok ? "" : ap.error})`);
    if (!ap.ok) throw new Error(ap.error);
    made.firms.push(ap.firmUid);
    const f = (await one<Record<string, unknown>>(
      `select name, contact_person, phone, landline, email, address, place, city, district, state_state, pincode, gstin, pan, license_no, aadhar_no,
              latitude::float as lat, credit_limit::float as credit, firm_class, sales_contact_uid::text as sc, active from fp_firm where uid = $1`, [ap.firmUid],
    ))!;
    const want: Record<string, unknown> = {
      name: full.firmName, contact_person: full.ownerName, phone, landline: full.landline, email: full.email, address: full.address, place: full.area,
      city: full.city, district: full.district, state_state: STATE, pincode: full.pincode, gstin: full.gstin, pan: full.pan, license_no: full.licenceNo,
      aadhar_no: full.aadharNo, lat: full.lat, credit: 50000, firm_class: "A", sc: staff.uid, active: 1,
    };
    const wrong = Object.entries(want).filter(([k, v]) => String(f[k]) !== String(v)).map(([k]) => `${k}=${f[k]}`);
    check(!wrong.length, `Customer Masters has every detail (${wrong.join(", ") || "all match"})`);
    const price = (await firmPrices(ap.firmUid, [product.sku]))[0];
    check(price?.source === "list" && price.price === 11.11, `its rates come from the chosen price list (${price?.source} ${price?.price})`);
    const st2 = await signupStatus(phone, s1.ticket);
    check(st2?.status === "approved" && st2.canSignIn, "My application: approved, can sign in");
    const signed = await distLogin(phone, full.pin, "distributor");
    check(!!signed && signed !== "inactive" && signed.login.firmUid === ap.firmUid, "signs in with the PIN chosen while onboarding");
    check((await distLogin(phone, "1111", "distributor")) === null, "a wrong PIN does not");

    // 4. channel rates: no price list mapping; a number already signing in stops approval with the reason
    const s2 = await createSelfSignup({ ...full, firmName: "Selftest Two", phone: phone2, code: await otp(phone2) });
    if (!s2.ok) throw new Error(s2.error);
    const req2 = (await one<{ id: number }>(`select id from dist_firm_request where phone = $1 order by id desc limit 1`, [phone2]))!;
    made.requests.push(req2.id);
    // 5. rejected: the reason shows; corrected and sent again
    check((await rejectFirmRequest(req2.id, "GSTIN does not match the firm name", "Self-test")).ok, "the office rejects one with a reason");
    const st3 = await signupStatus(phone2, s2.ticket);
    check(st3?.status === "rejected" && st3.reason === "GSTIN does not match the firm name" && st3.details.firmName === "Selftest Two", "My application: not approved, the reason and the details to correct");
    check(/correct it/.test((await selfSignupNotice(phone2)) ?? ""), "signing in after a rejection says to correct and send again");
    const s4 = await createSelfSignup({ ...full, firmName: "Selftest Two Pvt Ltd", phone: phone2, code: await otp(phone2) });
    check(s4.ok && s4.status === "pending", "sent again after correcting: waiting again");
    if (!s4.ok) throw new Error(s4.error);
    const req3 = (await one<{ id: number }>(`select id from dist_firm_request where phone = $1 order by id desc limit 1`, [phone2]))!;
    made.requests.push(req3.id);
    const ap3 = await approveFirmRequest(req3.id, { code: `${code}B`, channelUid: ch.uid }, "Self-test");
    if (ap3.ok) made.firms.push(ap3.firmUid);
    check(ap3.ok && !(await one(`select 1 from fp_slab_firm_mapping where firm_uid = $1`, [ap3.ok ? ap3.firmUid : null])), "approved on channel rates: no price list");
    // a request for a number that already signs in elsewhere: refused, nothing created
    await query(`update dist_firm_request set status = 'pending' where id = $1`, [req1.id]);
    const dup = await approveFirmRequest(req1.id, { code: `${code}C`, channelUid: ch.uid }, "Self-test");
    check(!dup.ok && /already signs in/.test(dup.error) && !(await one(`select 1 from fp_firm where firm_code = $1`, [`${code}C`])), "a number already signing in: approval stops with the reason, nothing half-made");
    await query(`update dist_firm_request set status = 'approved' where id = $1`, [req1.id]);
    // a code already in use: refused, the request stays pending
    const s5phone = `7${String(Date.now()).slice(-9)}`;
    made.phones.push(s5phone);
    const s5 = await createSelfSignup({ ...full, firmName: "Selftest Three", phone: s5phone, code: await otp(s5phone) });
    if (!s5.ok) throw new Error(s5.error);
    const req5 = (await one<{ id: number }>(`select id from dist_firm_request where phone = $1 order by id desc limit 1`, [s5phone]))!;
    made.requests.push(req5.id);
    const usedCode = await approveFirmRequest(req5.id, { code, channelUid: ch.uid }, "Self-test");
    check(!usedCode.ok && (await one<{ status: string }>(`select status from dist_firm_request where id = $1`, [req5.id]))!.status === "pending", "a customer code already used: refused, still waiting");

    // 6. retailers: still ready at once
    const rphone = `6${String(Date.now()).slice(-9)}`;
    made.phones.push(rphone);
    const r = await createSelfSignup({ kind: "retailer", firmName: "Selftest Kirana", ownerName: "Shop Owner", city: "Raipur", phone: rphone, pin: "5555", code: await otp(rphone) });
    check(r.ok && r.status === "active", "a retailer is ready at once");
    const rr = await one<{ id: number; firm_uid: string }>(`select id, firm_uid from dist_firm_request where phone = $1`, [rphone]);
    if (rr) { made.requests.push(rr.id); if (rr.firm_uid) made.firms.push(rr.firm_uid); }

    // 7. a sales officer adds a retailer: in at once, theirs; a distributor still waits for the office
    const sphone = `9${String(Date.now() + 7).slice(-9)}`;
    const dphone = `8${String(Date.now() + 7).slice(-9)}`;
    made.phones.push(sphone, dphone);
    const sr = await createFirmRequest(staff.uid, null, { name: "Selftest Corner Store", kind: "Retailer", phone: sphone, address: "Shop 4, Main Market Road" });
    const sf = sr.ok ? await one<{ code: string; channel: string; sc: string; active: number }>(
      `select f.firm_code as code, upper(ch.channel_code) as channel, f.sales_contact_uid::text as sc, f.active from fp_firm f join fp_channel ch on ch.uid = f.channel_uid where f.uid = $1`, [sr.request.firmUid],
    ) : null;
    if (sr.ok) { made.requests.push(sr.request.id); if (sr.request.firmUid) made.firms.push(sr.request.firmUid); }
    check(sr.ok && sr.request.status === "approved" && sf?.channel === "RT" && sf.code === `RT${sphone}` && sf.sc === staff.uid && sf.active === 1,
      `a retailer added by a sales officer is in at once (${sr.ok ? sr.request.status : sr.error}, ${sf?.code}, officer's)`);
    const sd = await createFirmRequest(staff.uid, null, { name: "Selftest Agencies", kind: "Distributor", phone: dphone, address: "Plot 9, Industrial Area" });
    if (sd.ok) made.requests.push(sd.request.id);
    check(sd.ok && sd.request.status === "pending" && !sd.request.firmUid, "a distributor added by a sales officer waits for the office");
  } finally {
    await query(`delete from dist_session where login_id in (select id from dist_login where phone = any($1))`, [made.phones]).catch(() => null);
    await query(`delete from dist_login where phone = any($1)`, [made.phones]);
    await query(`delete from dist_firm_request where id = any($1) or phone = any($2)`, [made.requests, made.phones]);
    await query(`delete from fp_slab_firm_mapping where firm_uid = any($1::uuid[])`, [made.firms]);
    await query(`delete from fp_firm_mapping where firm_uid = any($1::uuid[])`, [made.firms]).catch(() => null);
    await query(`delete from fp_firm where uid = any($1::uuid[])`, [made.firms]);
    if (made.list) { await query(`delete from fp_slab_rate where slab_uid = $1`, [made.list]); await query(`delete from fp_slab where uid = $1`, [made.list]); }
    await query(`delete from fp_state where state = $1`, [STATE]);
    await query(`delete from emp_otp where phone = any($1)`, [made.phones]);
    await pool.end();
  }
  log(failures ? `\n${failures} FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1); });
