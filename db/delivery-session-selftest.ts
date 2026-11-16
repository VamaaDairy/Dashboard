/**
 * Self-test of delivery sessions (db/103_delivery_sessions.sql, src/lib/shop/delivery-session.ts) against a LOCAL
 * database, through the real order functions (assignRider, riderPickup, riderDeliver, setOrderStatus). With a local
 * Dashboard running (API_BASE, default http://localhost:3001) it also reads them back through /api/deliveries.
 * Never run against production.
 *
 *   DATABASE_URL=postgres://localhost:5432/costing_erp npx tsx --conditions=react-server db/delivery-session-selftest.ts
 */
import { createHash, randomBytes } from "node:crypto";

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");
const BASE = process.env.API_BASE ?? "http://localhost:3001";

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failures++;
};

async function main() {
  const { one, query, pool } = await import("@/lib/db");
  const orders = await import("@/lib/shop/orders");
  const tag = String(Date.now()).slice(-7);
  const phone = (n: number) => `9${tag}${n}0`.slice(0, 10);
  const rider = async (n: number) =>
    (await one<{ id: number }>(`insert into shop_rider (name, phone, pin_hash, kind) values ($1, $2, 'x', 'delivery') returning id`, [`Session Rider ${n}`, phone(n)]))!.id;
  const order = async (otp: string) =>
    (await one<{ id: number }>(
      `insert into shop_order (name, phone, address, subtotal, total, status, lat, lng, delivery_otp) values ('Session Test', '9000000000', 'Test street', 100, 100, 'placed', 21.2514, 81.6296, $1) returning id`,
      [otp],
    ))!.id;
  const sessions = (orderId: number) =>
    query<{ rider_id: number; status: string; ended_at: Date | null; end_reason: string | null; pickup_lat: number | null; drop_gap_m: number | null; metres: number | null; otp_checked: boolean | null }>(
      `select rider_id, status, ended_at, end_reason, pickup_lat, drop_gap_m, metres, otp_checked from shop_delivery_session where order_id = $1 order by id`,
      [orderId],
    );

  const r1 = await rider(1), r2 = await rider(2);
  const o1 = await order("1234"), o2 = await order("5678");
  let keyUser: string | null = null;
  try {
    // given to a rider
    await orders.assignRider(o1, r1);
    let s = await sessions(o1);
    check(s.length === 1 && s[0].rider_id === r1 && s[0].status === "assigned" && !s[0].ended_at, "giving an order to a rider opens a session");
    await orders.assignRider(o1, r1);
    check((await sessions(o1)).length === 1, "giving it to the same rider again changes nothing");

    // given to another rider: the first session ends, a second opens
    await orders.assignRider(o1, r2);
    s = await sessions(o1);
    check(s.length === 2 && s[0].status === "reassigned" && !!s[0].ended_at && s[1].rider_id === r2 && s[1].status === "assigned", "giving it to another rider ends the first session and opens theirs");

    // pickup with the phone's position, then a ride, then the handover with the code
    await orders.setRiderLocation(r2, 21.2400, 81.6200);
    await orders.riderPickup(r2, o1);
    s = await sessions(o1);
    check(s[1].status === "picked_up" && Math.abs((s[1].pickup_lat ?? 0) - 21.24) < 1e-6, "pickup records when and where");
    // ~1.1 km of riding in 4 steps, a minute apart (written straight into the track)
    const base = Date.now() - 5 * 60_000;
    // the pickup position's own ping belongs at the start of the ride, not "now"
    await query(`update shop_rider_ping set at = $2 where rider_id = $1`, [r2, new Date(base)]);
    for (let i = 1; i <= 4; i++) {
      await query(`insert into shop_rider_ping (rider_id, lat, lng, at) values ($1, $2, 81.6200, $3)`, [r2, 21.2400 + i * 0.0025, new Date(base + i * 60_000)]);
    }
    await query(`update shop_delivery_session set picked_up_at = $2 where order_id = $1 and ended_at is null`, [o1, new Date(base)]);
    await query(`update shop_rider set lat = 21.2510, lng = 81.6290, location_at = now() where id = $1`, [r2]);
    check((await orders.riderDeliver(r2, o1, "0000")) === "wrong_otp", "a wrong code is refused (session stays open)");
    check((await sessions(o1))[1].status === "picked_up", "...and the session is unchanged");
    check((await orders.riderDeliver(r2, o1, "1234")) === "ok", "the right code delivers it");
    s = await sessions(o1);
    const d = s[1];
    check(d.status === "delivered" && d.end_reason === "delivered" && !!d.ended_at && d.otp_checked === true, "the handover closes the session as delivered, code checked");
    check(d.drop_gap_m !== null && d.drop_gap_m < 150, `records how far from the customer's pin it was handed over (${d.drop_gap_m} m)`);
    check(d.metres !== null && d.metres > 900 && d.metres < 1300, `records the distance ridden since pickup (${d.metres} m)`);

    // cancelled while with a rider
    await orders.assignRider(o2, r1);
    await orders.setOrderStatus(o2, "cancelled");
    s = await sessions(o2);
    check(s.length === 1 && s[0].status === "cancelled" && !!s[0].ended_at, "cancelling the order ends its session");

    // through the API, with an API key
    const owner = await one<{ id: string }>(`select id from app_user where role = 'owner' and is_active order by created_at limit 1`);
    if (owner && (await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false))) {
      keyUser = owner.id;
      const key = `gk_${randomBytes(20).toString("hex")}`;
      await query(`insert into api_key (name, user_id, prefix, key_hash, created_by) values ('Session self-test', $1, $2, $3, 'selftest')`, [owner.id, key.slice(0, 11), createHash("sha256").update(key).digest("hex")]);
      const h = { authorization: `Bearer ${key}` };
      const byOrder = await (await fetch(`${BASE}/api/deliveries?order=${o1}`, { headers: h })).json();
      check(byOrder.sessions?.length === 2 && byOrder.sessions[1].status === "delivered" && byOrder.sessions[1].rider.id === r2, "GET /api/deliveries?order= lists both sessions of the order");
      const one1 = await (await fetch(`${BASE}/api/deliveries/${byOrder.sessions[1].id}`, { headers: h })).json();
      check(one1.session?.metres === d.metres && Array.isArray(one1.track) && one1.track.length >= 4, "GET /api/deliveries/{id} returns the session and its track");
      const list = await (await fetch(`${BASE}/api/deliveries?rider=${r1}`, { headers: h })).json();
      check(list.total === 2 && list.sessions.every((x: { rider: { id: number } }) => x.rider.id === r1), "GET /api/deliveries?rider= filters by rider");
      check((await fetch(`${BASE}/api/deliveries`)).status === 401, "without a key: 401");
    } else console.log("SKIP  API checks (no local Dashboard running, or no owner user)");
  } finally {
    await query(`delete from shop_order where id = any($1)`, [[o1, o2]]);
    await query(`delete from shop_rider where id = any($1)`, [[r1, r2]]);
    if (keyUser) await query(`delete from api_key where name = 'Session self-test'`);
    await pool.end();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
