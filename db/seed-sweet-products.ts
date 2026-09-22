/**
 * Adds the sweet-dahi / lassi / rabadi / peda / khowa / plain-dahi / TM-CM
 * product line from Darshan's recipe sheet into the *existing* scenario.
 *
 * Unlike `seed.ts` this never truncates - it creates the `ingredient`,
 * `packaging` and `product` classes only if they don't already exist yet,
 * then adds new cost_object rows for whatever isn't already there. Safe to
 * run once against the empty (or partially built) database from `db:setup`.
 *
 * Percentages/ratios from the sheet (e.g. "Sugar(14%)", "2 ml/40 Lte") become
 * BOM qty formulas against a per-product `batch_qty` field, so they scale if
 * the batch size changes. Where the sheet gave no ratio at all, the line is
 * left with qty = 0 for you to fill in from the UI.
 */
import "dotenv/config";
import { pool } from "../src/lib/db";

type Num = number | string; // string = formula
const isFormula = (v: Num | null | undefined): v is string => typeof v === "string";

interface FieldSpec {
  key: string; label: string; group: string;
  formula?: string; value?: number; rollup?: string; tags?: string[];
  total?: boolean; decimals?: number; dataType?: "number" | "text";
}

interface LineSpec {
  type: "input" | "packaging" | "additive";
  comp: string;
  qty?: Num;
  notes?: string;
}

interface MasterSpec { code: string; name: string; unit: string }

interface ProductSpec {
  code: string; name: string;
  batchQty?: number; batchUnit?: string; batchBasis?: string;
  lines: LineSpec[];
}

// ---------------------------------------------------------------------------
// Classes (only created if missing)
// ---------------------------------------------------------------------------
const RATE_FIELDS: FieldSpec[] = [
  { key: "rate", label: "Rate per unit", group: "rates", value: 0, decimals: 4, total: true },
  { key: "unit", label: "Unit", group: "rates", dataType: "text" },
];

