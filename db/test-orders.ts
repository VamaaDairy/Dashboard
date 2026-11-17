/**
 * Demo data to look at the order lists and the Route sheet: TEST customers (a super stockist, distributors under the
 * company and under it, MFS / institution / PT parties, retailers), a TEST sales officer, each on a route, and 100
 * orders of every kind (distributor's own app, retailer's own app, sales officer for a distributor or a retailer,
 * portal) for one delivery date, all confirmed through the Dashboard's own confirm.
 *
 * Everything carries "TEST" (codes TEST-..., names "TEST ..."), the customers have no app login (nobody is notified)
 * and no GST invoice is issued (the real invoice series is untouched - do not open Invoice on a TEST order, that would
 * issue one). `clean` removes all of it.
 *
 *   npx tsx db/test-orders.ts seed [YYYY-MM-DD]     (default: today in India)
 *   npx tsx db/test-orders.ts clean
 */
const mod = require("node:module");
const so = require.resolve("server-only");
require.cache[so] = new mod.Module(so);
require.cache[so].loaded = true;
require.cache[so].exports = {};

const WHO = "TEST demo data";
const ORDERS = 100;

async function main() {
  const { one, query, tx, pool } = await import("@/lib/db");
  const { saveRecord } = await import("@/lib/masters/entity/service");
  const { MASTERS } = await import("@/lib/masters/schemas");
  const { catalogFor, priceDistLines, withUnits } = await import("@/lib/distributor");
  const { confirmOrders } = await import("@/lib/orders/direct");
  const mode = process.argv[2];

  const testFirms = () => query<{ uid: string }>(`select uid from fp_firm where firm_code like 'TEST-%'`);

  if (mode === "clean") {
    const firms = (await testFirms()).map((f) => f.uid);
    const orders = (await query<{ uid: string }>(`select uid from fp_booking_order where from_firm_uid = any($1::uuid[])`, [firms])).map((o) => o.uid);
    const invoiced = await query<{ invoice_no: string }>(`select invoice_no from dist_invoice where booking_order_uid = any($1::uuid[])`, [orders]);
    if (invoiced.length) console.log(`Note: ${invoiced.length} TEST order(s) had an invoice issued (${invoiced.map((i) => i.invoice_no).join(", ")}); those invoices are removed too.`);
    await tx(async (c) => {
      await c.query(`delete from dist_ledger where firm_uid = any($1::uuid[])`, [firms]);
      await c.query(`delete from dist_invoice where booking_order_uid = any($1::uuid[])`, [orders]);
      await c.query(`delete from dist_order_event where order_uid = any($1::uuid[])`, [orders]);
      await c.query(`delete from master_audit where record_id = any($1::text[])`, [[...orders, ...firms]]);
      await c.query(`delete from fp_booking_order_item where booking_order_uid = any($1::uuid[])`, [orders]);
      await c.query(`delete from fp_booking_order where uid = any($1::uuid[])`, [orders]);
      await c.query(`delete from route_order_party where firm_uid = any($1::uuid[]) or name like 'TEST %'`, [firms]);
      await c.query(`update fp_firm set parent_firm_uid = null where uid = any($1::uuid[])`, [firms]);
      await c.query(`delete from fp_firm where uid = any($1::uuid[])`, [firms]);
      const staff = (await c.query<{ uid: string }>(`delete from fp_staff where first_name = 'TEST' and last_name = 'Sales Officer' returning uid`)).rows;
      await c.query(`delete from master_audit where record_id = any($1::text[])`, [staff.map((s) => s.uid)]);
    });
    console.log(`Removed ${orders.length} TEST orders and ${firms.length} TEST customers.`);
    await pool.end();
    return;
  }

  if (mode !== "seed") throw new Error("Usage: seed [YYYY-MM-DD] | clean");
  const day = process.argv[3] ?? (await one<{ d: string }>(`select (now() at time zone 'Asia/Kolkata')::date::text as d`))!.d;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Date must be YYYY-MM-DD.");
  if ((await testFirms()).length) throw new Error("TEST customers already exist. Run `clean` first.");

  // ---- who's who
  const chan = new Map((await query<{ code: string; uid: string; level: number }>(`select channel_code as code, uid, level from fp_channel`)).map((c) => [c.code, c]));
  const company = await one<{ uid: string }>(`select f.uid from fp_firm f join fp_channel ch on ch.uid = f.channel_uid where ch.level = 1 and f.active = 1 order by f.name limit 1`);
  const state = (await one<{ state: string }>(`select state from fp_state where lower(state) = 'chhattisgarh' limit 1`))?.state ?? null;
  const routes = await query<{ id: number; name: string }>(`select id, name from route_order_route order by sort nulls last, id`);
  const designation = await one<{ uid: string }>(`select uid from fp_designation order by coalesce(sales, 0) desc, designation limit 1`);
  if (!company || !designation) throw new Error("No company firm or designation in the masters.");

  const form = (o: Record<string, string | number | null | undefined>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined && v !== "") f.set(k, String(v));
    return f;
  };

  const staffSaved = await saveRecord(MASTERS.staffs, null, form({ first_name: "TEST", last_name: "Sales Officer", designation_uid: designation.uid, phone: "9000000900", city: "Raipur", state_state: state }), WHO);
  if (!staffSaved.ok) throw new Error(`Sales officer: ${staffSaved.error}`);
  const officer = staffSaved.id;

  type Firm = { uid: string; code: string; name: string; channel: string; retail: boolean };
  const firms: Firm[] = [];
  let n = 0;
  const addFirm = async (code: string, name: string, chCode: string, type: string, parent: string | null, city: string, withOfficer: boolean) => {
    // a database without that channel (a local copy) gets the nearest one there is
    const fallback: Record<string, string[]> = { DB: ["SS"], IT: ["MFS", "PT"], PT: ["MFS"], MFS: ["RT"] };
    const ch = chan.get(chCode) ?? (fallback[chCode] ?? []).map((c) => chan.get(c)).find(Boolean);
    if (!ch) throw new Error(`No channel ${chCode}`);
    if (!chan.get(chCode)) console.log(`(no ${chCode} channel here: ${code} uses another)`);
    n++;
    const saved = await saveRecord(MASTERS.distribution, null, form({
      firm_code: code, name, channel_uid: ch.uid, firm_type: type, parent_firm_uid: parent, sales_contact_uid: withOfficer ? officer : null,
      phone: `90000${String(n).padStart(5, "0")}`, city, state_state: state, address: `${name}, ${city}`,
    }), WHO);
    if (!saved.ok) throw new Error(`${code}: ${saved.error} ${"fieldErrors" in saved ? JSON.stringify(saved.fieldErrors) : ""}`);
    await query(`update fp_firm set active = 1 where uid = $1`, [saved.id]);
    const f = { uid: saved.id, code, name, channel: chCode, retail: chCode === "RT" };
    firms.push(f);
    return f;
  };

  const ss = await addFirm("TEST-SS01", "TEST Super Stockist Raipur", "SS", "Super Stockist", company.uid, "Raipur", true);
  const dbs: Firm[] = [];
  const cities = ["Raipur", "Raipur", "Bhilai", "Bilaspur", "Durg", "Raigarh"];
  for (let i = 1; i <= 6; i++) {
    // three under the company, three under the TEST super stockist
    dbs.push(await addFirm(`TEST-DB0${i}`, `TEST Distributor ${i} ${cities[i - 1]}`, "DB", "Distributor", i <= 3 ? company.uid : ss.uid, cities[i - 1], i % 2 === 1));
  }
  const others = [
    await addFirm("TEST-MFS01", "TEST MFS Booth Shankar Nagar", "MFS", "MFS", company.uid, "Raipur", true),
    await addFirm("TEST-MFS02", "TEST MFS Booth Telibandha", "MFS", "MFS", ss.uid, "Raipur", false),
    await addFirm("TEST-IT01", "TEST Institution Hostel Canteen", "IT", "Institution", company.uid, "Raipur", true),
    await addFirm("TEST-PT01", "TEST PT Parlour Civil Lines", "PT", "PT", dbs[0].uid, "Raipur", false),
  ];
  const rts: Firm[] = [];
  for (let i = 1; i <= 10; i++) {
    const parent = dbs[(i - 1) % dbs.length];
    rts.push(await addFirm(`TEST-RT${String(i).padStart(2, "0")}`, `TEST Retailer ${i} Kirana`, "RT", "Retailer", parent.uid, cities[(i - 1) % dbs.length], i % 3 === 0));
  }

  // each on a route of the Route sheet, spread over the first routes
  const routeChannel: Record<string, string> = { SS: "GT", DB: "GT", RT: "GT", MFS: "MFS", IT: "Institutional", PT: "Other" };
  for (const [i, f] of firms.entries()) {
    await query(
      `insert into route_order_party (name, route_id, channel, state, firm_uid, review_note) values ($1, $2, $3, $4, $5, $6)`,
      [f.name, routes.length ? routes[i % Math.min(routes.length, 6)].id : null, routeChannel[f.channel] ?? "Other", state, f.uid, WHO],
    );
  }

  // ---- 100 orders of every kind
  type Kind = "distributor" | "retailer" | "salesman" | "portal";
  const plan: Array<{ kind: Kind; firm: Firm }> = [];
  const pick = <T,>(a: T[], i: number) => a[i % a.length];
  const distLike = [...dbs, ss, ...others];
  for (let i = 0; i < ORDERS; i++) {
    const r = i % 10;
    if (r < 3) plan.push({ kind: "distributor", firm: pick(distLike, i) }); // 30: the party's own app
    else if (r < 5) plan.push({ kind: "retailer", firm: pick(rts, i) }); // 20: a retailer's own app
    else if (r < 7) plan.push({ kind: "salesman", firm: pick(distLike, i + 3) }); // 20: sales officer for a distributor / party
    else if (r < 9) plan.push({ kind: "salesman", firm: pick(rts, i + 5) }); // 20: sales officer for a retailer
    else plan.push({ kind: "portal", firm: pick(dbs, i) }); // 10: entered on the portal
  }

  let seed = 7;
  const rand = (k: number) => (seed = (seed * 9301 + 49297) % 233280) % k;
  const catalogs = new Map<string, Array<{ sku: string; pack: { per: number } | null }>>();
  const uids: string[] = [];
  let skipped = 0;
  for (const [i, p] of plan.entries()) {
    const login = { id: 0, kind: p.firm.retail ? "retailer" : "distributor", firmUid: p.firm.uid, staffUid: null, name: p.firm.name, phone: "" } as const;
    let cat = catalogs.get(p.firm.uid);
    if (!cat) {
      cat = ((await catalogFor(login as never, p.firm.uid)) ?? []) as never;
      catalogs.set(p.firm.uid, cat!);
    }
    if (!cat!.length) { skipped++; continue; }
    const merged = new Map<string, number>();
    const lines = 2 + rand(5);
    for (let k = 0; k < lines; k++) {
      const prod = cat![rand(cat!.length)];
      const pack = Number(prod.pack?.per ?? 0);
      const qty = pack > 1 ? pack * (1 + rand(4)) + (rand(3) === 0 ? rand(pack) : 0) : 1 + rand(30);
      merged.set(prod.sku, (merged.get(prod.sku) ?? 0) + qty);
    }
    const priced = await priceDistLines(p.firm.retail ? "retail" : "distributor", p.firm.uid, merged);
    if (!priced.ok) { skipped++; continue; }
    const items = await withUnits(priced.lines, new Map());
    const totalQty = items.reduce((s, l) => s + l.qty, 0);
    const total = Math.round(items.reduce((s, l) => s + l.qty * l.dp, 0) * 100) / 100;
    const parent = await one<{ uid: string | null }>(`select parent_firm_uid as uid from fp_firm where uid = $1`, [p.firm.uid]);
    const appKind = p.kind === "portal" ? null : p.kind;
    const placedAt = new Date(Date.now() - (ORDERS - i) * 4 * 60_000);

    const uid = await tx(async (c) => {
      await c.query(`select pg_advisory_xact_lock(hashtext('dist_order_no'))`);
      const [{ next }] = (await c.query<{ next: number }>(`select coalesce(max(order_id), 0) + 1 as next from fp_booking_order`)).rows;
      const ins = await c.query<{ uid: string }>(
        `insert into fp_booking_order
           (order_uid, order_id, order_type, booking_time, booking_date, total_item, week_of_month, total_quantity,
            total_cost, dealer_cost, status, current_status, reference, from_firm_uid, to_firm_uid, staff_uid,
            app_kind, app_login_id, app_notes, delivery_date)
         values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $8, 'Pending', 'Pending', $9, $10, $11, $12, $13, null, $14, $15::date)
         returning uid`,
        [next, p.firm.retail ? "SECONDARY" : "PRIMARY", placedAt, placedAt.toISOString().slice(0, 10), items.length, Math.ceil(placedAt.getDate() / 7),
          totalQty, total, `TEST order (${p.kind})`, p.firm.uid, parent?.uid ?? company.uid, p.kind === "salesman" ? officer : null,
          appKind, "TEST order", day],
      );
      const id = ins.rows[0].uid;
      const actor = p.kind === "salesman" ? "TEST Sales Officer (salesman)" : p.kind === "portal" ? WHO : `${p.firm.name} (${p.kind})`;
      await c.query(`insert into dist_order_event (order_uid, action, actor, actor_kind) values ($1, 'placed', $2, $3)`, [id, actor, p.kind === "portal" ? "office" : "app"]);
      let k = 0;
      for (const l of items) {
        await c.query(
          `insert into fp_booking_order_item (mrp, selling_price, dp, quantity, stock, total_cost, booking_order_uid, product_uid, order_item_number, units)
           values ($1, $2, $2, $3, 0, $4, $5, $6, $7, $8)`,
          [l.mrp, l.dp, l.qty, Math.round(l.qty * l.dp * 100) / 100, id, l.uid, ++k, l.units ? JSON.stringify(l.units) : null],
        );
      }
      return id;
    });
    uids.push(uid);
  }

  // confirmed the way the office does it (status, history, audit); nobody has an app login, so nobody is notified
  const done = await confirmOrders(uids, { name: WHO, kind: "office" });
  const kinds = await query<{ k: string; n: number }>(
    `select coalesce(app_kind, 'portal') as k, count(*)::int as n from fp_booking_order where uid = any($1::uuid[]) group by 1 order by 2 desc`,
    [uids],
  );
  console.log(`Delivery date ${day}: ${uids.length} TEST orders placed, ${done.confirmed} confirmed${done.errors.length ? `, errors: ${done.errors.join("; ")}` : ""}${skipped ? `, ${skipped} skipped (no priced products)` : ""}.`);
  console.log(`By kind: ${kinds.map((x) => `${x.k} ${x.n}`).join(", ")}. Customers: ${firms.length} TEST firms + 1 TEST sales officer.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
