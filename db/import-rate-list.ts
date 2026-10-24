/**
 * Loads a rate list (db/rate-lists/<date>.json, made from the sales team's Excel) into the price tables:
 *   - MRP           -> fp_product.mrp
 *   - Retailer (RT) -> channel rate of the retail channel(s)       (fp_channel_rate, channel code RT)
 *   - Distributor   -> channel rate of the distributor channel(s)  (fp_channel_rate, channel code DB)
 *   - each party    -> a price list (fp_slab + fp_slab_rate) assigned to its customers (fp_slab_firm_mapping)
 * A customer gets its party price first, then its channel's rate, then the product's own DP - the Gaia app
 * and its orders use the same order. Afterwards every price can be changed on the dashboard's Price list page.
 *
 * Safe to run again: prices are updated in place, nothing is doubled. A customer belongs to one price list,
 * so assigning it here takes it off any other. Products a party list does not price fall back as above.
 *
 *   npm run db:rate-list                                   # the newest file in db/rate-lists
 *   npm run db:rate-list -- db/rate-lists/2026-09-21.json  # a given one
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

interface RateList {
  name: string;
  effectiveFrom: string;
  products: Array<{ sku: string; name: string; mrp: number | null; retailer: number | null; distributor: number | null; prices: Record<string, number> }>;
  priceLists: Array<{ name: string; group: string; customers: string[] }>;
}

const DIR = join(__dirname, "rate-lists");

async function main() {
  const file = process.argv[2] ?? join(DIR, readdirSync(DIR).filter((f) => f.endsWith(".json")).sort().at(-1)!);
  const list = JSON.parse(readFileSync(file, "utf8")) as RateList;
  const from = list.effectiveFrom;
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp" });
  await db.connect();
  const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as T[];
  const report = { mrp: 0, channel: 0, lists: 0, rates: 0, customers: 0, missingProducts: [] as string[], missingCustomers: [] as string[] };

  try {
    await db.query("begin");
    const staff = (await q<{ uid: string }>(`select uid from fp_staff order by (lower(email) = 'admin@vamaadairy.com') desc, active desc, created_at limit 1`))[0]?.uid;
    if (!staff) throw new Error("No employees in fp_staff to own the price lists - import the employees first.");

    // products, by SKU code (imported both as "1012" and "1,012")
    const prod = new Map<string, { uid: string; mrp: number }>();
    for (const p of list.products) {
      const r = (await q<{ uid: string; mrp: number }>(
        `select uid, mrp from fp_product where sku_code = $1 or regexp_replace(sku_code, '[^0-9A-Za-z]', '', 'g') = $1
         order by (sku_code = $1) desc, active desc limit 1`,
        [p.sku],
      ))[0];
      if (r) prod.set(p.sku, r);
      else report.missingProducts.push(`${p.sku} ${p.name}`);
    }

    // MRP
    for (const p of list.products) {
      const r = prod.get(p.sku);
      if (!r || !p.mrp || Number(r.mrp) === p.mrp) continue;
      await q(`update fp_product set mrp = $2, updated_at = now() where uid = $1`, [r.uid, p.mrp]);
      r.mrp = p.mrp;
      report.mrp++;
    }

    // retailer / distributor channel rates
    const channels = async (code: string) => (await q<{ uid: string }>(`select uid from fp_channel where upper(channel_code) = $1`, [code])).map((c) => c.uid);
    for (const [code, field] of [["RT", "retailer"], ["DB", "distributor"]] as const) {
      for (const ch of await channels(code)) {
        for (const p of list.products) {
          const r = prod.get(p.sku);
          const price = p[field];
          if (!r || !price) continue;
          const cur = (await q<{ uid: string }>(
            `select uid from fp_channel_rate where channel_uid = $1 and product_uid = $2 and state_state is null order by updated_at desc limit 1`,
            [ch, r.uid],
          ))[0];
          if (cur) await q(`update fp_channel_rate set dealer_price = $2, selling_price = $3, from_date = $4, updated_at = now() where uid = $1`, [cur.uid, price, r.mrp, from]);
          else
            await q(
              `insert into fp_channel_rate (channel_uid, product_uid, sku_code, dealer_price, selling_price, from_date)
               select $1, $2, sku_code, $3, $4, $5 from fp_product where uid = $2`,
              [ch, r.uid, price, r.mrp, from],
            );
          report.channel++;
        }
      }
    }

    // party price lists
    for (const pl of list.priceLists) {
      let slab = (await q<{ uid: string }>(`select uid from fp_slab where lower(name) = lower($1) order by active desc nulls last limit 1`, [pl.name]))[0]?.uid;
      if (slab) await q(`update fp_slab set active = 1, grp = $2, updated_at = now(), updated_staff_uid = $3 where uid = $1`, [slab, pl.group || null, staff]);
      else
        slab = (await q<{ uid: string }>(
          `insert into fp_slab (name, active, grp, created_staff_uid, updated_staff_uid) values ($1, 1, $2, $3, $3) returning uid`,
          [pl.name, pl.group || null, staff],
        ))[0].uid;
      report.lists++;

      const priced = new Set<string>();
      for (const p of list.products) {
        const r = prod.get(p.sku);
        const price = p.prices[pl.name];
        if (!r || !price) continue;
        priced.add(r.uid);
        const cur = (await q<{ uid: string }>(`select uid from fp_slab_rate where slab_uid = $1 and product_uid = $2 order by updated_at desc limit 1`, [slab, r.uid]))[0];
        if (cur) await q(`update fp_slab_rate set dp = $2, sp = $3, active = 1, from_date = $4, updated_at = now() where uid = $1`, [cur.uid, price, r.mrp, from]);
        else
          await q(
            `insert into fp_slab_rate (slab_uid, product_uid, dp, sp, max_allowed_discount, active, from_date) values ($1, $2, $3, $4, 0, 1, $5)`,
            [slab, r.uid, price, r.mrp, from],
          );
        report.rates++;
      }
      // anything this list no longer prices falls back to the channel rate
      await q(`update fp_slab_rate set active = 0, updated_at = now() where slab_uid = $1 and active = 1 and not (product_uid = any($2::uuid[]))`, [slab, [...priced]]);

      for (const code of pl.customers) {
        const firm = (await q<{ uid: string }>(`select uid from fp_firm where upper(firm_code) = upper($1) limit 1`, [code]))[0]?.uid;
        if (!firm) {
          report.missingCustomers.push(`${code} (${pl.name})`);
          continue;
        }
        await q(`delete from fp_slab_firm_mapping where firm_uid = $1 and slab_uid <> $2`, [firm, slab]);
        await q(
          `insert into fp_slab_firm_mapping (firm_uid, slab_uid, assigned_staff_uid)
           select $1, $2, $3 where not exists (select 1 from fp_slab_firm_mapping where firm_uid = $1 and slab_uid = $2)`,
          [firm, slab, staff],
        );
        report.customers++;
      }
    }

    await q(
      `insert into master_audit (actor, slug, record_id, action, summary, before, after) values ('Rate list import', 'priceList', $1, 'update', $2, null, $3)`,
      [list.name, `Imported ${list.name} (effective ${from})`, JSON.stringify({ ...report, missingProducts: report.missingProducts.length, missingCustomers: report.missingCustomers.length })],
    );
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    await db.end();
  }

  console.log(`${list.name} (effective ${from})`);
  console.log(`  MRP changed on ${report.mrp} product(s)`);
  console.log(`  ${report.channel} retailer / distributor channel rate(s) set`);
  console.log(`  ${report.lists} party price list(s), ${report.rates} party price(s), ${report.customers} customer(s) assigned`);
  if (report.missingProducts.length) console.log(`  Products not found (skipped):\n    ${report.missingProducts.join("\n    ")}`);
  if (report.missingCustomers.length) console.log(`  Customer codes not found (skipped):\n    ${report.missingCustomers.join("\n    ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
