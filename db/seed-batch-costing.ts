/**
 * Layers the cost factors from "COST OF PRODUCTS_26Dec25_27Feb24TptRvisd.xlsx"
 * (the product-wise cost table + the milk/batch rate table beneath it) onto the
 * batch model from `seed-sweet-products.ts`, without touching SKU/pack-size
 * mechanics (secondary packing, per-piece pricing) - those stay deferred.
 *
 * Two things the flat "Milk" / "Dahi" ingredient rate was missing:
 *
 *  1. Milk cost isn't one flat rate - the workbook derives it from Fat % and
 *     SNF % against a base rate per kg of total solids, plus Sachiv
 *     commission, procurement transport, and conversion utilities/chemicals.
 *     That becomes a `milk_batch` class (fat, snf -> total_cost_per_l), and
 *     every product's milk/dahi input line is repointed at the right
 *     milk_batch object instead of the placeholder ingredient.
 *
 *  2. Market transport (plant -> market) and the resulting landed cost were
 *     entirely absent from the product class. Adds market_transport_rate /
 *     _cost and a landed_cost total feeding cost_per_unit.
 *
 * Idempotent: safe to run again after `seed-sweet-products.ts`.
 */
import "dotenv/config";
import { pool } from "../src/lib/db";

interface ParamSpec { key: string; label: string; group: string; value?: number; suffix?: string; description?: string }

const PARAMETERS: ParamSpec[] = [
  { key: "base_rate", label: "Base rate per kg total solids", group: "Milk Pricing", value: 297, suffix: "Rs/kg TS" },
  { key: "ts_divisor", label: "TS divisor (kg TS per 100 L basis)", group: "Milk Pricing", value: 103 },
  { key: "sachiv_commission_pct", label: "Sachiv commission", group: "Procurement", value: 0.04, suffix: "%" },
  { key: "proc_transport_rate", label: "Procurement transport rate", group: "Procurement", value: 2.5 },
  { key: "proc_transport_basis", label: "Procurement transport basis (kg TS)", group: "Procurement", value: 12.5 },
  { key: "utilities_default", label: "Coal + labour + electricity + plant staff", group: "Conversion", value: 3.56 },
  { key: "chemicals_default", label: "Chemicals (culture, cleaning, lab)", group: "Conversion", value: 0.15 },
  { key: "chemicals_fermented", label: "Chemicals - fermented products", group: "Conversion", value: 1.35,
    description: "0.15 base + 1 + 0.2, per the workbook, for dahi/lassi/chaach" },
  { key: "market_transport_rate", label: "Market transport per litre / kg", group: "Market", value: 2 },
  { key: "gst_packing", label: "GST on packing material", group: "Tax", value: 0.18, suffix: "%" },
  { key: "gst_ingredient", label: "GST on ingredients", group: "Tax", value: 0.18, suffix: "%" },
];

interface MilkBatchSpec {
  code: string; name: string; fat: number; snf: number;
  fermented?: boolean; notes?: string;
}

const MILK_BATCHES: MilkBatchSpec[] = [
  { code: "mb_toned_milk", name: "Toned Milk (batch rate)", fat: 3.05, snf: 8.55 },
  { code: "mb_cow_milk", name: "Cow Milk (batch rate)", fat: 4, snf: 8.5,
    notes: "Assumed CM = Cow Milk - confirm with Darshan if it means something else" },
  { code: "mb_plain_dahi", name: "Plain Dahi 14.5% TS (batch rate)", fat: 3, snf: 11.5, fermented: true },
  { code: "mb_plain_dahi_13", name: "Plain Dahi 13.0% TS (batch rate)", fat: 0, snf: 0, fermented: true,
    notes: "Total solids target is 13.0% but the fat/SNF split wasn't given - fill in fat and snf" },
  { code: "mb_kadhi_dahi", name: "Kadhi Dahi (batch rate)", fat: 0, snf: 10, fermented: true },
];

