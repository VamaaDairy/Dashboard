/**
 * Self-test of UPI Autopay for subscriptions (src/lib/shop/autopay.ts) against a LOCAL database, with a fake
 * Easebuzz that checks every signature. Never run against production.
 *
 *   DATABASE_URL=postgres://localhost:5432/costing_erp_preview npx tsx --conditions=react-server db/autopay-selftest.ts
 */
import { createHash } from "node:crypto";

process.env.EASEBUZZ_KEY = "TESTKEY";
process.env.EASEBUZZ_SALT = "TESTSALT";
process.env.EASEBUZZ_ENV = "test";
process.env.AUTOPAY_FAST = "1";
process.env.AUTOPAY_ENABLED = "1";
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");

const sha = (...p: Array<string | number>) => createHash("sha512").update([...p.map(String), "TESTSALT"].join("|")).digest("hex");
let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failures++;
};

// ---- fake Easebuzz Autocollect ----
const mandates = new Map<string, string>(); // txn -> status
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
    if (body.frequency !== "as_presented" || body.amount_rule !== "MAX" || body.payment_modes[0] !== "UPIAD") return bad("bad mandate terms");
    mandates.set(body.transaction_id, "requested");
    return json({ success: true, access_key: `AK${body.transaction_id}` });
  }
  let m = /^\/v1\/mandate\/([^/]+)\/$/.exec(path);
  if (m && init?.method === "GET" && !["notify", "execute"].includes(m[1])) {
    if (auth !== sha("TESTKEY", m[1])) return bad("bad hash (mandate get)");
    if (!mandates.has(m[1])) return json({ success: false, message: "not found" }, 404);
    return json({ success: true, data: { id: `MR${m[1]}`, transaction_id: m[1], status: mandates.get(m[1]), customer_upi_handle: "test@upi", umrn: "U1" } });
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
  const subs = await import("@/lib/shop/subscriptions");
  const orders = await import("@/lib/shop/orders");
  const { one, query, pool } = await import("@/lib/db");

  const sku = (await (await import("@/lib/shop/catalog")).listProducts())[0].sku;
  const phone = `9${String(Date.now()).slice(-9)}`;
  const cust = (await one<{ id: number }>(`insert into shop_customer (name, phone, pin_hash) values ('Autopay Test', $1, 'x') returning id`, [phone]))!;
  const backdate = (id: number) => query(`update shop_charge set updated_at = now() - interval '10 minutes' where id = $1`, [id]);

  try {
    // 1. set up the mandate
    const s = await ap.startMandate({ id: cust.id, name: "Autopay Test", phone });
    check(s.ok && s.url.startsWith("https://testpay.easebuzz.in/pay/AK"), "mandate start returns Easebuzz's approval page");
    if (!s.ok) throw new Error("no mandate");
    check((await ap.autopayView(cust.id)).state === "pending", "app sees 'pending' while waiting for the UPI app");
    mandates.set(s.txnId, "authorized");
    await ap.onWebhook({ event: "MANDATE_STATUS_UPDATE", data: { transaction_id: s.txnId, status: "rejected" } }); // post says rejected, API says authorized
    check((await ap.autopayView(cust.id)).state === "active", "webhook reads the status back from Easebuzz (not from the post)");
    check(!(await ap.startMandate({ id: cust.id, name: "Autopay Test", phone })).ok, "a second mandate is refused while one is active");

    // 2. subscription orders become autopay orders
    const day = subs.todayIST();
    const sub = await subs.createSubscription(cust.id, { sku, qty: 2, frequency: "daily", weekdays: null, everyN: null, startDate: day, endDate: null }, { name: "Autopay Test", phone, address: "Test street 1", pincode: null, lat: null, lng: null });
    if (!sub.ok) throw new Error(sub.error);
    await subs.generateOrders(day);
    const o = (await one<{ id: number; payment_method: string; total: number }>(`select id, payment_method, total::float as total from shop_order where customer_id = $1 and subscription_day = $2`, [cust.id, day]))!;
    check(o?.payment_method === "autopay", "the day's subscription order is an autopay order");

    // 3. delivered: stays unpaid until the debit, and becomes a charge
    await orders.setOrderStatus(o.id, "delivered");
    const afterDeliver = (await one<{ payment_status: string }>(`select payment_status from shop_order where id = $1`, [o.id]))!;
    check(afterDeliver.payment_status === "pending", "delivered autopay order is not marked paid at the door");
    let ch = (await one<{ id: number; status: string; amount: number }>(`select id, status, amount::float as amount from shop_charge where order_id = $1`, [o.id]))!;
    check(ch?.status === "pending" && ch.amount === o.total, "delivery creates a pending charge for the order total");

    // 4. evening: notice -> notified -> debit -> paid
    await ap.runAutopay();
    ch = (await one(`select id, status, amount::float as amount from shop_charge where id = $1`, [ch.id]))!;
    check(ch.status === "notifying", "notice sent to the bank");
    await backdate(ch.id);
    await ap.runAutopay();
    ch = (await one(`select id, status, amount::float as amount from shop_charge where id = $1`, [ch.id]))!;
    check(ch.status === "presenting", "after the notice is confirmed, the debit is raised (fast mode skips the 24 h)");
    await backdate(ch.id);
    await ap.runAutopay();
    const done = (await one<{ status: string; ps: string }>(`select c.status, o.payment_status as ps from shop_charge c join shop_order o on o.id = c.order_id where c.id = $1`, [ch.id]))!;
    check(done.status === "paid" && done.ps === "paid", "debit success marks the charge and the order paid");
    const before = calls.length;
    await ap.runAutopay();
    check(!calls.slice(before).some((c) => c.includes("execute") || c.includes("notify/")), "a paid charge is never notified or debited again");

    // 5. failing debits: retried, then 'unpaid'
    failDebits = true;
    const day2 = subs.addDays(day, 1);
    await subs.generateOrders(day2);
    const o2 = (await one<{ id: number }>(`select id from shop_order where customer_id = $1 and subscription_day = $2`, [cust.id, day2]))!;
    await orders.setOrderStatus(o2.id, "delivered");
    const c2 = (await one<{ id: number }>(`select id from shop_charge where order_id = $1`, [o2.id]))!;
    for (let i = 0; i < ap.MAX_ATTEMPTS * 3 + 2; i++) {
      await ap.runAutopay();
      await backdate(c2.id);
    }
    const f = (await one<{ status: string; attempts: number; failure: string }>(`select status, attempts, failure from shop_charge where id = $1`, [c2.id]))!;
    check(f.status === "unpaid" && f.attempts === ap.MAX_ATTEMPTS, `failed debit retried ${ap.MAX_ATTEMPTS} times, then unpaid (${f.status}, ${f.attempts} tries)`);
    check(/INSUFFICIENT/.test(f.failure ?? ""), "the bank's reason is kept");
    check((await ap.autopayView(cust.id)).unpaid > 0, "app sees the unpaid amount");

    // 6. mandate cancelled in the UPI app: no more debits
    failDebits = false;
    const day3 = subs.addDays(day, 2);
    await subs.generateOrders(day3);
    const o3 = (await one<{ id: number }>(`select id from shop_order where customer_id = $1 and subscription_day = $2`, [cust.id, day3]))!;
    await orders.setOrderStatus(o3.id, "delivered");
    const c3 = (await one<{ id: number }>(`select id from shop_charge where order_id = $1`, [o3.id]))!;
    await ap.runAutopay(); // notice
    await backdate(c3.id);
    await ap.runAutopay(); // notified, then debit due
    mandates.set(s.txnId, "cancelled");
    await query(`update shop_charge set status = 'notified' where id = $1 and status = 'presenting'`, [c3.id]); // as if the debit was not raised yet
    await ap.runAutopay();
    const g = (await one<{ status: string }>(`select status from shop_charge where id = $1`, [c3.id]))!;
    check(g.status === "unpaid", "a mandate cancelled in the UPI app stops the debit (charge unpaid)");
    check((await ap.autopayView(cust.id)).state === "none", "app sees autopay as stopped");

    // 7. autopay required: no mandate -> no subscription order
    process.env.AUTOPAY_REQUIRED = "1";
    const day4 = subs.addDays(day, 3);
    await subs.generateOrders(day4);
    check(!(await one(`select 1 from shop_order where customer_id = $1 and subscription_day = $2`, [cust.id, day4])), "with autopay required, a customer without it gets no subscription order");
  } finally {
    await query(`delete from shop_order where customer_id = $1`, [cust.id]);
    await query(`delete from shop_customer where id = $1`, [cust.id]);
    await pool.end();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