const CLASSES: Array<{
  code: string; name: string; plural: string; costField: string;
  groups: Array<{ code: string; label: string }>; fields: FieldSpec[];
}> = [
  {
    code: "ingredient", name: "Ingredient", plural: "Ingredients", costField: "rate",
    groups: [{ code: "rates", label: "Rates" }], fields: RATE_FIELDS,
  },
  {
    code: "packaging", name: "Packaging Item", plural: "Packaging", costField: "rate",
    groups: [{ code: "rates", label: "Rates" }], fields: RATE_FIELDS,
  },
  {
    code: "product", name: "Product", plural: "Products", costField: "cost_per_unit",
    groups: [
      { code: "basis", label: "Basis" },
      { code: "composition", label: "Composition" },
      { code: "packing", label: "Packing" },
      { code: "totals", label: "Totals" },
    ],
    fields: [
      { key: "batch_qty", label: "Batch quantity", group: "basis", value: 0, decimals: 2 },
      { key: "batch_unit", label: "Batch unit", group: "basis", dataType: "text" },
      { key: "batch_basis", label: "Basis note", group: "basis", dataType: "text" },
      { key: "material_cost", label: "Milk / base material cost", group: "composition", formula: 'BOM("input")', tags: ["batch_cost"] },
      { key: "additive_cost", label: "Additives cost (sugar, flavour, colour...)", group: "composition", formula: 'BOM("additive")', tags: ["batch_cost"] },
      { key: "packing_cost", label: "Packing cost", group: "packing", formula: 'BOM("packaging")', tags: ["batch_cost"] },
      { key: "batch_cost", label: "Total batch cost", group: "totals", rollup: "batch_cost", total: true },
      { key: "cost_per_unit", label: "Cost per litre / kg", group: "totals", formula: "DIV(batch_cost, batch_qty, 0)", decimals: 4 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Ingredient / packaging master data (rates left at 0 - fill in from the UI)
// ---------------------------------------------------------------------------
const INGREDIENTS: MasterSpec[] = [
  { code: "milk", name: "Milk", unit: "L" },
  { code: "dahi", name: "Dahi (curd base)", unit: "L" },
  { code: "water", name: "Water", unit: "L" },
  { code: "paneer", name: "Paneer", unit: "kg" },
  { code: "sugar", name: "Sugar", unit: "kg" },
  { code: "lychee_flavour", name: "Lychee Flavour", unit: "ml" },
  { code: "raspberry_red_colour", name: "Raspberry Red Colour", unit: "g" },
  { code: "muskmelon_flavour", name: "Muskmelon Flavour", unit: "ml" },
  { code: "lemon_yellow_colour", name: "Lemon Yellow Colour", unit: "g" },
  { code: "rose_flavour", name: "Rose Flavour", unit: "ml" },
  { code: "mango_pulp", name: "Mango Pulp", unit: "kg" },
  { code: "strawberry_pulp", name: "Strawberry Pulp", unit: "kg" },
  { code: "jeera", name: "Jeera", unit: "kg" },
  { code: "white_salt", name: "White Salt", unit: "kg" },
  { code: "black_salt", name: "Black Salt", unit: "kg" },
  { code: "kali_mirch", name: "Kali Mirch", unit: "kg" },
  { code: "pista", name: "Pista", unit: "kg" },
  { code: "badam", name: "Badam", unit: "kg" },
  { code: "elaichi", name: "Elaichi", unit: "kg" },
  { code: "kesari_colour", name: "Kesari / Saffron Colour", unit: "g" },
  { code: "cardamom_flavour", name: "Cardamom Flavour", unit: "ml" },
  { code: "bangali_booster", name: "Bangali Booster", unit: "g" },
  { code: "saffron_flavour", name: "Saffron Flavour", unit: "ml" },
  { code: "culture", name: "Culture", unit: "U" },
  { code: "lactovit", name: "Lactovit (protein / vitamin premix)", unit: "g" },
  { code: "colour", name: "Colour (generic)", unit: "g" },
  { code: "flavour", name: "Flavour (generic)", unit: "ml" },
];

const PACKAGING: MasterSpec[] = [
  { code: "cup", name: "Cup", unit: "pc" },
  { code: "poly_film", name: "Poly Film", unit: "kg" },
  { code: "box", name: "Box", unit: "pc" },
  { code: "pouch", name: "Pouch", unit: "pc" },
];

// ---------------------------------------------------------------------------
// Products - from the recipe sheet, one section at a time
// ---------------------------------------------------------------------------
const PRODUCTS: ProductSpec[] = [
  {
    code: "sweet_dahi_cup_lychee", name: "Sweet Dahi (Cup) - Lychee",
    batchQty: 40, batchUnit: "L", batchBasis: "Per 40 L milk batch",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "sugar", qty: "batch_qty * 14%" },
      { type: "additive", comp: "lychee_flavour", qty: "batch_qty / 40 * 2" },
      { type: "additive", comp: "raspberry_red_colour", qty: "batch_qty / 40 * 2" },
      { type: "packaging", comp: "cup" },
    ],
  },
  {
    code: "sweet_dahi_cup_muskmelon", name: "Sweet Dahi (Cup) - Muskmelon",
    batchQty: 40, batchUnit: "L", batchBasis: "Per 40 L milk batch",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "sugar", qty: "batch_qty * 14%" },
      { type: "additive", comp: "muskmelon_flavour", qty: "batch_qty / 40 * 12" },
      { type: "additive", comp: "lemon_yellow_colour", qty: "batch_qty / 40 * 2" },
      { type: "packaging", comp: "cup" },
    ],
  },
  {
    code: "sweet_lassi_cup", name: "Sweet Lassi (Cup)",
    lines: [
      { type: "input", comp: "dahi", qty: "batch_qty" },
      { type: "additive", comp: "sugar", qty: "batch_qty * 20%" },
      { type: "additive", comp: "rose_flavour", qty: "batch_qty * 0.05%" },
      { type: "input", comp: "water", notes: "Ratio not fixed yet" },
      { type: "packaging", comp: "cup" },
    ],
  },
  {
    code: "sweet_lassi_pouch", name: "Sweet Lassi (Pouch)",
    lines: [
      { type: "input", comp: "dahi", qty: "batch_qty" },
      { type: "additive", comp: "sugar", qty: "batch_qty * 14%" },
      { type: "additive", comp: "flavour", qty: "batch_qty * 0.05%" },
      { type: "input", comp: "water", qty: "batch_qty * 180%" },
      { type: "packaging", comp: "poly_film" },
    ],
  },
  {
    code: "sweet_lassi_mango", name: "Sweet Lassi - Mango",
    lines: [
      { type: "input", comp: "dahi", qty: "batch_qty" },
      { type: "additive", comp: "sugar", qty: "batch_qty * 16%" },
      { type: "input", comp: "water", notes: "Ratio not fixed yet" },
      { type: "additive", comp: "mango_pulp", qty: "batch_qty * 15%" },
      { type: "packaging", comp: "cup" },
    ],
  },
  {
    code: "sweet_lassi_strawberry", name: "Sweet Lassi - Strawberry",
    lines: [
      { type: "input", comp: "dahi", qty: "batch_qty" },
      { type: "additive", comp: "sugar", qty: "batch_qty * 16%" },
      { type: "input", comp: "water", notes: "Ratio not fixed yet" },
      { type: "additive", comp: "strawberry_pulp", qty: "batch_qty * 15%" },
      { type: "packaging", comp: "cup" },
    ],
  },
  {
    code: "sweet_milk", name: "Sweet Milk",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "sugar", qty: "batch_qty * 12%" },
      { type: "additive", comp: "lemon_yellow_colour", notes: "Qty not fixed yet" },
      { type: "additive", comp: "flavour", notes: "Qty not fixed yet" },
      { type: "packaging", comp: "poly_film" },
    ],
  },
  {
    code: "masala_chaach_cup", name: "Masala Chaach (Cup)",
    lines: [
      { type: "input", comp: "dahi", qty: "batch_qty" },
      { type: "additive", comp: "jeera", qty: "batch_qty * 0.7%" },
      { type: "additive", comp: "white_salt", qty: "batch_qty * 1.5%" },
      { type: "additive", comp: "black_salt", qty: "batch_qty * 0.5%" },
      { type: "additive", comp: "kali_mirch", qty: "batch_qty * 0.3%" },
      { type: "input", comp: "water", notes: "Ratio not fixed yet" },
    ],
  },
  {
    code: "rabadi", name: "Rabadi",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "sugar", qty: "batch_qty * 6.5%" },
      { type: "input", comp: "paneer", notes: "As per milk - ratio not fixed yet" },
      { type: "additive", comp: "pista", qty: "batch_qty * 0.1%" },
      { type: "additive", comp: "badam", qty: "batch_qty * 0.2%" },
      { type: "additive", comp: "elaichi", qty: "batch_qty * 0.11%" },
      { type: "additive", comp: "kesari_colour", notes: "4% of finished Rabadi, not milk - enter once yield is known" },
      { type: "packaging", comp: "cup" },
    ],
  },
  {
    code: "peda", name: "Peda",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "sugar", qty: "batch_qty * 7.5%" },
      { type: "additive", comp: "cardamom_flavour", notes: "Qty not fixed yet" },
      { type: "additive", comp: "bangali_booster", notes: "Qty not fixed yet" },
      { type: "packaging", comp: "box" },
    ],
  },
  {
    code: "kesar_peda", name: "Kesar Peda",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "sugar", qty: "batch_qty * 7.5%" },
      { type: "additive", comp: "cardamom_flavour", notes: "Qty not fixed yet" },
      { type: "additive", comp: "bangali_booster", notes: "Qty not fixed yet" },
      { type: "additive", comp: "kesari_colour", notes: "2 g per 1 kg finished peda" },
      { type: "additive", comp: "saffron_flavour", notes: "8 ml per 1 kg finished peda" },
      { type: "packaging", comp: "box" },
    ],
  },
  {
    code: "khowa", name: "Khowa",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "packaging", comp: "pouch" },
    ],
  },
  {
    code: "plain_dahi_14_5", name: "Plain Dahi (14.5)",
    batchQty: 500, batchUnit: "L", batchBasis: "Per 500 L milk batch",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "culture", qty: "batch_qty / 500 * 50" },
      { type: "additive", comp: "lactovit", qty: "batch_qty / 500 * 100" },
    ],
  },
  {
    code: "plain_dahi_13_0", name: "Plain Dahi (13.0)",
    batchQty: 500, batchUnit: "L", batchBasis: "Per 500 L milk batch",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "culture", qty: "batch_qty / 500 * 50" },
      { type: "additive", comp: "lactovit", qty: "batch_qty / 500 * 200" },
    ],
  },
  {
    code: "kadhi_dahi", name: "Kadhi Dahi",
    batchQty: 500, batchUnit: "L", batchBasis: "Per 500 L milk batch",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "culture", qty: "batch_qty / 500 * 50" },
      { type: "additive", comp: "lactovit", qty: "batch_qty / 500 * 200" },
    ],
  },
  {
    code: "tm", name: "TM",
    batchQty: 1000, batchUnit: "L", batchBasis: "Per 1000 L milk batch",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "lactovit", qty: "batch_qty / 1000 * 20" },
    ],
  },
  {
    code: "cm", name: "CM",
    batchQty: 1000, batchUnit: "L", batchBasis: "Per 1000 L milk batch",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "lactovit", qty: "batch_qty / 1000 * 20" },
    ],
  },
  {
    code: "misti_doi", name: "Misti Doi",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "sugar", notes: "Qty not fixed yet" },
      { type: "additive", comp: "colour", notes: "Qty not fixed yet" },
      { type: "additive", comp: "flavour", notes: "Qty not fixed yet" },
      { type: "packaging", comp: "cup" },
    ],
  },
  {
    code: "shrikhand", name: "ShriKhand",
    lines: [
      { type: "input", comp: "milk", qty: "batch_qty" },
      { type: "additive", comp: "sugar", notes: "Qty not fixed yet" },
      { type: "additive", comp: "colour", notes: "Qty not fixed yet" },
      { type: "additive", comp: "flavour", notes: "Qty not fixed yet" },
      { type: "packaging", comp: "poly_film" },
    ],
  },
];

