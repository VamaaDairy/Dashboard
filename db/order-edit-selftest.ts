/**
 * Self-test of changing one order from both apps (src/lib/orders/direct.ts): the buyer adds products to an order its
 * sales officer booked, the officer changes the buyer's own order, both read who did what, and the limits hold.
 * Local database only; everything it makes is removed again.
 *
 *   DATABASE_URL=postgres://localhost:5432/costing_erp npx tsx db/order-edit-selftest.ts
 */
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");
const m = require("node:module"); const p = require.resolve("server-only");
require.cache[p] = new m.Module(p); require.cache[p].loaded = true; require.cache[p].exports = {};
let failures = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };
(async () => {
  const { one, query, pool } = await import("@/lib/db");
  const { placeDistOrder, catalogFor } = await import("@/lib/distributor");
  const { editOrderFromApp, cancelOrderFromApp, appOrderExtras } = await import("@/lib/orders/direct");
  // a distributor and a retailer that have priced products locally, and a sales officer for them
  const dist = (await one<{ uid: string; name: string }>(`select f.uid, f.name from fp_firm f join fp_channel ch on ch.uid = f.channel_uid where f.active = 1 and upper(ch.channel_code) <> 'RT' and ch.level > 1 and exists (select 1 from fp_booking_order b where b.from_firm_uid = f.uid) order by f.name limit 1`))!;
  const retail = await one<{ uid: string; name: string }>(`select f.uid, f.name from fp_firm f join fp_channel ch on ch.uid = f.channel_uid where f.active = 1 and upper(ch.channel_code) = 'RT' order by f.name limit 1`);
  const staff = (await one<{ uid: string }>(`select uid from fp_staff where active = 1 order by first_name limit 1`))!;
  const other = { uid: crypto.randomUUID() }; // an officer with none of these parties
  const keepContact = await query<{ uid: string; sc: string | null }>(`select uid, sales_contact_uid as sc from fp_firm where uid = any($1)`, [[dist.uid, retail?.uid].filter(Boolean)]);
  await query(`update fp_firm set sales_contact_uid = $2 where uid = any($1)`, [[dist.uid, retail?.uid].filter(Boolean), staff.uid]);
  const so = { id: 0, kind: "salesman", firmUid: null, staffUid: staff.uid, name: "Test Officer", phone: "" } as const;
  const stranger = { ...so, staffUid: other.uid, name: "Other Officer" };
  const buyer = { id: 0, kind: "distributor", firmUid: dist.uid, staffUid: null, name: dist.name, phone: "" } as const;
  const made: number[] = [];
  try {
    const cat = ((await catalogFor(buyer as never, dist.uid)) ?? []) as Array<{ sku: string }>;
    check(cat.length >= 2, `the distributor has at least 2 priced products locally (${cat.length})`);
    const [a, b2] = [cat[0].sku, cat[1].sku];
    // 1. the sales officer books an order; the distributor adds a product and changes a quantity on it
    const o1 = await placeDistOrder(so as never, { firmUid: dist.uid, lines: [{ sku: a, qty: 10 }] });
    check(o1.ok, "the sales officer books an order");
    if (!o1.ok) throw new Error(o1.error);
    made.push(o1.orderId);
    await query(`update fp_booking_order set delivery_date = current_date + 3 where order_id = $1`, [o1.orderId]);
    const e1 = await editOrderFromApp(buyer as never, o1.orderId, new Map([[a, 12], [b2, 5]]));
    check(e1.ok, "the distributor adds a product and raises a quantity on the officer's order");
    const lines1 = await query<{ sku: string; qty: number }>(`select p.sku_code as sku, i.quantity::int as qty from fp_booking_order_item i join fp_product p on p.uid = i.product_uid join fp_booking_order b on b.uid = i.booking_order_uid where b.order_id = $1 order by 1`, [o1.orderId]);
    check(lines1.length === 2 && lines1.some((l) => l.sku === b2 && l.qty === 5), "the same order now has both products");
    // 2. the distributor places its own order; the sales officer lowers a quantity on it
    const o2 = await placeDistOrder(buyer as never, { firmUid: dist.uid, lines: [{ sku: a, qty: 20 }, { sku: b2, qty: 4 }] });
    if (!o2.ok) throw new Error(o2.error);
    made.push(o2.orderId);
    await query(`update fp_booking_order set delivery_date = current_date + 3 where order_id = $1`, [o2.orderId]);
    const e2 = await editOrderFromApp(so as never, o2.orderId, new Map([[a, 15], [b2, 4]]));
    check(e2.ok, "the sales officer lowers a quantity on the distributor's own order");
    // 3. who did what, as each side reads it
    const uid1 = (await one<{ uid: string }>(`select uid from fp_booking_order where order_id = $1`, [o1.orderId]))!.uid;
    const asBuyer = (await appOrderExtras([uid1])).get(uid1)!;
    const asOfficer = (await appOrderExtras([uid1], { kind: "salesman", name: "Test Officer" })).get(uid1)!;
    const actors = (h: typeof asBuyer.history) => h.map((e) => `${e.action}:${e.actor}`).join(", ");
    console.log("      buyer sees:  ", actors(asBuyer.history));
    console.log("      officer sees:", actors(asOfficer.history));
    check(asBuyer.history.some((e) => e.action === "placed" && e.actor === "Sales officer Test Officer") && asBuyer.history.some((e) => e.action === "edited" && e.actor === "You"), "the buyer sees the officer's booking by name and its own change as You");
    check(asOfficer.history.some((e) => e.action === "placed" && e.actor === "You") && asOfficer.history.some((e) => e.action === "edited" && e.actor === dist.name), "the officer sees its booking as You and the distributor's change by name");
    const ev = asBuyer.history.find((e) => e.action === "edited");
    check(!!ev?.changes?.length, `the change is logged line by line (${JSON.stringify(ev?.changes)})`);
    check(!!asBuyer.editableUntil && !!asOfficer.editableUntil, "both see it can still be changed (until the cutoff)");
    // 4. limits
    const s1 = await editOrderFromApp(stranger as never, o1.orderId, new Map([[a, 1]]));
    check(!s1.ok, "another officer (not their party) cannot change it");
    const c1 = await cancelOrderFromApp(so as never, o1.orderId);
    check(!c1.ok, "the sales officer cannot cancel; the buyer or Gaia does");
    // 5. a retailer's order booked by the officer stays at the retail price when changed
    if (retail) {
      const rcat = ((await catalogFor({ ...buyer, kind: "retailer", firmUid: retail.uid } as never, retail.uid)) ?? []) as Array<{ sku: string }>;
      if (rcat.length) {
        const o3 = await placeDistOrder(so as never, { firmUid: retail.uid, lines: [{ sku: rcat[0].sku, qty: 3 }] });
        if (o3.ok) {
          made.push(o3.orderId);
          await query(`update fp_booking_order set delivery_date = current_date + 3 where order_id = $1`, [o3.orderId]);
          const before = (await one<{ r: number }>(`select i.selling_price::float as r from fp_booking_order_item i join fp_booking_order b on b.uid = i.booking_order_uid where b.order_id = $1`, [o3.orderId]))!.r;
          const e3 = await editOrderFromApp(so as never, o3.orderId, new Map([[rcat[0].sku, 6]]));
          const after = (await one<{ r: number }>(`select i.selling_price::float as r from fp_booking_order_item i join fp_booking_order b on b.uid = i.booking_order_uid where b.order_id = $1`, [o3.orderId]))!.r;
          check(e3.ok && before === after, `a retailer's order keeps its retail price when changed (${before} -> ${after})`);
        } else console.log("SKIP  retailer order:", o3.error);
      } else console.log("SKIP  no retail-priced product locally");
    } else console.log("SKIP  no retailer locally");
  } finally {
    const uids = (await query<{ uid: string }>(`select uid from fp_booking_order where order_id = any($1)`, [made])).map((r) => r.uid);
    await query(`delete from dist_order_event where order_uid = any($1::uuid[])`, [uids]);
    await query(`delete from dist_invoice where booking_order_uid = any($1::uuid[])`, [uids]).catch(() => null);
    await query(`delete from dist_ledger where order_uid = any($1::uuid[])`, [uids]).catch(() => null);
    await query(`delete from fp_booking_order_item where booking_order_uid = any($1::uuid[])`, [uids]);
    await query(`delete from fp_booking_order where uid = any($1::uuid[])`, [uids]);
    for (const k of keepContact) await query(`update fp_firm set sales_contact_uid = $2 where uid = $1`, [k.uid, k.sc]);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(String(e).slice(0, 500)); process.exit(1); });
