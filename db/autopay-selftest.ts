/**
 * Self-test of subscriptions paid by UPI Autopay a period at a time, the first payment made while subscribing
 * (src/lib/shop/autopay.ts, src/lib/shop/packs.ts) - against a LOCAL database, with a fake Easebuzz that checks every
 * signature. Other customers' subscriptions are paused while it runs and put back after. Never run against production.
 *
 *   DATABASE_URL=postgres://localhost:5432/costing_erp_preview npx tsx --conditions=react-server db/autopay-selftest.ts
 */
import { createHash } from "node:crypto";

process.env.EASEBUZZ_KEY = "TESTKEY";
process.env.EASEBUZZ_SALT = "TESTSALT";
process.env.EASEBUZZ_ENV = "test";
process.env.AUTOPAY_FAST = "1";
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");

const sha = (...p: Array<string | number>) => createHash("sha512").update([...p.map(String), "TESTSALT"].join("|")).digest("hex");
let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failures++;
};

// ---- fake Easebuzz Autocollect ----
const mandates = new Map<string, string>(); // txn -> status
const upfrontAsked = new Map<string, number>(); // txn -> first payment asked with the access key
const upfrontDone = new Map<string, "success" | "failure">(); // txn -> how the first payment went in the UPI app
const notices = new Map<string, { status: string; amount: number }>();
const debits = new Map<string, { status: string; amount: number }>();
let failDebits = false;
const calls: string[] = [];
const fake: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  const path = url.pathname.replace(/^\/autocollect/, "");
  const auth = (init?.headers as Record<string, string>).Authorization;
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const json = (j: unknown, status = 200) => new Response(JSON.stringify(j), { status, headers: { "content-type": "application/json" } });
  const bad = (why: string) => json({ success: false, message: why }, 401);
  calls.push(`${init?.method} ${path}`);
  if (url.host !== "sandboxapi.easebuzz.in") return bad("wrong host");
  if (path === "/v1/access-key/generate/") {
    if (auth !== sha("TESTKEY", String(body.amount), body.transaction_id)) return bad("bad hash (access key)");
    if (body.frequency !== "as_presented" || body.amount_rule !== "MAX" || body.payment_modes.join() !== "UPIAD") return bad("bad mandate terms");
    if (body.upfront_presentment_amount != null && (body.upfront_presentment_amount > body.amount || body.mandate_atomicity !== true)) return bad("bad upfront");
    if (body.start_date !== new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)) return bad("upfront needs today's start date");
    mandates.set(body.transaction_id, "requested");
    if (body.upfront_presentment_amount) upfrontAsked.set(body.transaction_id, body.upfront_presentment_amount);
    return json({ success: true, access_key: `AK${body.transaction_id}` });
  }
  let m = /^\/v1\/mandate\/([^/]+)\/$/.exec(path);
  if (m && init?.method === "GET" && !["notify", "execute"].includes(m[1])) {
    if (auth !== sha("TESTKEY", m[1])) return bad("bad hash (mandate get)");
    if (!mandates.has(m[1])) return json({ success: false, message: "not found" }, 404);
    const up = upfrontAsked.has(m[1]) ? { status: upfrontDone.get(m[1]) ?? "pending", amount: upfrontAsked.get(m[1]) } : {};
    return json({ success: true, data: { id: `MR${m[1]}`, transaction_id: m[1], status: mandates.get(m[1]), mandate_type: "UPI", customer_upi_handle: "test@upi", umrn: "U1", upfront_presentment: up } });
  }
  if (path === "/v1/mandate/notify/") {
    if (auth !== sha("TESTKEY", body.transaction_id, body.notification_request_number, String(body.amount))) return bad("bad hash (notify)");
    if (mandates.get(body.transaction_id) !== "authorized") return bad("mandate not active");
    notices.set(body.notification_request_number, { status: "in_process", amount: body.amount });
    return json({ success: true, data: { status: "in_process", notification_request_number: body.notification_request_number } });
  }
  m = /^\/v1\/mandate\/notification\/([^/]+)\/$/.exec(path);
  if (m) {
    if (auth !== sha("TESTKEY", m[1])) return bad("bad hash (notification get)");
    const n = notices.get(m[1]);
    if (!n) return json({ success: false }, 404);
    n.status = "notified";
    return json({ success: true, data: { status: n.status } });
  }
  if (path === "/v1/mandate/execute/") {
    if (auth !== sha("TESTKEY", body.transaction_id, body.merchant_request_number, String(body.amount))) return bad("bad hash (execute)");
    const n = notices.get(body.notification_request_number);
    if (!n || n.status !== "notified" || n.amount !== body.amount) return bad("not notified for this amount");
    debits.set(body.merchant_request_number, { status: "in_process", amount: body.amount });
    return json({ success: true, data: { status: "in_process" } });
  }
  m = /^\/v1\/mandate\/presentment\/([^/]+)\/$/.exec(path);
  if (m) {
    if (auth !== sha("TESTKEY", m[1])) return bad("bad hash (presentment get)");
    const d = debits.get(m[1]);
    if (!d) return json({ success: false }, 404);
    d.status = failDebits ? "failure" : "success";
    return json({ success: true, data: { status: d.status, response_meta: { description: failDebits ? "INSUFFICIENT FUNDS" : "APPROVED" } } });
  }
  return bad(`unknown ${path}`);
};

