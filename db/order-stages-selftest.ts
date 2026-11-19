/**
 * Self-test of an order's road (src/lib/dispatch trackingOf): placed -> confirmed -> (on a planned trip: still confirmed)
 * -> dispatched / out for delivery once the trip starts -> delivered, the next stop then out for delivery; older apps
 * keep reading "dispatched". Local database only; everything it makes is removed again.
 *
 *   DATABASE_URL=postgres://localhost:5432/costing_erp npx tsx db/order-stages-selftest.ts
 */
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");
const m = require("node:module"); const p = require.resolve("server-only");
require.cache[p] = new m.Module(p); require.cache[p].loaded = true; require.cache[p].exports = {};
let failures = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };
(async () => {
  const { one, query, pool } = await import("@/lib/db");
  const { placeDistOrder, catalogFor } = await import("@/lib/distributor");
  const { confirmOrders } = await import("@/lib/orders/direct");
  const { createTrip, startTrip, finishStop, trackingOf } = await import("@/lib/dispatch");
  const dist = (await one<{ uid: string; name: string }>(`select f.uid, f.name from fp_firm f join fp_channel ch on ch.uid = f.channel_uid where f.active = 1 and upper(ch.channel_code) <> 'RT' and ch.level > 1 order by f.name limit 1`))!;
  const buyer = { id: 0, kind: "distributor", firmUid: dist.uid, staffUid: null, name: dist.name, phone: "" } as const;
  const sku = (((await catalogFor(buyer as never, dist.uid)) ?? []) as Array<{ sku: string }>)[0].sku;
  const rider = (await one<{ id: number }>(`insert into shop_rider (name, phone, pin_hash, kind) values ('Stage Test Truck', '9000099911', 'x', 'transporter') returning id`))!.id;
  const made: number[] = [];
  let tripId: number | null = null;
  try {
    const o1 = await placeDistOrder(buyer as never, { firmUid: dist.uid, lines: [{ sku, qty: 5 }] });
    const o2 = await placeDistOrder(buyer as never, { firmUid: dist.uid, lines: [{ sku, qty: 7 }] });
    if (!o1.ok || !o2.ok) throw new Error("place failed");
    made.push(o1.orderId, o2.orderId);
    const uids = (await query<{ uid: string }>(`select uid from fp_booking_order where order_id = any($1) order by order_id`, [made])).map((r) => r.uid);
    const step = async () => { const t = await trackingOf(uids); return uids.map((u) => t.get(u)!.step); };
    check(JSON.stringify(await step()) === '["placed","placed"]', `placed: ${await step()}`);
    await confirmOrders(uids, { name: "test", kind: "office" });
    check(JSON.stringify(await step()) === '["confirmed","confirmed"]', `confirmed: ${await step()}`);
    const t = await createTrip({ date: "2030-01-01", routeId: null, routeName: "Stage test", orderUids: uids, transporterId: rider, vehicleNo: null, notes: null }, "test");
    if (!t.ok) throw new Error(t.error);
    tripId = t.id;
    check(JSON.stringify(await step()) === '["confirmed","confirmed"]', `on a planned trip, still confirmed (waiting to leave): ${await step()}`);
    const s1 = await startTrip(rider, t.id, { lat: 21.18, lng: 82.13 });
    check(s1.ok, "the transporter starts the trip");
    const stops = await query<{ id: number; order_uid: string; seq: number }>(`select id, order_uid, seq from dist_trip_stop where trip_id = $1 order by seq`, [t.id]);
    const firstUid = stops[0].order_uid, secondUid = stops[1].order_uid;
    const tr = await trackingOf(uids);
    check(tr.get(firstUid)!.step === "out_for_delivery" && tr.get(secondUid)!.step === "dispatched", `first stop out for delivery, second dispatched: ${tr.get(firstUid)!.step}, ${tr.get(secondUid)!.step}`);
    check(tr.get(firstUid)!.stage === "dispatched" && tr.get(secondUid)!.stage === "dispatched", "older apps still read both as dispatched (on the way)");
    check(!!tr.get(firstUid)!.trip?.outForDeliveryAt, "the first stop has its out-for-delivery time (the trip's start)");
    const f1 = await finishStop(rider, stops[0].id, { delivered: true, receivedBy: "Owner", lat: null, lng: null });
    check(f1.ok, "the first stop is delivered");
    const tr2 = await trackingOf(uids);
    check(tr2.get(firstUid)!.step === "delivered" && tr2.get(secondUid)!.step === "out_for_delivery", `then: ${tr2.get(firstUid)!.step}, ${tr2.get(secondUid)!.step}`);
    check(!!tr2.get(secondUid)!.trip?.outForDeliveryAt, "the second stop's out-for-delivery time is when the first was done");
  } finally {
    const uids = (await query<{ uid: string }>(`select uid from fp_booking_order where order_id = any($1)`, [made])).map((r) => r.uid);
    if (tripId) await query(`delete from dist_trip where id = $1`, [tripId]);
    await query(`delete from dist_order_event where order_uid = any($1::uuid[])`, [uids]);
    await query(`delete from dist_ledger where order_uid = any($1::uuid[])`, [uids]).catch(() => null);
    await query(`delete from dist_invoice where booking_order_uid = any($1::uuid[])`, [uids]).catch(() => null);
    await query(`delete from fp_booking_order_item where booking_order_uid = any($1::uuid[])`, [uids]);
    await query(`delete from fp_booking_order where uid = any($1::uuid[])`, [uids]);
    await query(`delete from shop_rider where id = $1`, [rider]);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(String(e).slice(0, 500)); process.exit(1); });
