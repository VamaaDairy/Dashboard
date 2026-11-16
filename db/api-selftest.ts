/**
 * Self-test of the dynamic API (/api/masters, /api/orders, API keys - db/101_api_keys.sql) against a LOCAL database:
 * calls the route handlers the way Next does. Never run against production.
 *
 *   DATABASE_URL=postgres://localhost:5432/costing_erp_preview npx tsx --conditions=react-server db/api-selftest.ts
 */
import { createHash, randomBytes } from "node:crypto";
import { Client } from "pg";

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");
const BASE = process.env.API_BASE ?? "http://localhost:3000";

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failures++;
};

const call = (path: string, key: string | null, init: { method?: string; body?: unknown } = {}) =>
  fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...(init.body !== undefined ? { "content-type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const query = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows as T[];
  const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await query<T>(sql, args))[0] ?? null;
  // the same format as src/lib/api/access.ts newApiKey: only the hash is stored
  const makeKey = async (userId: string, name: string) => {
    const key = `gk_${randomBytes(20).toString("hex")}`;
    await query(`insert into api_key (name, user_id, prefix, key_hash, created_by) values ($1, $2, $3, $4, 'selftest')`, [name, userId, key.slice(0, 11), createHash("sha256").update(key).digest("hex")]);
    return key;
  };

  const tag = String(Date.now()).slice(-6);
  const owner = (await one<{ id: string }>(`insert into app_user (email, name, password_hash, role, is_active) values ($1, 'API Test Owner', 'x', 'owner', true) returning id`, [`api-owner-${tag}@test.local`]))!;
  const viewer = (await one<{ id: string }>(`insert into app_user (email, name, password_hash, role, is_active, access) values ($1, 'API Test Viewer', 'x', 'viewer', true, '{}'::jsonb) returning id`, [`api-viewer-${tag}@test.local`]))!;
  let cityId = "";
  try {
    const key = await makeKey(owner.id, "Self-test owner");
    const weak = await makeKey(viewer.id, "Self-test viewer");
    check(/^gk_[0-9a-f]{40}$/.test(key), "a key looks like gk_ + 40 hex characters");
    check(!(await one(`select 1 from api_key where key_hash = $1`, [key])), "the key itself is not stored, only its hash");

    // who may call
    check((await call("/api/masters", null)).status === 401, "no key, no session: 401");
    check((await call("/api/masters", "gk_" + "0".repeat(40))).status === 401, "an unknown key: 401");
    const all = await (await call("/api/masters", key)).json();
    check(all.masters?.length > 50, `an owner key lists every master (${all.masters?.length})`);
    const city = all.masters.find((m: { slug: string }) => m.slug === "cityMaster");
    check(city?.editable && city.fields.some((f: { name: string }) => f.name === "city_name"), "each master lists its fields for create / update");
    const none = await (await call("/api/masters", weak)).json();
    check(Array.isArray(none.masters) && none.masters.length === 0, "a key for a user with no access lists nothing");
    check((await call("/api/masters/cityMaster", weak)).status === 403, "...and is refused a master: 403");
    check((await call("/api/masters/nope", key)).status === 404, "an unknown master: 404");

    // list, add, read, change, switch off, delete
    const before = await (await call("/api/masters/cityMaster?page=1", key)).json();
    check(typeof before.total === "number" && Array.isArray(before.rows) && before.pageSize === 50, "a master lists its rows with paging");
    // a state to file the test city under (a blank local database has none): made here, removed at the end
    const state = `APITEST STATE ${tag}`;
    await query(`insert into fp_state (region, state, code, gstin_code) values ('Test', $1, 'ZZ', '99')`, [state]);
    const bad = await call("/api/masters/cityMaster", key, { method: "POST", body: { city_name: "x" } });
    check(bad.status === 400 && !!(await bad.json()).fieldErrors, "a missing required field: 400 with field errors");
    const made = await call("/api/masters/cityMaster", key, { method: "POST", body: { city_state: state, city_name: `Apitest ${tag}` } });
    cityId = (await made.json()).id ?? "";
    check(made.status === 201 && !!cityId, "POST adds a row and returns its id");
    const got = await (await call(`/api/masters/cityMaster/${cityId}`, key)).json();
    check(got.record?.city_name === `APITEST ${tag}`, "GET /{id} reads it back (with the master's own rules, here upper case)");
    const patched = await call(`/api/masters/cityMaster/${cityId}`, key, { method: "PATCH", body: { city_name: `Apitest2 ${tag}` } });
    const after = await (await call(`/api/masters/cityMaster/${cityId}`, key)).json();
    check(patched.status === 200 && after.record?.city_name === `APITEST2 ${tag}` && after.record?.city_state === state, "PATCH changes only the fields sent");
    const off = await call(`/api/masters/cityMaster/${cityId}/active`, key, { method: "POST", body: { active: false } });
    check(off.status === 200 && (await one<{ s: number }>(`select status as s from fp_city where uid = $1`, [cityId]))?.s === 0, "POST .../active switches it off");
    const logged = await one<{ actor: string }>(`select actor from master_audit where record_id = $1 order by id desc limit 1`, [cityId]);
    check(!!logged?.actor.includes('API key "Self-test owner"'), "the change log names the API key");
    const del = await call(`/api/masters/cityMaster/${cityId}`, key, { method: "DELETE" });
    check(del.status === 200 && !(await one(`select 1 from fp_city where uid = $1`, [cityId])), "DELETE removes it");
    if (del.status === 200) cityId = "";
    check((await call(`/api/masters/cityMaster/${cityId || "00000000-0000-0000-0000-000000000000"}`, key)).status === 404, "a row that is not there: 404");

    // orders by number
    const o = await one<{ order_id: number }>(`select b.order_id from fp_booking_order b join fp_firm f on f.uid = b.from_firm_uid order by b.order_id desc limit 1`);
    if (o) {
      const r = await call(`/api/orders/${o.order_id}`, key);
      const j = r.status === 200 ? await r.json() : null;
      check(r.status === 200 ? Array.isArray(j.order?.lines) && Array.isArray(j.history) : r.status === 404, `GET /api/orders/${o.order_id} returns the order with its lines and history (or 404 for a non-trade order)`);
      check((await call(`/api/orders/${o.order_id}`, weak)).status === 403, "an order needs App orders access: 403");
    } else console.log("SKIP  no orders in this database");
    check((await call("/api/orders/999999999", key)).status === 404, "an order that is not there: 404");
    check((await call("/api/orders/999999999", key, { method: "POST", body: { action: "dance" } })).status === 404, "acting on a missing order: 404");

    // revoking
    const keyRow = (await one<{ id: number; last: string | null }>(`select id, last_used_at as last from api_key where name = 'Self-test owner' and user_id = $1`, [owner.id]))!;
    check(!!keyRow.last, "the key's last use is recorded");
    await query(`update api_key set revoked_at = now(), revoked_by = 'selftest' where id = $1`, [keyRow.id]);
    check((await call("/api/masters", key)).status === 401, "a revoked key stops working at once");
    await query(`update app_user set is_active = false where id = $1`, [viewer.id]);
    check((await call("/api/masters", weak)).status === 401, "switching the user off stops their keys");
  } finally {
    if (cityId) await query(`delete from fp_city where uid = $1`, [cityId]);
    await query(`delete from fp_state where state = $1`, [`APITEST STATE ${tag}`]);
    await query(`delete from master_audit where actor in ('selftest') or actor like '%Self-test%'`);
    await query(`delete from app_user where id = any($1)`, [[owner.id, viewer.id]]);
    await db.end();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