async function main() {
  const { setFetcher } = await import("@/lib/payments/autocollect");
  setFetcher(fake);
  const ap = await import("@/lib/shop/autopay");
  const pk = await import("@/lib/shop/packs");
  const subs = await import("@/lib/shop/subscriptions");
  const orders = await import("@/lib/shop/orders");
  const { deliveryFor } = await import("@/lib/shop/pricing");
  const { one, query, pool } = await import("@/lib/db");

  const product = (await (await import("@/lib/shop/catalog")).listProducts())[0];
  const sku = product.sku;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const dayValue = (qty: number) => { const sub = r2(product.price * qty); return r2(sub + deliveryFor(sub, orders.deliveryRule)); };
  const today = subs.todayIST();
  let seq = 0;
  const extra: number[] = [];
  type Cust = { id: number; name: string; phone: string };
  const newCustomer = async (name: string): Promise<Cust> => {
    const phone = `9${String(Date.now()).slice(-7)}${String(seq++).padStart(2, "0")}`;
    // a 30-day period, so a daily plan's pack is 30 deliveries (the period cases below set their own)
    const c = (await one<{ id: number }>(`insert into shop_customer (name, phone, pin_hash, pack_unit, pack_len) values ($1, $2, 'x', 'days', 30) returning id`, [name, phone]))!;
    extra.push(c.id);
    return { id: c.id, name, phone };
  };
  const to = (c: { name: string; phone: string }) => ({ name: c.name, phone: c.phone, address: "Test street 1", pincode: null, lat: null, lng: null });
  const subscribe = async (c: Cust, qty: number, frequency: "daily" | "alternate" | "every_n" = "daily", start = today, everyN: number | null = null) => {
    const r = await subs.createSubscription(c.id, { sku, qty, frequency, weekdays: null, everyN, startDate: start, endDate: null }, to(c));
    if (!r.ok) throw new Error(r.error);
    return r.id;
  };
  /** what tapping Subscribe does next: the UPI app opens, the customer approves autopay and pays the first period */
  const payFirst = async (c: Cust, outcome: "success" | "failure" = "success") => {
    const m = await ap.startMandate(c);
    if (!m.ok) throw new Error(m.error);
    mandates.set(m.txnId, outcome === "success" ? "authorized" : "revoked"); // atomic: no payment, no mandate
    upfrontDone.set(m.txnId, outcome);
    await ap.refreshMandate(m.txnId);
    return m;
  };
  /** runs the autopay rounds until the customer's pack is settled (paid / unpaid / cancelled) */
  const settle = async (customerId: number) => {
    for (let i = 0; i < 40; i++) {
      await ap.runAutopay();
      const st = await pk.packState(customerId);
      if (!st.open) return st;
      await query(`update shop_charge set updated_at = now() - interval '2 hours' where customer_id = $1 and kind = 'pack' and status = any($2)`, [customerId, pk.OPEN]);
    }
    return pk.packState(customerId);
  };
  const ordersOf = (customerId: number) =>
    query<{ id: number; day: string; total: number; payment_method: string; payment_status: string; status: string }>(
      `select id, to_char(subscription_day, 'YYYY-MM-DD') as day, total::float as total, payment_method, payment_status, status
         from shop_order where customer_id = $1 and subscription_day is not null order by subscription_day`,
      [customerId],
    );
  /** makes the orders of [n] days from [from] (as the evening job would), for this customer only (others are paused) */
  const runDays = async (from: string, n: number) => {
    for (let i = 0; i < n; i++) await subs.generateOrders(subs.addDays(from, i));
  };

  // keep the database's own subscriptions out of the way
  const others = (await query<{ id: number }>(`update shop_subscription set status = 'paused' where status = 'active' returning id`)).map((r) => r.id);

  try {
    // ---------------------------------------------------------------- 1. subscribe: UPI app, first period paid at approval
    const a = await newCustomer("Autopay Test");
    check(!(await ap.startMandate(a)).ok, "nothing to pay for without a subscription");
    await subscribe(a, 2);
    const s = await ap.startMandate(a);
    check(s.ok && s.url.startsWith("https://testpay.easebuzz.in/pay/AK") && s.amount === r2(30 * dayValue(2)) && s.days === 30,
      `opens the UPI page asking ${r2(30 * dayValue(2))} for 30 deliveries (got ${s.ok ? s.amount : s.error})`);
    if (!s.ok) throw new Error("no mandate");
    check(upfrontAsked.get(s.txnId) === s.amount, "the first payment goes with the mandate (upfront), UPI only, today's start");
    check((await ap.autopayView(a.id)).state === "pending", "app sees 'pending' while the UPI app is open");
    const before0 = calls.length;
    await ap.runAutopay();
    check(!calls.slice(before0).some((c) => c.includes("notify/") || c.includes("execute/")), "the first pack is never sent the other way while the UPI app is open");
    await subs.generateOrders(today);
    check((await ordersOf(a.id)).length === 0, "no delivery before it is paid");
    mandates.set(s.txnId, "authorized");
    upfrontDone.set(s.txnId, "success");
    await ap.onWebhook({ event: "MANDATE_STATUS_UPDATE", data: { transaction_id: s.txnId, status: "rejected" } }); // post says rejected, API says done
    const st1 = await pk.packState(a.id);
    check((await ap.autopayView(a.id)).state === "active" && st1.paidDays === 30 && st1.daysLeft === 30 && !st1.open, "approved and paid in the UPI app: autopay on, 30 deliveries paid (read back, not from the post)");
    const before1 = calls.length;
    await ap.runAutopay();
    check(!calls.slice(before1).some((c) => c.includes("notify/") || c.includes("execute/")), "...and it is never debited a second time");
    check(!(await ap.startMandate(a)).ok, "a second autopay is refused while one is on");
    await runDays(today, 31);
    let o1 = await ordersOf(a.id);
    check(o1.length === 30, `exactly 30 deliveries over 31 days (got ${o1.length})`);
    check(o1.every((o) => o.payment_method === "prepaid" && o.payment_status === "paid"), "each one is prepaid: nothing to collect at the door");
    await orders.setOrderStatus(o1[5].id, "cancelled");
    check((await pk.packState(a.id)).daysLeft === 1, "a cancelled delivery gives its day back");
    await subs.generateOrders(subs.addDays(today, 31));
    o1 = await ordersOf(a.id);
    check(o1.filter((o) => o.status !== "cancelled").length === 30 && o1.at(-1)?.day === subs.addDays(today, 31), "...and that day is delivered later instead");

    // ---------------------------------------------------------------- 2. the UPI page left, or the payment failed: nothing paid, try again
    const q = await newCustomer("Left The Page");
    await subscribe(q, 1);
    const q1 = await ap.startMandate(q); // opened, never finished
    if (!q1.ok) throw new Error("no mandate");
    const qf = await payFirst(q, "failure"); // second try: payment failed in the UPI app
    const stq = await pk.packState(q.id);
    check(stq.paidDays === 0 && stq.open?.status === "pending" && (await ap.autopayView(q.id)).state !== "active", "payment failed: nothing paid, autopay not on, the pack waits");
    check((await one<{ upfront_txn: string | null }>(`select upfront_txn from shop_charge where id = $1`, [qf.ok ? stq.open!.id : 0]))?.upfront_txn === null, "...and is free for the next try");
    await ap.runAutopay();
    check(!(await pk.packState(q.id)).open || (await pk.packState(q.id)).open!.status === "pending", "never sent to the bank without autopay");
    const q3 = await payFirst(q); // third try works
    check(q3.ok && (await pk.packState(q.id)).paidDays === 30, "third try: paid");
    // the first page finished after all (customer came back to it): the money is kept as paid deliveries
    mandates.set(q1.txnId, "authorized");
    upfrontDone.set(q1.txnId, "success");
    await ap.refreshMandate(q1.txnId);
    const paidQ = await query(`select id from shop_charge where customer_id = $1 and kind = 'pack' and status = 'paid'`, [q.id]);
    check(paidQ.length === 2, "an older page paid later is never lost: it is kept as paid deliveries");
    await ap.refreshMandate(q1.txnId);
    check((await query(`select id from shop_charge where customer_id = $1 and kind = 'pack' and status = 'paid'`, [q.id])).length === 2, "...and counted once");

    // ---------------------------------------------------------------- 3. skipped days extend the pack
    const b = await newCustomer("Skip Test");
    const subB = await subscribe(b, 1);
    await payFirst(b);
    for (const d of [2, 5, 6]) await query(`insert into shop_subscription_day (subscription_id, day, qty) values ($1, $2, 0)`, [subB, subs.addDays(today, d)]);
    await runDays(today, 33);
    const ob = await ordersOf(b.id);
    check(ob.length === 30 && ob.at(-1)?.day === subs.addDays(today, 32), `3 skipped days: still 30 deliveries, the last on day 33 (got ${ob.length}, ${ob.at(-1)?.day})`);
    check(!ob.some((o) => [2, 5, 6].map((d) => subs.addDays(today, d)).includes(o.day)), "nothing delivered on the skipped days");

    // ---------------------------------------------------------------- 4. renewal by itself a few days before the end; changes settled
    const c = await newCustomer("Renew Test");
    await subscribe(c, 1);
    await payFirst(c);
    await runDays(today, 26); // 4 days left
    const oc = await ordersOf(c.id);
    await query(`update shop_order set total = total + 50 where id = $1`, [oc[3].id]); // one day had more milk (₹50 more)
    check((await pk.packState(c.id)).balance === r2(4 * dayValue(1) - 50), "balance = what is paid minus what was delivered");
    const beforeC = calls.length;
    await ap.runAutopay();
    check((await pk.packState(c.id)).open != null, "4 paid days left: the next one is raised");
    await ap.runAutopay();
    check((await query(`select id from shop_charge where customer_id = $1 and kind = 'pack' and status = any($2)`, [c.id, pk.OPEN])).length === 1, "never a second one while one is on its way");
    const stc = await settle(c.id);
    check(calls.slice(beforeC).some((x) => x.includes("notify/")) && calls.slice(beforeC).some((x) => x.includes("execute/")), "renewal: bank notice, then the debit");
    const paidRenew = (await one<{ amount: number }>(`select amount::float as amount from shop_charge where customer_id = $1 and kind = 'pack' order by id desc limit 1`, [c.id]))!;
    check(paidRenew.amount === r2(30 * dayValue(1) + 50), `renewal = next 30 days + the ₹50 extra (${r2(30 * dayValue(1) + 50)}, got ${paidRenew.amount})`);
    check(stc.daysLeft === 34, `after renewal: 4 + 30 days left (got ${stc.daysLeft})`);

    // ---------------------------------------------------------------- 5. credit covers a pack: ₹0, paid at once
    const d = await newCustomer("Credit Test");
    await subscribe(d, 1);
    await query(`insert into shop_charge (customer_id, amount, kind, days, status, paid_at) values ($1, $2, 'pack', 1, 'paid', now())`, [d.id, r2(100 * dayValue(1))]);
    const p4 = await pk.raisePack(d.id);
    check(p4?.status === "paid" && p4.amount === 0 && p4.days === 30, "credit larger than a pack: ₹0, paid at once");
    const m4 = await ap.startMandate(d);
    check(m4.ok && m4.amount === 0 && !upfrontAsked.has(m4.txnId), "...and setting up autopay then asks no first payment");

    // ---------------------------------------------------------------- 6. renewal fails: retried, then deliveries stop; Try again
    const e = await newCustomer("Fail Test");
    await subscribe(e, 1);
    await payFirst(e);
    await runDays(today, 27); // 3 days left
    failDebits = true;
    const ste = await settle(e.id);
    failDebits = false;
    const lastE = (await one<{ status: string; attempts: number }>(`select status, attempts from shop_charge where customer_id = $1 and kind = 'pack' order by id desc limit 1`, [e.id]))!;
    check(lastE.status === "unpaid" && lastE.attempts === ap.MAX_ATTEMPTS && ste.lastUnpaid, `failed renewal tried ${ap.MAX_ATTEMPTS} times, then unpaid`);
    await ap.runAutopay();
    check(!(await pk.packState(e.id)).open, "after it went unpaid, no new one by itself");
    await runDays(subs.addDays(today, 27), 5);
    check((await ordersOf(e.id)).length === 30, "deliveries stop once the paid days are used");
    check((await ap.autopayView(e.id)).pack?.unpaid === true, "app sees 'try again'");
    const again = await pk.raisePack(e.id); // what POST /api/shop/autopay/retry does
    check(again?.status === "pending", "Try again raises a new one");
    await settle(e.id);
    await runDays(subs.addDays(today, 32), 1);
    check((await ordersOf(e.id)).length === 31, "paid again: deliveries start again");

    // ---------------------------------------------------------------- 7. customer cancels: no refund, paid days delivered, then it ends
    const f = await newCustomer("Cancel Test");
    const subF = await subscribe(f, 1);
    await payFirst(f);
    await runDays(today, 10);
    check(await subs.updateSubscription(f.id, subF, { status: "cancelled" }), "customer cancels with 20 paid days left");
    const sf = (await one<{ status: string; renew: boolean; ends_after_day: number }>(`select status, renew, ends_after_day from shop_subscription where id = $1`, [subF]))!;
    check(sf.status === "active" && !sf.renew && sf.ends_after_day === 30, "it keeps running to its last paid day (30) and will not renew");
    await runDays(subs.addDays(today, 10), 25);
    await ap.runAutopay();
    check((await ordersOf(f.id)).length === 30, "all 30 paid deliveries were made");
    check(!(await pk.packState(f.id)).open, "no renewal");
    check((await one<{ status: string }>(`select status from shop_subscription where id = $1`, [subF]))!.status === "cancelled", "then the subscription ends");

    const h = await newCustomer("Resume Test");
    const subH = await subscribe(h, 1);
    await payFirst(h);
    await subs.updateSubscription(h.id, subH, { status: "cancelled" });
    await subs.updateSubscription(h.id, subH, { status: "active" });
    check((await one<{ renew: boolean }>(`select renew from shop_subscription where id = $1`, [subH]))!.renew, "un-cancelling it while it runs: it renews again");

    // ---------------------------------------------------------------- 8. a second subscription in the middle of a pack
    const k = await newCustomer("Two Subs");
    await subscribe(k, 1);
    await payFirst(k);
    await runDays(today, 10);
    await subscribe(k, 1, "alternate", subs.addDays(today, 10));
    await runDays(subs.addDays(today, 10), 2);
    const ok2 = await ordersOf(k.id);
    const items = await query<{ n: number }>(`select count(*)::int as n from shop_order_item where order_id = $1`, [ok2.at(-2)!.id]);
    check(ok2.length === 12 && items[0].n === 2, "both subscriptions in one order; still one paid day per delivery day");
    const nk = await pk.nextPack(k.id);
    check(nk != null && nk.days === 30 && nk.amount > 30 * dayValue(1), "the next payment covers both");

    // ---------------------------------------------------------------- 9. one payment above ₹15,000 is refused
    const l = await newCustomer("Limit Test");
    await query(`update shop_customer set pack_len = 45 where id = $1`, [l.id]);
    await subscribe(l, 20);
    const ml = await ap.startMandate(l);
    check(!ml.ok && /at most/.test(ml.error), `a first payment above ${ap.MAX_DEBIT} is refused, with the reason`);

    // ---------------------------------------------------------------- 10. the period the customer pays for
    check(pk.periodEnd("2027-01-15", { unit: "month", len: 1 }) === "2027-02-15" && pk.periodEnd("2027-01-31", { unit: "month", len: 1 }) === "2027-03-01"
      && pk.periodEnd("2027-01-31", { unit: "month", len: 2 }) === "2027-03-31" && pk.periodEnd("2027-01-01", { unit: "weeks", len: 4 }) === "2027-01-29",
      "period ends: a month keeps its day (31 Jan runs to the end of February), 4 weeks is 28 days");
    check(!pk.parsePeriod({ unit: "days", len: 3 }) && !pk.parsePeriod({ unit: "weeks", len: 30 }) && !pk.parsePeriod({ unit: "year", len: 1 }) && !!pk.parsePeriod({ unit: "days", len: 45 }),
      "a period of days needs 7 to 366; weeks up to 26; nothing else");
    const quoteFor = async (name: string, period: { unit: "weeks" | "month" | "days"; len: number }, frequency: "daily" | "alternate" | "every_n", everyN: number | null = null) => {
      const x = await newCustomer(name);
      await query(`update shop_customer set pack_unit = $2, pack_len = $3 where id = $1`, [x.id, period.unit, period.len]);
      await subscribe(x, 1, frequency, today, everyN);
      return { x, pack: await pk.raisePack(x.id) };
    };
    const w4 = await quoteFor("Four Weeks", { unit: "weeks", len: 4 }, "daily");
    check(w4.pack?.days === 28 && w4.pack.amount === r2(28 * dayValue(1)), `4 weeks of daily milk: 28 deliveries (got ${w4.pack?.days})`);
    const monthDays = Math.round((Date.parse(`${pk.periodEnd(today, { unit: "month", len: 1 })}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    const m1 = await quoteFor("One Month", { unit: "month", len: 1 }, "daily");
    check(m1.pack?.days === monthDays, `a month of daily milk: ${monthDays} deliveries (got ${m1.pack?.days})`);
    const c45 = await quoteFor("Custom 45", { unit: "days", len: 45 }, "alternate");
    check(c45.pack?.days === 23, `a date 45 days out, every other day: 23 deliveries (got ${c45.pack?.days})`);
    const once = await quoteFor("Once A Month", { unit: "weeks", len: 4 }, "every_n", 30);
    check(once.pack?.days === 1 && once.pack.amount === dayValue(1), `once a month, paid 4 weeks at a time: 1 delivery a payment, never an empty one (got ${once.pack?.days})`);
    const twice = await quoteFor("Twice A Month", { unit: "days", len: 30 }, "every_n", 15);
    check(twice.pack?.days === 2, `twice a month over 30 days: 2 deliveries (got ${twice.pack?.days})`);
    const m3 = await quoteFor("Three Months", { unit: "month", len: 3 }, "daily");
    check((m3.pack?.days ?? 0) >= 89 && (m3.pack?.days ?? 0) <= 92, `3 months: about 90 deliveries (got ${m3.pack?.days})`);
    await pk.setPeriod(w4.x.id, { unit: "weeks", len: 2 });
    const w2 = (await pk.packState(w4.x.id)).open;
    check(w2?.days === 14 && w2.amount === r2(14 * dayValue(1)), `changed to 2 weeks before paying: re-priced to 14 deliveries (got ${w2?.days})`);
    const pw = await payFirst(w4.x);
    check(pw.ok && pw.amount === r2(14 * dayValue(1)), "the UPI page asks the re-priced amount");
    await runDays(today, 11); // 3 left
    await ap.runAutopay();
    check((await pk.packState(w4.x.id)).open?.days === 14, "renewal pays the same 2 weeks again");

    // ---------------------------------------------------------------- 10b. the UPI page could not be opened: subscription and its payment dropped
    const y = await newCustomer("Page Failed");
    const subY = await subscribe(y, 1);
    const py = await pk.raisePack(y.id);
    await query(`delete from shop_subscription where id = $1`, [subY]); // what the subscribe route does when Easebuzz refuses
    await pk.refreshPack(py!.id, y.id);
    check((await one<{ status: string }>(`select status from shop_charge where id = $1`, [py!.id]))!.status === "cancelled", "the payment it was going to ask for is dropped too");

    // ---------------------------------------------------------------- 11. no autopay, no delivery (no cash for subscriptions)
    const w = await newCustomer("No Autopay");
    await subscribe(w, 1);
    await subs.generateOrders(today);
    check((await ordersOf(w.id)).length === 0, "a subscription without autopay gets no order");

    // ---------------------------------------------------------------- 12. autopay cancelled in the UPI app
    const z = await newCustomer("Cancelled In App");
    await subscribe(z, 1);
    const zm = await payFirst(z);
    if (!zm.ok) throw new Error("no mandate");
    mandates.set(zm.txnId, "cancelled");
    await ap.refreshMandate(zm.txnId);
    check((await ap.autopayView(z.id)).state === "none", "autopay cancelled in the UPI app: off");
  } finally {
    for (const id of extra) {
      await query(`delete from shop_order where customer_id = $1`, [id]);
      await query(`delete from shop_customer where id = $1`, [id]);
    }
    if (others.length) await query(`update shop_subscription set status = 'active' where id = any($1)`, [others]);
    await pool.end();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
