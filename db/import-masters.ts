/**
 * Loads the Footprints master exports (.xlsx) into the fp_* tables.
 *
 *   npm run db:import:masters -- <folder> [--dry]
 *
 * The folder (searched recursively) may hold any of these reports; whatever is
 * missing is skipped, so a single report can be refreshed on its own
 * (file name prefixes are listed in db/import/constants.ts):
 *
 *   CITY_MASTER_*                      -> fp_state, fp_city
 *   PRODUCT_MASTER_*                   -> fp_category, fp_sub_category, fp_tax_configuration, fp_product (+ images)
 *   CUSTOMER_MASTER_*                  -> fp_channel, fp_designation, fp_division, fp_firm (+ images, parent mapping)
 *   EMPLOYEE_MASTER_* (2 sheets)       -> fp_designation, fp_staff
 *   CUSTOMER_WISE_ROUTE_MAPPING_*      -> fp_beat, fp_firm.beat_uid
 *   CHANNEL_PRICE_REPORT_*             -> fp_channel_rate
 *   SLAB_RATE_MASTER_REPORT_*          -> fp_slab, fp_slab_rate
 *
 * Rows keep the uid Footprints gave them (customers, employees, products);
 * everything else gets a uid derived from its key, so running this again
 * updates rows in place instead of duplicating them. All or nothing: one
 * transaction. Layout: import/constants.ts, import/types.ts, import/lib/*
 * (parsing, ids, sql, excel), import/steps/* (one file per table group),
 * import/run.ts (order of steps).
 */
import "dotenv/config";
import { importMasters } from "./import/run";

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: npm run db:import:masters -- <folder with the .xlsx exports> [--dry]");
    process.exit(1);
  }
  const dry = process.argv.includes("--dry");
  const { found, summary, warn } = await importMasters(dir, dry);
  console.log(`found: ${found.join(", ") || "nothing"}`);
  if (dry) console.log("dry run - rolled back");
  console.log(summary.map((s) => `  ${s}`).join("\n"));
  if (warn.length) console.log(`\nnotes:\n${warn.slice(0, 30).map((w) => `  - ${w}`).join("\n")}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
