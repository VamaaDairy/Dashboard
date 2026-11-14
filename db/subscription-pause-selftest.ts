/**
 * Self-test of pausing a subscription after tomorrow's order is already made (src/lib/shop/subscriptions.ts,
 * refreshMadeOrders) against a LOCAL database. Never run against production.
 *
 *   DATABASE_URL=postgres://localhost:5432/costing_erp_preview npx tsx --conditions=react-server db/subscription-pause-selftest.ts
 */
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failures++;
};

async function main() {
  const subs = await import("@/lib/shop/subscriptions");
  const { one, query, pool } = await import("@/lib/db");

  const products = await (await import("@/lib/shop/catalog")).listProducts();
  if (products.length < 2) throw new Error("Needs two D2C products on sale.");
  const [a, b] = products;
  const phone = `9${String(Date.now()).slice(-9)}`;
  const cust = (await one<{ id: number }>(`insert into shop_customer (name, phone, pin_hash) values ('Pause Test', $1, 'x') returning id`, [phone]))!;
  const to = { name: "Pause Test", phone, address: "Test street 1", pincode: null, lat: null, lng: null };
  const day = subs.firstEditableDay();
  const order = () =>
    one<{ id: number; status: string; total: number; items: Array<{ sku: string; qty: number }> }>(
      `select o.id, o.status, o.total::float as total,
              coalesce((select json_agg(json_build_object('sku', i.sku_code, 'qty', i.qty) order by i.sku_code) from shop_order_item i where i.order_id = o.id), '[]') as items
         from shop_order o where o.customer_id = $1 and o.subscription_day = $2`,
      [cust.id, day],
    );

  try {
    const s1 = await subs.createSubscription(cust.id, { sku: a.sku, qty: 2, frequency: "daily", weekdays: null, everyN: null, startDate: day, endDate: null }, to);
    const s2 = await subs.createSubscription(cust.id, { sku: b.sku, qty: 1, frequency: "daily", weekdays: null, everyN: null, startDate: day, endDate: null }, to);
    if (!s1.ok || !s2.ok) throw new Error("could not create the subscriptions");

    // the 9 PM run has made the day's order
    await subs.generateOrders(day);
    let o = await order();
    check(o?.status === "confirmed" && o.items.length === 2, "the day's order is made with both products");

    // pausing one takes only it out of the made order
    const fullTotal = o!.total;
    await subs.updateSubscription(cust.id, s1.id, { status: "paused" });
    o = await order();
    check(o?.status === "confirmed" && o.items.length === 1 && o.items[0].sku === b.sku, "pausing one subscription removes just its product");
    check(!!o && o.total < fullTotal && o.total >= b.price, "the order total is worked out again");

    // pausing the last one cancels the order
    await subs.updateSubscription(cust.id, s2.id, { status: "paused" });
    o = await order();
    check(o?.status === "cancelled", "with every subscription paused the made order is cancelled");

    // the 10-minute timer must not make it again while paused
    await subs.generateOrders(day);
    check((await query(`select 1 from shop_order where customer_id = $1 and subscription_day = $2`, [cust.id, day])).length === 1 && (await order())?.status === "cancelled", "no new order while paused");

    // resuming brings the order back
    await subs.updateSubscription(cust.id, s1.id, { status: "active" });
    o = await order();
    check(o?.status === "confirmed" && o.items.length === 1 && o.items[0].sku === a.sku && o.items[0].qty === 2, "resuming puts the order back with that product");

    // an order already with a rider is left alone
    await query(`update shop_order set rider_id = (select id from shop_rider order by id limit 1) where customer_id = $1 and subscription_day = $2`, [cust.id, day]);
    const withRider = (await one<{ r: number | null }>(`select rider_id as r from shop_order where customer_id = $1 and subscription_day = $2`, [cust.id, day]))!;
    if (withRider.r !== null) {
      await subs.updateSubscription(cust.id, s1.id, { status: "paused" });
      check((await order())?.status === "confirmed", "an order already with a rider is not changed by a pause");
    } else console.log("SKIP  no rider in this database to test the rider case");
  } finally {
    await query(`delete from shop_order where customer_id = $1`, [cust.id]);
    await query(`delete from shop_subscription where customer_id = $1`, [cust.id]);
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
