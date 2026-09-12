/**
 * Proves the engine reproduces the source workbook. Every value in
 * excel-expected.json is a number Excel itself calculated; this compares the
 * lot - product columns, batch rates, the milk-pricing parameters and the
 * shrikhand recipe block - against what the app now holds.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pool, query } from "../src/lib/db";

const expected = JSON.parse(
  readFileSync(join(process.cwd(), "db/excel-expected.json"), "utf8"),
) as {
  products: Record<string, Record<string, number>>;
  batches: Record<string, Record<string, number>>;
  parameters: Record<string, number>;
  recipe: Record<string, number>;
};

// workbook row -> object code
const PRODUCT_ROWS: Record<number, string> = {
  2: "tm_500", 3: "tm_200", 4: "tm_plus_500", 5: "dtm_500", 6: "dtm_200",
  7: "cow_milk_500", 8: "sm_500", 9: "sm_200", 10: "tea_plus_500",
  11: "plain_dahi_90g_cup", 12: "plain_dahi_200g_cup", 13: "plain_dahi_180g_cup",
  14: "plain_dahi_200g_pouch", 15: "plain_dahi_400g_pouch", 16: "plain_dahi_1kg_pouch",
  17: "plain_dahi_5kg_pouch", 18: "plain_dahi_5kg_bucket", 19: "plain_dahi_15kg_bucket",
  20: "kadhi_dahi_200g_pouch", 21: "kadhi_dahi_1kg_pouch", 22: "kadhi_dahi_5kg_pouch",
  23: "kadhi_dahi_5kg_bucket", 24: "kadhi_dahi_15kg_bucket", 25: "flavoured_dahi_90g_cup",
  26: "sweet_lassi_180ml_pouch", 27: "sweet_lassi_180ml_glass", 28: "mango_lassi_180ml_glass",
  29: "strawberry_lassi_180ml_glass", 30: "masala_chaach_200ml_pouch", 31: "shrikhand_80g_cup",
  32: "paneer_200g", 33: "paneer_500g", 34: "paneer_1kg", 35: "paneer_5kg_loose",
  36: "milk_peda_200g", 37: "khowa_brown_1kg", 38: "ghee_100ml", 39: "ghee_200ml",
  40: "ghee_500ml", 41: "ghee_1l", 42: "ghee_5l", 43: "ghee_15kg_tin",
};

const BATCH_ROWS: Record<number, string> = {
  48: "toned_milk", 49: "toned_plus", 50: "double_toned", 51: "cow_milk",
  52: "standard_milk", 53: "tea_plus", 54: "plain_dahi", 55: "plain_dahi_bulk",
  56: "pd_bucket", 57: "kadhi_dahi", 58: "flavoured_dahi", 59: "paneer_milk", 60: "ghee_base",
};

/**
 * Cells the workbook itself left blank, estimated, or filled on a different
 * basis than the column's own formula. Comparing them would test the
 * workbook's inconsistencies rather than the engine, so each is listed with
 * the reason instead of being quietly dropped.
 */
const EXCEPTIONS: Record<string, string> = {
  "plain_dahi_15kg_bucket.input_credit":
    "sheet has a typed 0; every other row uses the packing-GST formula, which gives 12.51",
  "kadhi_dahi_15kg_bucket.input_credit":
    "sheet has a typed 0; every other row uses the packing-GST formula, which gives 12.51",
  "shrikhand_80g_cup.market_transport":
    "sheet holds two figures - a per-kg 0.166 in the grid and 4% of ex-plant in the recipe block. "
    + "The recipe one is what its landed cost actually uses, so that is what the model carries",
};


const TOL = 1e-6;
const close = (a: number, b: number) => Math.abs(a - b) <= TOL * Math.max(1, Math.abs(b));

async function main() {
  const cells = await query<{ object_code: string; field_key: string; computed_num: number | null }>(
    `select object_code, field_key, computed_num from v_cell`,
  );
  const actual = new Map(cells.map((r) => [`${r.object_code}.${r.field_key}`, r.computed_num]));

  const params = await query<{ key: string; computed_num: number | null; value_num: number | null }>(
    `select key, computed_num, value_num from parameter`,
  );
  const paramValue = new Map(params.map((p) => [p.key, p.computed_num ?? p.value_num]));

  let checked = 0;
  const diffs: Array<[string, number, number | null]> = [];
  const skipped: string[] = [];

  const check = (ref: string, want: number, got: number | null, force = false) => {
    if (!force && EXCEPTIONS[ref] && process.env.NO_SKIP !== "1") { skipped.push(ref); return; }
    checked++;
    if (got === null || !close(got, want)) diffs.push([ref, want, got]);
  };

  for (const [row, code] of Object.entries(PRODUCT_ROWS)) {
    for (const [field, want] of Object.entries(expected.products[row] ?? {})) {
      check(`${code}.${field}`, want, actual.get(`${code}.${field}`) ?? null);
    }
  }
  for (const [row, code] of Object.entries(BATCH_ROWS)) {
    for (const [field, want] of Object.entries(expected.batches[row] ?? {})) {
      check(`${code}.${field}`, want, actual.get(`${code}.${field}`) ?? null);
    }
  }
  for (const [key, want] of Object.entries(expected.parameters)) {
    check(`P.${key}`, want, paramValue.get(key) ?? null);
  }
  for (const [ref, want] of Object.entries(expected.recipe)) {
    check(ref, want, actual.get(ref) ?? null, true);
  }

  const errs = await query<{ ref: string; error: string }>(
    `select object_code || '.' || field_key as ref, error from v_cell where error is not null`,
  );

  console.log(`Checked ${checked} values against the workbook.`);
  if (diffs.length) {
    console.log(`\n${diffs.length} mismatch(es):`);
    for (const [ref, want, got] of diffs) {
      console.log(`  ${ref.padEnd(44)} excel ${want.toFixed(6).padStart(14)}   app ${
        got === null ? "     (missing)" : got.toFixed(6).padStart(14)}`);
    }
  } else {
    console.log("All compared values match.");
  }

  console.log(`\n${skipped.length} cell(s) deliberately not compared:`);
  for (const ref of skipped) console.log(`  ${ref.padEnd(44)} ${EXCEPTIONS[ref]}`);

  if (errs.length) {
    console.log(`\n${errs.length} cell error(s):`);
    for (const e of errs) console.log(`  ${e.ref}: ${e.error}`);
  }
  await pool.end();
  process.exit(diffs.length || errs.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
