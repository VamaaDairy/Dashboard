/**
 * Loads each SKU's packing cost per piece from "Price as per items.xlsx"
 * (Rate per PC) and re-costs every packing day already saved for those SKUs,
 * so production shows the plant's real packing cost from day one.
 *
 *   npm run db:seed:sku-pack-rate
 *
 * Run again after the sheet changes. SKUs the sheet leaves blank keep their
 * packing list and their saved days are not touched.
 */
import "dotenv/config";
import { Client } from "pg";

// SKU code -> rate per piece (₹), from the sheet. Codes are the stock app's.
const RATES: Record<string, { name: string; rate: number }> = {
  "999": { name: "Gaia Cow Milk 500 ML", rate: 0.90823529411764714 },
  "1003": { name: "Gaia Doodh Toned 500ml", rate: 0.90823529411764714 },
  "1005": { name: "Gaia Paneer 200gms", rate: 3.71 },
  "1006": { name: "Gaia Paneer 500Gms", rate: 4.54 },
  "1007": { name: "Gaia Paneer 1kg", rate: 4.54 },
  "1012": { name: "Gaia Dahi (Pouch) 200gms", rate: 0.6176 },
  "1013": { name: "Gaia Dahi (Pouch) 400gms", rate: 0.94434250764525995 },
  "1014": { name: "Gaia Dahi (Pouch) 1 Kg", rate: 1.544 },
  "1015": { name: "Gaia Dahi 5kg Pouch", rate: 7.72 },
  "1020": { name: "Gaia Kadhi Dahi Pouch 200 Grms", rate: 0.62383838383838386 },
  "1019": { name: "Gaia Kadhi Dahi Pouch 1 Kg", rate: 1.8602409638554218 },
  "1021": { name: "Gaia Kadhi Dahi 5kg Pouch", rate: 9.3575757575757574 },
  "1042": { name: "Gaia Maxx UHT 110ml", rate: 6.84 },
  "1045": { name: "Gaia Maxx Uht 400Ml", rate: 22.21 },
  "1051": { name: "Gaia Lite Milk UHT Tetra Pack 1Ltr", rate: 49.73 },
  "1050": { name: "Gaia Premium Milk UHT Tetra Pack 1 Ltr", rate: 56.43 },
  "1052": { name: "Gaia Gold Milk UHT Tetra Pack 1Ltr", rate: 71.26 },
};

const RATE_LINE_NAME = "Packing cost (rate per pc)";

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp" });
  await db.connect();
  try {
    await db.query("begin");
    let skus = 0;
    let days = 0;
    for (const [code, { name, rate }] of Object.entries(RATES)) {
      const { rows } = await db.query<{ id: string; scenario_id: string; pcs_per_case: number }>(
        `update sku set pack_rate_per_pc = $2 where code = $1 returning id, scenario_id, pcs_per_case`,
        [code, rate],
      );
      if (!rows.length) {
        console.warn(`  ! no SKU with code ${code} (${name}) - skipped`);
        continue;
      }
      for (const s of rows) {
        skus += 1;
        // every saved packing day for this SKU: one line, pieces x rate
        const packed = await db.query<{ day: string; pcs: number }>(
          `select day::text, (cases * $2 + loose_pcs)::float8 as pcs from sku_pack_day where sku_id = $1`,
          [s.id, s.pcs_per_case],
        );
        for (const d of packed.rows) {
          await db.query(`delete from sku_pack_material where sku_id = $1 and day = $2`, [s.id, d.day]);
          if (d.pcs <= 0) continue;
          await db.query(
            `insert into sku_pack_material (scenario_id, sku_id, day, packaging_id, name, qty, unit, price, sort_order)
             values ($1, $2, $3, null, $4, $5, 'pcs', $6, 0)`,
            [s.scenario_id, s.id, d.day, RATE_LINE_NAME, d.pcs, rate],
          );
          days += 1;
        }
      }
    }
    await db.query("commit");
    console.log(`set the packing rate on ${skus} SKU(s) and re-costed ${days} saved packing day(s)`);
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