// ---------------------------------------------------------------------------
async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local app.actor = 'seed-sweet-products'");

    const scenario = await client.query<{ id: string }>(
      `select id from scenario order by (status = 'active') desc, created_at desc limit 1`,
    );
    if (!scenario.rows.length) throw new Error("No scenario found - run `npm run db:setup` first");
    const sid = scenario.rows[0].id;

    // ---- classes / groups / fields (create only if missing) ----------------
    const classId = new Map<string, string>();
    const fieldId = new Map<string, string>(); // `${classCode}.${key}`

    for (const [ci, c] of CLASSES.entries()) {
      const existing = await client.query<{ id: string }>(
        `select id from object_class where scenario_id = $1 and code = $2`, [sid, c.code],
      );
      let classRowId: string;
      if (existing.rows.length) {
        classRowId = existing.rows[0].id;
      } else {
        const row = await client.query<{ id: string }>(
          `insert into object_class (scenario_id, code, name, plural_name, cost_field, sort_order)
           values ($1,$2,$3,$4,$5,$6) returning id`,
          [sid, c.code, c.name, c.plural, c.costField, 100 + ci],
        );
        classRowId = row.rows[0].id;
      }
      classId.set(c.code, classRowId);

      const groupId = new Map<string, string>();
      for (const [gi, g] of c.groups.entries()) {
        const existingGroup = await client.query<{ id: string }>(
          `select id from field_group where class_id = $1 and code = $2`, [classRowId, g.code],
        );
        if (existingGroup.rows.length) {
          groupId.set(g.code, existingGroup.rows[0].id);
        } else {
          const gr = await client.query<{ id: string }>(
            `insert into field_group (scenario_id, class_id, code, label, sort_order)
             values ($1,$2,$3,$4,$5) returning id`,
            [sid, classRowId, g.code, g.label, gi],
          );
          groupId.set(g.code, gr.rows[0].id);
        }
      }

      for (const [fi, f] of c.fields.entries()) {
        const existingField = await client.query<{ id: string }>(
          `select id from field_def where class_id = $1 and key = $2`, [classRowId, f.key],
        );
        let fid: string;
        if (existingField.rows.length) {
          fid = existingField.rows[0].id;
        } else {
          const fr = await client.query<{ id: string }>(
            `insert into field_def (scenario_id, class_id, key, label, data_type, group_id, default_value,
                                    default_formula, rollup_group, is_total, decimals, sort_order)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
            [sid, classRowId, f.key, f.label, f.dataType ?? "number",
             groupId.get(f.group) ?? null, f.value ?? null, f.formula ?? null,
             f.rollup ?? null, f.total ?? false, f.decimals ?? 2, fi],
          );
          fid = fr.rows[0].id;
          for (const tag of f.tags ?? []) {
            await client.query(`insert into field_rollup_tag (field_def_id, tag) values ($1,$2)`, [fid, tag]);
          }
        }
        fieldId.set(`${c.code}.${f.key}`, fid);
      }
    }

    // ---- ingredient / packaging master rows ---------------------------------
    const objectId = new Map<string, string>();

    async function ensureObject(classCode: string, code: string, name: string): Promise<string> {
      const existing = await client.query<{ id: string }>(
        `select id from cost_object where scenario_id = $1 and code = $2`, [sid, code],
      );
      if (existing.rows.length) return existing.rows[0].id;
      const row = await client.query<{ id: string }>(
        `insert into cost_object (scenario_id, class_id, code, name, sort_order)
         values ($1,$2,$3,$4,$5) returning id`,
        [sid, classId.get(classCode), code, name, 0],
      );
      return row.rows[0].id;
    }

    async function setTextValue(objectId_: string, classCode: string, key: string, text: string) {
      const fid = fieldId.get(`${classCode}.${key}`);
      if (!fid) throw new Error(`Unknown field ${classCode}.${key}`);
      await client.query(
        `insert into field_value (object_id, field_def_id, value_text)
         values ($1,$2,$3)
         on conflict (object_id, field_def_id) do update set value_text = excluded.value_text`,
        [objectId_, fid, text],
      );
    }

    for (const m of INGREDIENTS) {
      const id = await ensureObject("ingredient", m.code, m.name);
      objectId.set(m.code, id);
      await setTextValue(id, "ingredient", "unit", m.unit);
    }
    for (const m of PACKAGING) {
      const id = await ensureObject("packaging", m.code, m.name);
      objectId.set(m.code, id);
      await setTextValue(id, "packaging", "unit", m.unit);
    }

    // ---- products -------------------------------------------------------------
    for (const [pi, p] of PRODUCTS.entries()) {
      const id = await ensureObject("product", p.code, p.name);
      objectId.set(p.code, id);
      await client.query(`update cost_object set sort_order = $1 where id = $2`, [pi, id]);

      if (p.batchQty !== undefined) {
        const fid = fieldId.get("product.batch_qty")!;
        await client.query(
          `insert into field_value (object_id, field_def_id, value_num)
           values ($1,$2,$3)
           on conflict (object_id, field_def_id) do update set value_num = excluded.value_num`,
          [id, fid, p.batchQty],
        );
      }
      if (p.batchUnit) await setTextValue(id, "product", "batch_unit", p.batchUnit);
      if (p.batchBasis) await setTextValue(id, "product", "batch_basis", p.batchBasis);

      // clear any BOM lines from a previous run of this script, then re-add
      await client.query(`delete from bom_line where parent_object_id = $1`, [id]);
      for (const [li, l] of p.lines.entries()) {
        const compId = objectId.get(l.comp);
        if (!compId) throw new Error(`Unknown component ${l.comp} on ${p.code}`);
        await client.query(
          `insert into bom_line (scenario_id, parent_object_id, component_object_id, line_type,
                                 qty, qty_formula, notes, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [sid, id, compId, l.type,
           isFormula(l.qty) ? null : l.qty ?? null, isFormula(l.qty) ? l.qty : null,
           l.notes ?? null, li],
        );
      }
    }

    await client.query("commit");
    console.log(`Added ${INGREDIENTS.length} ingredients, ${PACKAGING.length} packaging items, ${PRODUCTS.length} products.`);
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
  const { result, durationMs } = await recompute(scenarioRow.rows[0].id, "seed-sweet-products");
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