/** product code -> milk_batch object code its "milk"/"dahi" input line should cost off */
const PRODUCT_MILK_SOURCE: Record<string, string> = {
  sweet_dahi_cup_lychee: "mb_toned_milk",
  sweet_dahi_cup_muskmelon: "mb_toned_milk",
  sweet_lassi_cup: "mb_plain_dahi",
  sweet_lassi_pouch: "mb_plain_dahi",
  sweet_lassi_mango: "mb_plain_dahi",
  sweet_lassi_strawberry: "mb_plain_dahi",
  sweet_milk: "mb_toned_milk",
  masala_chaach_cup: "mb_plain_dahi",
  rabadi: "mb_toned_milk",
  peda: "mb_toned_milk",
  kesar_peda: "mb_toned_milk",
  khowa: "mb_toned_milk",
  plain_dahi_14_5: "mb_plain_dahi",
  plain_dahi_13_0: "mb_plain_dahi_13",
  kadhi_dahi: "mb_kadhi_dahi",
  tm: "mb_toned_milk",
  cm: "mb_cow_milk",
  misti_doi: "mb_toned_milk",
  shrikhand: "mb_toned_milk",
};

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local app.actor = 'seed-batch-costing'");

    const scenario = await client.query<{ id: string }>(
      `select id from scenario order by (status = 'active') desc, created_at desc limit 1`,
    );
    if (!scenario.rows.length) throw new Error("No scenario found - run `npm run db:setup` first");
    const sid = scenario.rows[0].id;

    // ---- parameters -----------------------------------------------------------
    for (const [i, p] of PARAMETERS.entries()) {
      const existing = await client.query(`select 1 from parameter where scenario_id = $1 and key = $2`, [sid, p.key]);
      if (existing.rows.length) continue;
      await client.query(
        `insert into parameter (scenario_id, key, label, group_name, value_num, suffix, description, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [sid, p.key, p.label, p.group, p.value ?? null, p.suffix ?? null, p.description ?? null, 200 + i],
      );
    }

    async function classIdOf(code: string): Promise<string> {
      const r = await client.query<{ id: string }>(`select id from object_class where scenario_id = $1 and code = $2`, [sid, code]);
      if (!r.rows.length) throw new Error(`Class ${code} not found - run seed-sweet-products.ts first`);
      return r.rows[0].id;
    }
    const productClassId = await classIdOf("product");
    const packagingClassId = await classIdOf("packaging");
    const ingredientClassId = await classIdOf("ingredient");

    async function ensureGroup(classId: string, code: string, label: string, sortOrder: number): Promise<string> {
      const existing = await client.query<{ id: string }>(`select id from field_group where class_id = $1 and code = $2`, [classId, code]);
      if (existing.rows.length) return existing.rows[0].id;
      const row = await client.query<{ id: string }>(
        `insert into field_group (scenario_id, class_id, code, label, sort_order) values ($1,$2,$3,$4,$5) returning id`,
        [sid, classId, code, label, sortOrder],
      );
      return row.rows[0].id;
    }

    async function fieldIdOf(classId: string, key: string): Promise<string | null> {
      const r = await client.query<{ id: string }>(`select id from field_def where class_id = $1 and key = $2`, [classId, key]);
      return r.rows.length ? r.rows[0].id : null;
    }

    async function ensureField(opts: {
      classId: string; key: string; label: string; groupId: string | null;
      dataType?: "number" | "text"; defaultValue?: number; defaultFormula?: string;
      rollupGroup?: string; isTotal?: boolean; decimals?: number; sortOrder: number;
    }): Promise<string> {
      const existing = await fieldIdOf(opts.classId, opts.key);
      if (existing) return existing;
      const row = await client.query<{ id: string }>(
        `insert into field_def (scenario_id, class_id, key, label, data_type, group_id, default_value,
                                default_formula, rollup_group, is_total, decimals, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
        [sid, opts.classId, opts.key, opts.label, opts.dataType ?? "number", opts.groupId,
         opts.defaultValue ?? null, opts.defaultFormula ?? null, opts.rollupGroup ?? null,
         opts.isTotal ?? false, opts.decimals ?? 2, opts.sortOrder],
      );
      return row.rows[0].id;
    }

    async function tagField(fieldDefId: string, tag: string, sign = 1) {
      await client.query(
        `insert into field_rollup_tag (field_def_id, tag, sign) values ($1,$2,$3)
         on conflict (field_def_id, tag) do nothing`,
        [fieldDefId, tag, sign],
      );
    }

    // ---- milk_batch class -------------------------------------------------------
    let milkBatchClassId: string;
    const existingClass = await client.query<{ id: string }>(`select id from object_class where scenario_id = $1 and code = 'milk_batch'`, [sid]);
    if (existingClass.rows.length) {
      milkBatchClassId = existingClass.rows[0].id;
    } else {
      const row = await client.query<{ id: string }>(
        `insert into object_class (scenario_id, code, name, plural_name, cost_field, sort_order)
         values ($1,'milk_batch','Milk / Batch Rate','Milk & Batch Rates','total_cost_per_l',50) returning id`,
        [sid],
      );
      milkBatchClassId = row.rows[0].id;
    }
    const compositionGroup = await ensureGroup(milkBatchClassId, "composition", "Composition", 0);
    const buildUpGroup = await ensureGroup(milkBatchClassId, "build_up", "Cost build-up per litre", 1);

    const fFat = await ensureField({ classId: milkBatchClassId, key: "fat", label: "Fat", groupId: compositionGroup, defaultValue: 0, sortOrder: 0 });
    await ensureField({ classId: milkBatchClassId, key: "snf", label: "SNF", groupId: compositionGroup, defaultValue: 0, sortOrder: 1 });
    const fSolids = await ensureField({
      classId: milkBatchClassId, key: "solids_rate", label: "Solids rate", groupId: buildUpGroup,
      defaultFormula: "(fat + snf) * P.base_rate / P.ts_divisor", sortOrder: 2,
    });
    const fCommission = await ensureField({
      classId: milkBatchClassId, key: "commission", label: "Sachiv commission", groupId: buildUpGroup,
      defaultFormula: "solids_rate * P.sachiv_commission_pct", sortOrder: 3,
    });
    const fProcTransport = await ensureField({
      classId: milkBatchClassId, key: "proc_transport", label: "Procurement transport", groupId: buildUpGroup,
      defaultFormula: "P.proc_transport_rate / P.proc_transport_basis * (fat + snf)", sortOrder: 4,
    });
    const fUtilities = await ensureField({
      classId: milkBatchClassId, key: "utilities", label: "Coal + labour + electricity + plant staff", groupId: buildUpGroup,
      defaultFormula: "P.utilities_default", sortOrder: 5,
    });
    const fChemicals = await ensureField({
      classId: milkBatchClassId, key: "chemicals", label: "Chemicals (culture, cleaning, lab)", groupId: buildUpGroup,
      defaultFormula: "P.chemicals_default", sortOrder: 6,
    });
    const fTotal = await ensureField({
      classId: milkBatchClassId, key: "total_cost_per_l", label: "Total batch cost / litre", groupId: buildUpGroup,
      rollupGroup: "batch_cost", isTotal: true, decimals: 4, sortOrder: 7,
    });
    for (const f of [fSolids, fCommission, fProcTransport, fUtilities, fChemicals]) await tagField(f, "batch_cost");
    void fFat; void fTotal;

    // ---- milk_batch objects -----------------------------------------------------
    const mbObjectId = new Map<string, string>();
    for (const [i, m] of MILK_BATCHES.entries()) {
      let id: string;
      const existingObj = await client.query<{ id: string }>(`select id from cost_object where scenario_id = $1 and code = $2`, [sid, m.code]);
      if (existingObj.rows.length) {
        id = existingObj.rows[0].id;
      } else {
        const row = await client.query<{ id: string }>(
          `insert into cost_object (scenario_id, class_id, code, name, notes, sort_order)
           values ($1,$2,$3,$4,$5,$6) returning id`,
          [sid, milkBatchClassId, m.code, m.name, m.notes ?? null, i],
        );
        id = row.rows[0].id;
      }
      mbObjectId.set(m.code, id);

      const fatFieldId = await fieldIdOf(milkBatchClassId, "fat");
      const snfFieldId = await fieldIdOf(milkBatchClassId, "snf");
      await client.query(
        `insert into field_value (object_id, field_def_id, value_num) values ($1,$2,$3)
         on conflict (object_id, field_def_id) do update set value_num = excluded.value_num`,
        [id, fatFieldId, m.fat],
      );
      await client.query(
        `insert into field_value (object_id, field_def_id, value_num) values ($1,$2,$3)
         on conflict (object_id, field_def_id) do update set value_num = excluded.value_num`,
        [id, snfFieldId, m.snf],
      );
      if (m.fermented) {
        const chemFieldId = await fieldIdOf(milkBatchClassId, "chemicals");
        await client.query(
          `insert into field_value (object_id, field_def_id, formula) values ($1,$2,$3)
           on conflict (object_id, field_def_id) do update set formula = excluded.formula`,
          [id, chemFieldId, "P.chemicals_fermented"],
        );
      }
    }

    // ---- product class: market transport + landed cost --------------------------
    const totalsGroupRow = await client.query<{ id: string }>(`select id from field_group where class_id = $1 and code = 'totals'`, [productClassId]);
    const totalsGroupId = totalsGroupRow.rows[0]?.id ?? null;
    const marketGroupId = await ensureGroup(productClassId, "market", "Market", 3);
    if (totalsGroupId) await client.query(`update field_group set sort_order = 4 where id = $1`, [totalsGroupId]);

    await ensureField({
      classId: productClassId, key: "market_transport_rate", label: "Market transport rate", groupId: marketGroupId,
      defaultFormula: "P.market_transport_rate", decimals: 2, sortOrder: 6,
    });
    const fMarketCost = await ensureField({
      classId: productClassId, key: "market_transport_cost", label: "Market transport cost", groupId: marketGroupId,
      defaultFormula: "market_transport_rate * batch_qty", decimals: 2, sortOrder: 7,
    });

    const batchCostFieldId = await fieldIdOf(productClassId, "batch_cost");
    if (batchCostFieldId) await tagField(batchCostFieldId, "landed_cost");
    await tagField(fMarketCost, "landed_cost");

    const landedFieldId = await ensureField({
      classId: productClassId, key: "landed_cost", label: "Landed cost (ex-plant + market transport)", groupId: totalsGroupId,
      rollupGroup: "landed_cost", isTotal: true, decimals: 2, sortOrder: 10,
    });
    void landedFieldId;

    // keep every group's fields contiguous by sort_order - the object detail
    // page groups fields into visual sections by consecutive-run, not by
    // group_id, so an interleaved order renders (and React-keys) the same
    // group label twice.
    await client.query(
      `update field_def set sort_order = 8 where class_id = $1 and key = 'batch_cost'`, [productClassId],
    );
    await client.query(
      `update field_def set sort_order = 9,
              default_formula = 'DIV(landed_cost, batch_qty, 0)'
       where class_id = $1 and key = 'cost_per_unit'`,
      [productClassId],
    );

    // ---- packaging class: GST-loaded rate ---------------------------------------
    const packagingRatesGroup = await client.query<{ id: string }>(`select id from field_group where class_id = $1 and code = 'rates'`, [packagingClassId]);
    await ensureField({
      classId: packagingClassId, key: "rate_with_gst", label: "Rate incl. GST", groupId: packagingRatesGroup.rows[0]?.id ?? null,
      defaultFormula: "rate * (1 + P.gst_packing)", decimals: 4, sortOrder: 2,
    });

    // ---- ingredient class: GST-loaded rate ---------------------------------------
    const ingredientRatesGroup = await client.query<{ id: string }>(`select id from field_group where class_id = $1 and code = 'rates'`, [ingredientClassId]);
    await ensureField({
      classId: ingredientClassId, key: "rate_with_gst", label: "Rate incl. GST", groupId: ingredientRatesGroup.rows[0]?.id ?? null,
      defaultFormula: "rate * (1 + P.gst_ingredient)", decimals: 4, sortOrder: 2,
    });

    // ---- repoint each product's milk/dahi input line at its milk_batch --------
    for (const [productCode, mbCode] of Object.entries(PRODUCT_MILK_SOURCE)) {
      const mbId = mbObjectId.get(mbCode);
      if (!mbId) throw new Error(`Unknown milk_batch ${mbCode}`);
      await client.query(
        `update bom_line set component_object_id = $1
         where parent_object_id = (select id from cost_object where scenario_id = $2 and code = $3)
           and line_type = 'input'
           and component_object_id in (
             select id from cost_object where scenario_id = $2 and code in ('milk', 'dahi')
           )`,
        [mbId, sid, productCode],
      );
    }

    await client.query("commit");
    console.log(`Added milk_batch class (${MILK_BATCHES.length} objects), market transport + landed cost on product, GST-loaded packaging rate.`);
    console.log(`Repointed milk/dahi input lines on ${Object.keys(PRODUCT_MILK_SOURCE).length} products to their milk_batch source.`);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  const { recompute } = await import("../src/lib/model/recompute");
  const scenarioRow = await pool.query<{ id: string }>(
    `select id from scenario order by (status = 'active') desc, created_at desc limit 1`,
  );
  const { result, durationMs } = await recompute(scenarioRow.rows[0].id, "seed-batch-costing");
  console.log(`Calculated ${result.nodes.size} nodes in ${durationMs} ms, ${result.errorCount} errors.`);
  for (const [key, r] of result.nodes) {
    if (r.error) console.log(`  ! ${key}: ${r.error}`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
