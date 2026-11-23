/**
 * Self-test of the Gaia Distributors app's own offers and banners (db/122, src/lib/distributor/offers.ts): who gets
 * which offer, how it is priced into the order lines (so the invoice and the route-sheet bill carry it), free items,
 * codes, limits, edits keeping the offers an order was placed under, and the D2C app left as it was.
 * Local database only; everything it makes is removed again.
 *
 *   DATABASE_URL=postgres://localhost:5432/costing_erp npx tsx db/partner-offers-selftest.ts
 */
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const m = require("node:module"); const p = require.resolve("server-only");
require.cache[p] = new m.Module(p); require.cache[p].loaded = true; require.cache[p].exports = {};
let failures = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const near = (a: number, b: number, eps = 0.011) => Math.abs(a - b) <= eps;

(async () => {
  const { one, query, pool } = await import("@/lib/db");
  const { placeDistOrder, catalogFor, quoteDistOrder } = await import("@/lib/distributor");
  const { editOrder, setLineFromSheet } = await import("@/lib/orders/direct");
  const { runningOffers, appOffers } = await import("@/lib/shop/offers");
  const { liveBanners } = await import("@/lib/shop/banners");
  const { dayLines } = await import("@/lib/route-orders/data");

  const dist = (await one<{ uid: string; name: string }>(`select f.uid, f.name from fp_firm f join fp_channel ch on ch.uid = f.channel_uid where f.active = 1 and upper(ch.channel_code) <> 'RT' and ch.level > 1 and exists (select 1 from fp_booking_order b where b.from_firm_uid = f.uid) order by f.name limit 1`))!;
  const retail = await one<{ uid: string; name: string }>(`select f.uid, f.name from fp_firm f join fp_channel ch on ch.uid = f.channel_uid where f.active = 1 and upper(ch.channel_code) = 'RT' order by f.name limit 1`);
  const buyer = { id: 0, kind: "distributor", firmUid: dist.uid, staffUid: null, name: dist.name, phone: "" } as const;
  const shop = { id: 0, kind: "retailer", firmUid: retail?.uid ?? null, staffUid: null, name: retail?.name ?? "", phone: "" } as const;
  const office = { name: "Self-test (office)", kind: "office" } as const;
  const made: number[] = [];
  const offers: number[] = [];
  const banners: number[] = [];

  const offer = async (o: Record<string, unknown>) => {
    const cols = Object.keys(o);
    const r = await one<{ id: number }>(
      `insert into shop_offer (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(o),
    );
    offers.push(r!.id);
    return r!.id;
  };
  const head = (orderId: number) => one<{ uid: string; total: number; disc: number | null; details: { code: string | null; offers: Array<{ id: number }> } | null; qty: number }>(
    `select uid, total_cost::float as total, scheme_discount::float as disc, scheme_details as details, total_quantity::float as qty from fp_booking_order where order_id = $1`, [orderId],
  );
  const itemsOf = (orderId: number) => query<{ sku: string; qty: number; rate: number; dp: number; total: number; disc: number | null; free: boolean }>(
    `select p.sku_code as sku, i.quantity::float as qty, i.selling_price::float as rate, i.dp::float as dp, i.total_cost::float as total,
            i.scheme_discount::float as disc, coalesce((i.scheme_details->>'free')::boolean, false) as free
       from fp_booking_order_item i join fp_product p on p.uid = i.product_uid join fp_booking_order b on b.uid = i.booking_order_uid
      where b.order_id = $1 order by i.order_item_number`, [orderId],
  );
  const usedBy = (uid: string) => query<{ offer_id: number }>(`select offer_id from dist_order_offer where order_uid = $1`, [uid]);
  const place = async (login: unknown, firmUid: string, lines: Array<{ sku: string; qty: number }>, code?: string) => {
    const r = await placeDistOrder(login as never, { firmUid, lines, code });
    if (r.ok) {
      made.push(r.orderId);
      await query(`update fp_booking_order set delivery_date = current_date + 3 where order_id = $1`, [r.orderId]);
    }
    return r;
  };

  try {
    const cat = ((await catalogFor(buyer as never, dist.uid)) ?? []) as Array<{ sku: string; price: number }>;
    check(cat.length >= 3, `the distributor has at least 3 priced products locally (${cat.length})`);
    const [A, B, C] = cat;
    const price = new Map(cat.map((x) => [x.sku, x.price]));

    // offers for each audience (and a D2C one that must never reach a partner)
    const oA = await offer({ title: "Test 10% off A", kind: "percent", applies_to: "products", skus: [A.sku], percent: 10, audience: "distributor", priority: 5 });
    const oB = await offer({ title: "Test buy 2 get 1 B", kind: "free_item", applies_to: "products", skus: [B.sku], buy_qty: 2, free_qty: 1, repeat: true, audience: "partners" });
    const oCode = await offer({ title: "Test code 5%", kind: "percent", applies_to: "cart", percent: 5, code: "PTEST5", audience: "partners" });
    const oOnce = await offer({ title: "Test once on C", kind: "flat", applies_to: "products", skus: [C.sku], amount: 1, per_customer_limit: 1, audience: "distributor" });
    const oD2c = await offer({ title: "Test D2C 50% on A", kind: "percent", applies_to: "products", skus: [A.sku], percent: 50, audience: "d2c" });

    // 1. who sees which offer
    const forDist = (await appOffers(["distributor", "partners"])).map((o) => o.id);
    const forD2c = (await runningOffers(["d2c"])).map((o) => o.id);
    check(forDist.includes(oA) && forDist.includes(oB) && !forDist.includes(oD2c), "a distributor sees distributor + both offers, never a D2C one");
    check(forD2c.includes(oD2c) && !forD2c.includes(oA) && !forD2c.includes(oB), "the D2C app sees only D2C offers");
    if (retail) {
      const forRetail = (await appOffers(["retailer", "partners"])).map((o) => o.id);
      check(forRetail.includes(oB) && !forRetail.includes(oA), "a retailer sees retailer + both offers, not a distributors-only one");
    }

    // 2. a distributor order: % off A priced into its line, buy-2-get-1 on B as a free line at 0
    const q = await quoteDistOrder(buyer as never, { firmUid: dist.uid, lines: [{ sku: A.sku, qty: 10 }, { sku: B.sku, qty: 4 }] });
    check(q.ok, "the app's quote prices the cart");
    const o1 = await place(buyer, dist.uid, [{ sku: A.sku, qty: 10 }, { sku: B.sku, qty: 4 }]);
    if (!o1.ok) throw new Error(o1.error);
    const h1 = (await head(o1.orderId))!;
    const i1 = await itemsOf(o1.orderId);
    const a1 = i1.find((l) => l.sku === A.sku && !l.free)!;
    const freeB = i1.find((l) => l.sku === B.sku && l.free);
    check(near(a1.rate, price.get(A.sku)! * 0.9, 0.0001) && a1.dp === price.get(A.sku), `A: 10% off in its selling price (${a1.dp} -> ${a1.rate}), list price kept`);
    check(near(a1.total, r2(a1.rate * 10)) && near(a1.disc ?? 0, r2(price.get(A.sku)! * 10 * 0.1)), "A: line total = qty x rate, its discount recorded");
    check(!!freeB && freeB.qty === 2 && freeB.rate === 0 && freeB.total === 0, `B: 2 free as a line of its own at 0 (got ${freeB?.qty})`);
    check(near(h1.total, r2(i1.reduce((s, l) => s + l.total, 0))) && near(h1.disc ?? 0, r2(price.get(A.sku)! * 10 * 0.1)), "the order total is its lines; its discount recorded");
    check(q.ok && near(q.quote.total, h1.total), `the quote matched what was placed (${q.ok ? q.quote.total : "-"} = ${h1.total})`);
    check(o1.total === h1.total, "the app is told the discounted total");
    const used1 = (await usedBy(h1.uid)).map((u) => u.offer_id);
    check(used1.includes(oA) && used1.includes(oB) && !used1.includes(oD2c), "the order records the offers it used (not the D2C one)");
    const inv = await one<{ total: number }>(`select (data->'totals'->>'total')::float as total from dist_invoice where booking_order_uid = $1`, [h1.uid]);
    check(!!inv && near(inv.total, h1.total), `its invoice carries the discount (${inv?.total} = ${h1.total})`);
    const day = (await one<{ d: string }>(`select (current_date + 3)::text as d`))!.d;
    const sheet = (await dayLines(day)).filter((l) => l.orderId === o1.orderId);
    check(near(r2(sheet.reduce((s, l) => s + l.qty * l.rate, 0)), h1.total), "the route sheet / bill (qty x rate) adds up to the discounted total");

    // 3. codes
    const bad = await place(buyer, dist.uid, [{ sku: C.sku, qty: 2 }], "NOSUCH");
    check(!bad.ok, "a wrong code stops the order with the reason");
    const o2 = await place(buyer, dist.uid, [{ sku: C.sku, qty: 4 }], "PTEST5");
    if (!o2.ok) throw new Error(o2.error);
    const h2 = (await head(o2.orderId))!;
    const gross2 = price.get(C.sku)! * 4;
    check(h2.details?.code === "PTEST5" && h2.total < gross2 && (await usedBy(h2.uid)).some((u) => u.offer_id === oCode), `the code's 5% is taken off and kept with the order (${gross2} -> ${h2.total})`);

    // 4. limits: once per customer
    const usedOnceFirst = (await usedBy(h2.uid)).some((u) => u.offer_id === oOnce);
    const o3 = await place(buyer, dist.uid, [{ sku: C.sku, qty: 1 }]);
    if (!o3.ok) throw new Error(o3.error);
    const usedOnceAgain = (await usedBy((await head(o3.orderId))!.uid)).some((u) => u.offer_id === oOnce);
    check(usedOnceFirst && !usedOnceAgain, "an offer limited to once per customer is not given twice");

    // 5. an edit keeps the offers the order was placed under (even one switched off since), free items worked out again
    await query(`update shop_offer set active = false where id = $1`, [oA]);
    const e1 = await editOrder(h1.uid, new Map([[A.sku, 12], [B.sku, 4]]), office as never);
    check(e1.ok, "the office raises A on the order");
    const i1b = await itemsOf(o1.orderId);
    const a1b = i1b.find((l) => l.sku === A.sku && !l.free)!;
    check(a1b.qty === 12 && near(a1b.rate, price.get(A.sku)! * 0.9, 0.0001), "A keeps its 10% though the offer was switched off after the order was placed");
    // the route sheet shows paid + free together: B 4 + 2 free = 6; set to 9 -> 7 paid, 3 free
    const s1 = await setLineFromSheet(h1.uid, B.sku, 9, office as never);
    check(s1.ok, "the route sheet changes B");
    const i1c = await itemsOf(o1.orderId);
    const paidB = i1c.filter((l) => l.sku === B.sku && !l.free).reduce((s, l) => s + l.qty, 0);
    const freeB2 = i1c.filter((l) => l.sku === B.sku && l.free).reduce((s, l) => s + l.qty, 0);
    check(paidB === 7 && freeB2 === 3, `sheet total 9 = 7 paid + 3 free (got ${paidB} + ${freeB2}) - a free item is never charged`);
    // the app's own edit (newer app: only what is paid)
    const e2 = await editOrder(h1.uid, new Map([[A.sku, 12], [B.sku, 2]]), office as never);
    const i1d = await itemsOf(o1.orderId);
    check(e2.ok && i1d.filter((l) => l.sku === B.sku && !l.free).reduce((s, l) => s + l.qty, 0) === 2 && i1d.filter((l) => l.sku === B.sku && l.free).reduce((s, l) => s + l.qty, 0) === 1, "paid-only edit: 2 paid, 1 free");
    const h1d = (await head(o1.orderId))!;
    check(near(h1d.total, r2(i1d.reduce((s, l) => s + l.total, 0))), "after edits the total is still its lines");

    // 6. a retailer order: no distributors-only offer
    if (retail) {
      const rcat = ((await catalogFor(shop as never, retail.uid)) ?? []) as Array<{ sku: string; price: number }>;
      const rA = rcat.find((x) => x.sku === A.sku);
      if (rA) {
        await query(`update shop_offer set active = true where id = $1`, [oA]);
        const o4 = await place(shop, retail.uid, [{ sku: rA.sku, qty: 3 }]);
        if (o4.ok) {
          const r4 = (await itemsOf(o4.orderId))[0];
          check(r4.rate === r4.dp, `a retailer does not get the distributors-only 10% (${r4.dp} -> ${r4.rate})`);
        } else console.log("SKIP  retailer order:", o4.error);
      } else console.log("SKIP  product A is not on the retail list locally");
    } else console.log("SKIP  no retailer locally");

    // 7. banners per app
    const bd = await one<{ id: number }>(`insert into shop_banner (title, audience) values ('Test partner banner', 'partners') returning id`);
    const bc = await one<{ id: number }>(`insert into shop_banner (title, audience) values ('Test D2C banner', 'd2c') returning id`);
    banners.push(bd!.id, bc!.id);
    const pb = (await liveBanners(["distributor", "partners"])).map((b) => b.id);
    const db = (await liveBanners(["d2c"])).map((b) => b.id);
    check(pb.includes(bd!.id) && !pb.includes(bc!.id) && db.includes(bc!.id) && !db.includes(bd!.id), "each app gets only its own banners");
  } finally {
    const uids = (await query<{ uid: string }>(`select uid from fp_booking_order where order_id = any($1)`, [made])).map((r) => r.uid);
    await query(`delete from dist_order_offer where order_uid = any($1::uuid[])`, [uids]);
    await query(`delete from dist_order_event where order_uid = any($1::uuid[])`, [uids]);
    await query(`delete from dist_invoice where booking_order_uid = any($1::uuid[])`, [uids]).catch(() => null);
    await query(`delete from dist_ledger where order_uid = any($1::uuid[])`, [uids]).catch(() => null);
    await query(`delete from fp_booking_order_item where booking_order_uid = any($1::uuid[])`, [uids]);
    await query(`delete from fp_booking_order where uid = any($1::uuid[])`, [uids]);
    await query(`delete from shop_banner where id = any($1) or offer_id = any($2)`, [banners, offers]);
    await query(`delete from shop_offer where id = any($1)`, [offers]);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1); });
