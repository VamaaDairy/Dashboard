/**
 * Demo data for 1 Sep - 6 Oct 2026, end to end - so every page and dashboard has
 * something real-looking to show:
 *
 *   milk in      the real Vamaa collections for those days go into RMST1, and
 *                demo tanker loads top the plant up to its daily need
 *   tanks        -> bulk batches: every product's milk drawn from the tanks,
 *                ingredient quantities, and the yield
 *   SKU packing  each batch packed into its SKUs, with packing material
 *   transport    km / trips / diesel for every transporter, both sections
 *   fuel         coal burned in the plant
 *   electricity  units used; labour - labourers and amount
 *
 * Ingredient and packaging rates (all 0 until now) are set to typical market
 * prices, a few packaging items the SKUs need are added, and the unlinked
 * dahi / Maxx SKUs are linked to a bulk product. Every row inserted and every
 * value replaced is recorded in demo_seed, so:
 *
 *   npm run db:seed:demo             # fill 1-6 Oct
 *   npm run db:seed:demo -- --undo   # take all of it out again, put old values back
 *
 * Runs through the app's own engine (tank ledger, fuel sync, day costing), so
 * the numbers are exactly what the pages would have produced.
 */
import "dotenv/config";
import type { PoolClient } from "pg";
import { one, pool, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { recompute } from "@/lib/model/recompute";
import { centers, ensureDays, storedCollections } from "@/lib/vamaa/sync";
import { collectionMilk, collectionRef } from "@/lib/vamaa/keys";
import { collectionPrice, getChart } from "@/lib/procurement/rate-chart";
import { recomputeTank, syncBatchMilk } from "@/lib/tanks/engine";
import { syncMilkProcessed } from "@/lib/production/sync";
import { syncFuelDays } from "@/lib/transport/sync";
import { syncPlantFuelDays } from "@/lib/fuel/plant";
import { freezeDay } from "@/lib/daily/compute";

const FIRST = "2026-09-01", LAST = "2026-10-06";
const DATES: string[] = [];
for (let d = new Date(`${FIRST}T00:00:00Z`); d.toISOString().slice(0, 10) <= LAST; d.setUTCDate(d.getUTCDate() + 1)) DATES.push(d.toISOString().slice(0, 10));
// a plant runs lighter on Sunday and heavier into the weekend (sweets, dahi); Sep -> Oct the
// festive season builds slowly
const WEEKDAY_FACTOR = [0.88, 1.0, 0.97, 1.0, 1.02, 1.05, 1.08];   // Sun..Sat
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

// ---------------------------------------------------------------- plan
// litres of milk a product takes on a full day, its yield per litre (in the
// product's unit), and the weekdays it is made, 0 = Sunday (every day when omitted).
// Yields are what 4.0-4.2% fat milk gives: paneer ~18%, khowa ~21%, ghee ~3.7 kg
// per 100 L (about 88% of the fat recovered), set dahi gains ~3% with added protein.
const PLAN: { code: string; milk: number; yield: number; days?: number[] }[] = [
  { code: "toned_milk", milk: 3000, yield: 0.995 },
  { code: "cow_milk", milk: 800, yield: 0.995 },
  { code: "sweet_milk", milk: 300, yield: 1.06, days: [1, 3, 5] },
  { code: "plain_dahi_14_5_ts", milk: 1500, yield: 1.03 },
  { code: "plain_dahi_13_0_ts", milk: 600, yield: 1.01 },
  { code: "kadhi_dahi", milk: 500, yield: 1.0 },
  { code: "sweet_dahi_lychee", milk: 60, yield: 1.08, days: [2, 6] },
  { code: "sweet_dahi_muskmelon", milk: 60, yield: 1.08, days: [3, 0] },
  { code: "misti_doi", milk: 100, yield: 0.95, days: [1, 4, 6] },
  { code: "sweet_lassi", milk: 300, yield: 1.4 },
  { code: "sweet_lassi_mango", milk: 150, yield: 1.45, days: [0, 2, 4, 5] },
  { code: "sweet_lassi_strawberry", milk: 100, yield: 1.45, days: [1, 3, 6] },
  { code: "masala_chaach", milk: 200, yield: 2.0 },
  { code: "shrikhand", milk: 150, yield: 0.4, days: [2, 5] },
  { code: "rabadi", milk: 150, yield: 0.38, days: [0, 4] },
  { code: "khowa", milk: 200, yield: 0.21, days: [1, 3, 5] },
  { code: "peda", milk: 200, yield: 0.34, days: [2, 4, 6] },
  { code: "kesar_peda", milk: 100, yield: 0.34, days: [0, 5] },
  { code: "paneer", milk: 1000, yield: 0.18 },
  { code: "desi_ghee", milk: 1200, yield: 0.037, days: [2, 4, 6] },
  { code: "cow_ghee", milk: 400, yield: 0.034, days: [3, 6] },
];

// ₹ per the ingredient's own unit
const INGREDIENT_RATES: Record<string, number> = {
  "Badam": 900, "Bangali Booster": 0.8, "Black Salt": 60, "Cardamom Flavour": 2, "Colour (generic)": 1.2,
  "Culture": 35, "Dahi (curd base)": 0, "Elaichi": 2800, "Flavour (generic)": 1.5, "Jeera": 320,
  "Kali Mirch": 750, "Kesari / Saffron Colour": 3, "Lactovit (protein / vitamin premix)": 2,
  "Lemon Yellow Colour": 1.2, "Lychee Flavour": 1.8, "Mango Pulp": 110, "Muskmelon Flavour": 1.8,
  "Paneer": 380, "Pista": 1600, "Protein": 0.38, "Raspberry Red Colour": 1.2, "Rose Flavour": 1.5,
  "Saffron Flavour": 4, "Strawberry Pulp": 160, "Sugar": 42, "Water": 0, "White Salt": 20,
};

/** How much of an ingredient (in the batch line's unit) per 100 L of milk, for a product. */
function dose(product: string, ingredient: string, unit: string): number {
  const sugar: Record<string, number> = {
    sweet_milk: 8, sweet_dahi_lychee: 10, sweet_dahi_muskmelon: 10, misti_doi: 14, sweet_lassi: 12,
    sweet_lassi_mango: 12, sweet_lassi_strawberry: 12, shrikhand: 45, rabadi: 15, peda: 35, kesar_peda: 35,
  };
  const protein: Record<string, number> = { plain_dahi_14_5_ts: 2000, plain_dahi_13_0_ts: 1000, kadhi_dahi: 500 };
  const byName: Record<string, number> = {
    "Lactovit (protein / vitamin premix)": 6, "Culture": 2, "Dahi (curd base)": 100,
    "Mango Pulp": 10, "Strawberry Pulp": 8, "Jeera": 0.3, "White Salt": 0.8, "Black Salt": 0.4, "Kali Mirch": 0.1,
    "Paneer": 3, "Pista": 0.4, "Badam": 0.5, "Elaichi": 0.08, "Bangali Booster": 60, "Citric Acid": 0.25,
    "Cardamom Flavour": 20, "Saffron Flavour": 10,
  };
  let q: number;
  if (ingredient === "Sugar") q = sugar[product] ?? 10;
  else if (ingredient === "Protein") q = protein[product] ?? 800;
  else if (ingredient === "Water") q = product === "masala_chaach" ? 95 : 35;
  else if (ingredient in byName) q = byName[ingredient];
  else if (/colour/i.test(ingredient)) q = 2;
  else if (/flavour/i.test(ingredient)) q = 15;
  else q = 1;
  // doses above are in the usual unit (g, ml, kg, L); a line entered in a bigger unit is scaled down
  if (unit === "L" && /flavour/i.test(ingredient)) q /= 1000;
  return q;
}

// share of each bulk product's yield that goes into each SKU (by SKU code)
const SKU_SPLIT: Record<string, Record<string, number>> = {
  toned_milk: { "1003": 1 },
  cow_milk: { "999": 1 },
  sweet_milk: { "1042": 0.4, "1045": 0.6 },
  plain_dahi_14_5_ts: { "1012": 0.3, "1013": 0.15, "1014": 0.18, "1011": 0.27, "1056": 0.1 },
  plain_dahi_13_0_ts: { "1015": 0.3, "1047": 0.3, "1016": 0.4 },
  kadhi_dahi: { "1020": 0.3, "1019": 0.2, "1021": 0.15, "1018": 0.15, "1022": 0.2 },
  sweet_dahi_lychee: { "1026": 1 },
  sweet_dahi_muskmelon: { "1027": 1 },
  misti_doi: { "1010": 1 },
  sweet_lassi: { "1023": 0.4, "1028": 0.6 },
  sweet_lassi_mango: { "1024": 1 },
  sweet_lassi_strawberry: { "1049": 1 },
  masala_chaach: { "1046": 1 },
  shrikhand: { "1043": 0.6, "1044": 0.4 },
  rabadi: { "1048": 1 },
  khowa: { "1058": 0.6, "1059": 0.4 },
  peda: { "1034": 1 },
  kesar_peda: { "1035": 1 },
  paneer: { "1005": 0.3, "1006": 0.25, "1007": 0.2, "1008": 0.15, "1009": 0.1 },
  desi_ghee: { "1055": 0.03, "1029": 0.12, "1030": 0.15, "1031": 0.2, "1038": 0.15, "1053": 0.1, "1032": 0.1, "1033": 0.15 },
  cow_ghee: { "1039": 0.2, "1040": 0.25, "1041": 0.25, "1054": 0.15, "1037": 0.15 },
};

// SKUs that weren't linked to a bulk product - linked here
const SKU_LINKS: Record<string, string> = {
  "1012": "plain_dahi_14_5_ts", "1013": "plain_dahi_14_5_ts", "1014": "plain_dahi_14_5_ts",
  "1011": "plain_dahi_14_5_ts", "1056": "plain_dahi_14_5_ts",
  "1015": "plain_dahi_13_0_ts", "1047": "plain_dahi_13_0_ts", "1016": "plain_dahi_13_0_ts",
  "1042": "sweet_milk", "1045": "sweet_milk",
};

// packaging items: unit and rate incl. GST (existing ones get a rate, the rest are added)
const PACKAGING: Record<string, { unit: "pc" | "kg"; rate: number }> = {
  "Box": { unit: "pc", rate: 12 }, "Cup": { unit: "pc", rate: 1.6 }, "Poly Film": { unit: "kg", rate: 210 },
  "Pouch": { unit: "pc", rate: 0.6 }, "Small Cup 80-90 g": { unit: "pc", rate: 1.2 },
  "Glass Cup 180 ml": { unit: "pc", rate: 2.2 }, "Bucket 1.5 kg": { unit: "pc", rate: 18 },
  "Bucket 5 kg": { unit: "pc", rate: 38 }, "Bucket 15 kg": { unit: "pc", rate: 85 },
  "Tetra Pack 110 ml": { unit: "pc", rate: 2.5 }, "Tetra Pack 400 ml": { unit: "pc", rate: 4.5 },
  "Vacuum Pouch Paneer": { unit: "pc", rate: 3 }, "Sachet 20 ml": { unit: "pc", rate: 0.9 },
  "Jar 200 ml": { unit: "pc", rate: 9 }, "Jar 500 ml": { unit: "pc", rate: 15 }, "Jar 1 L": { unit: "pc", rate: 22 },
  "Jar 5 L": { unit: "pc", rate: 85 }, "Ceka Pack 1 L": { unit: "pc", rate: 6.5 },
  "Ceka Pack 900 ml": { unit: "pc", rate: 6 }, "Tin 15 kg": { unit: "pc", rate: 165 },
  "Peda Box 200 g": { unit: "pc", rate: 7 },
};

/** Packing material for a SKU: [item, qty] given the pieces and full cases packed. */
function materialFor(code: string, pcs: number, cases: number, caseUnit: string): [string, number][] {
  const film = (g: number): [string, number] => ["Poly Film", Math.round(pcs * g) / 1000];
  const box: [string, number][] = caseUnit === "CBX" && cases > 0 ? [["Box", cases]] : [];
  const p = (item: string): [string, number] => [item, pcs];
  const map: Record<string, [string, number][]> = {
    "1003": [film(3.5)], "999": [film(3.5)], "1012": [film(2.5)], "1020": [film(2.5)], "1013": [film(3.5)],
    "1014": [film(6)], "1019": [film(6)], "1015": [film(22)], "1021": [film(22)], "1028": [film(2.2)],
    "1011": [p("Cup"), ...box], "1056": [p("Cup"), ...box],
    "1010": [p("Small Cup 80-90 g"), ...box], "1026": [p("Small Cup 80-90 g"), ...box], "1027": [p("Small Cup 80-90 g")],
    "1048": [p("Small Cup 80-90 g"), ...box], "1043": [p("Small Cup 80-90 g"), ...box], "1044": [p("Small Cup 80-90 g"), ...box],
    "1023": [p("Glass Cup 180 ml"), ...box], "1024": [p("Glass Cup 180 ml"), ...box],
    "1046": [p("Glass Cup 180 ml"), ...box], "1049": [p("Glass Cup 180 ml"), ...box],
    "1047": [p("Bucket 5 kg")], "1016": [p("Bucket 15 kg")], "1022": [p("Bucket 15 kg")], "1018": [p("Bucket 1.5 kg")],
    "1042": [p("Tetra Pack 110 ml"), ...box], "1045": [p("Tetra Pack 400 ml"), ...box],
    "1005": [p("Vacuum Pouch Paneer")], "1006": [p("Vacuum Pouch Paneer")], "1007": [p("Vacuum Pouch Paneer")],
    "1008": [film(8)], "1009": [film(25)],
    "1055": [p("Sachet 20 ml"), ...box], "1029": [p("Jar 200 ml"), ...box], "1039": [p("Jar 200 ml"), ...box],
    "1030": [p("Jar 500 ml"), ...box], "1040": [p("Jar 500 ml"), ...box], "1031": [p("Jar 1 L"), ...box],
    "1041": [p("Jar 1 L"), ...box], "1032": [p("Jar 5 L"), ...box], "1038": [p("Ceka Pack 1 L"), ...box],
    "1037": [p("Ceka Pack 1 L"), ...box], "1053": [p("Ceka Pack 900 ml"), ...box], "1054": [p("Ceka Pack 900 ml"), ...box],
    "1033": [p("Tin 15 kg")], "1034": [p("Peda Box 200 g"), ...box], "1035": [p("Peda Box 200 g"), ...box],
    "1058": [film(5)], "1059": [film(5)],
  };
  return (map[code] ?? []).filter(([, q]) => q > 0);
}

const TANKER_SUPPLIERS = ["Sai Dairy", "AB Dairy", "Atul Dairy", "Devbhog"];

// ---------------------------------------------------------------- helpers
/** Deterministic random numbers per date, so a re-seed gives the same figures. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), h = (h << 13) | (h >>> 19);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

async function rec(tbl: string, id: string, old: Record<string, unknown> | null = null) {
  await query(`insert into demo_seed (tbl, row_id, old) values ($1, $2, $3)`, [tbl, id, old === null ? null : JSON.stringify(old)]);
}

/** Sets one of a master object's cells, recording what it replaced. */
async function setCell(objectId: string, classId: string, key: string, num: number | null, text: string | null) {
  const before = await one<{ id: string; formula: string | null; value_num: number | null; value_text: string | null }>(
    `select v.id, v.formula, v.value_num, v.value_text from field_value v join field_def f on f.id = v.field_def_id
      where v.object_id = $1 and f.class_id = $2 and f.key = $3`, [objectId, classId, key]);
  const row = await one<{ id: string }>(
    `insert into field_value (object_id, field_def_id, formula, value_num, value_text)
     select $1, f.id, null, $3, $4 from field_def f where f.class_id = $2 and f.key = $5
     on conflict (object_id, field_def_id) do update set formula = null, value_num = excluded.value_num, value_text = excluded.value_text
     returning id`, [objectId, classId, num, text, key]);
  if (!row) return;
  if (before) await rec("field_value", before.id, { formula: before.formula, value_num: before.value_num, value_text: before.value_text });
  else await rec("field_value", row.id);
}

async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

// ---------------------------------------------------------------- seed
async function seed() {
  const scenario = await activeScenarioId();
  const already = await one<{ n: number }>(`select count(*)::int as n from demo_seed`);
  if (already?.n) throw new Error("Demo data is already in - run `npm run db:seed:demo -- --undo` first");

  const preDays = new Set((await query<{ d: string }>(
    `select to_char(day, 'YYYY-MM-DD') as d from production_day where scenario_id = $1 and day = any($2)`, [scenario, DATES])).map((r) => r.d));

  console.log(`Fetching Vamaa collections for ${FIRST} to ${LAST}...`);
  await ensureDays(DATES[0], DATES[DATES.length - 1]).catch((e) => console.warn("  (fetch skipped:", e.message, ")"));

  // --- masters
  const cls = async (code: string) => (await one<{ id: string }>(`select id from object_class where scenario_id = $1 and code = $2`, [scenario, code]))!.id;
  const ingClass = await cls("ingredient");
  const packClass = await cls("packaging");

  const ingredients = await query<{ id: string; name: string }>(`select id, name from cost_object where class_id = $1`, [ingClass]);
  for (const i of ingredients) if (i.name in INGREDIENT_RATES) await setCell(i.id, ingClass, "rate", INGREDIENT_RATES[i.name], null);

  // citric acid curdles the paneer - added to the master and to paneer's list
  let citric = ingredients.find((i) => i.name === "Citric Acid");
  if (!citric) {
    citric = (await one<{ id: string; name: string }>(
      `insert into cost_object (scenario_id, class_id, code, name, sort_order)
       values ($1, $2, 'citric_acid', 'Citric Acid', (select coalesce(max(sort_order), 0) + 1 from cost_object where class_id = $2))
       returning id, name`, [scenario, ingClass]))!;
    await rec("cost_object", citric.id);
    await setCell(citric.id, ingClass, "unit", null, "kg");
  }
  await setCell(citric.id, ingClass, "rate", 150, null);
  const paneer = (await one<{ id: string }>(`select id from bulk_product where scenario_id = $1 and code = 'paneer'`, [scenario]))!;
  const onList = await one(`select 1 from bulk_product_ingredient where bulk_product_id = $1 and ingredient_id = $2`, [paneer.id, citric.id]);
  // (no record needed: taking out the seeded Citric Acid takes its list line with it)
  if (!onList) {
    await query(`insert into bulk_product_ingredient (bulk_product_id, ingredient_id, unit, sort_order) values ($1, $2, 'kg', 0)`,
      [paneer.id, citric.id]);
  }

  const packItems = new Map((await query<{ id: string; name: string }>(
    `select id, name from cost_object where class_id = $1`, [packClass])).map((p) => [p.name, p.id]));
  for (const [name, p] of Object.entries(PACKAGING)) {
    let id = packItems.get(name);
    if (!id) {
      const code = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      id = (await one<{ id: string }>(
        `insert into cost_object (scenario_id, class_id, code, name, sort_order)
         values ($1, $2, $3, $4, (select coalesce(max(sort_order), 0) + 1 from cost_object where class_id = $2)) returning id`,
        [scenario, packClass, code, name]))!.id;
      await rec("cost_object", id);
      await setCell(id, packClass, "unit", null, p.unit);
      packItems.set(name, id);
    }
    await setCell(id, packClass, "rate", p.rate, null);
  }

  const products = await query<{ id: string; code: string; name: string }>(`select id, code, name from bulk_product where scenario_id = $1`, [scenario]);
  const productByCode = new Map(products.map((p) => [p.code, p]));
  for (const [skuCode, productCode] of Object.entries(SKU_LINKS)) {
    const sku = await one<{ id: string; bulk_product_id: string | null }>(`select id, bulk_product_id from sku where scenario_id = $1 and code = $2`, [scenario, skuCode]);
    if (!sku || sku.bulk_product_id) continue;
    await query(`update sku set bulk_product_id = $2 where id = $1`, [sku.id, productByCode.get(productCode)!.id]);
    await rec("sku", sku.id, { bulk_product_id: null });
  }
  await recompute(scenario, "demo-seed");

  const standing = await query<{ bulk_product_id: string; ingredient_id: string; name: string; unit: string }>(
    `select bpi.bulk_product_id, bpi.ingredient_id, o.name, bpi.unit
       from bulk_product_ingredient bpi join cost_object o on o.id = bpi.ingredient_id order by bpi.sort_order`);
  const skus = await query<{ id: string; code: string; case_unit: string; pcs_per_case: number; bulk_qty_per_pc: number | null }>(
    `select id, code, case_unit, pcs_per_case, bulk_qty_per_pc from sku where scenario_id = $1`, [scenario]);
  const skuByCode = new Map(skus.map((s) => [s.code, s]));
  const tanks = new Map((await query<{ id: string; code: string }>(`select id, code from tank where scenario_id = $1`, [scenario])).map((t) => [t.code, t.id]));
  const rm1 = tanks.get("rmst1")!, rm2 = tanks.get("rmst2")!;
  const transporters = await query<{ id: string; name: string; section: string }>(
    `select id, name, section from transporter where scenario_id = $1 and is_active`, [scenario]);
  const coal = (await one<{ id: string }>(`select id from plant_fuel where scenario_id = $1 and code = 'coal'`, [scenario]))!;
  const centreList = await centers();

  for (const [di, date] of DATES.entries()) {
    const r = rng(`demo:${date}`);
    const wd = weekday(date);
    const factor = WEEKDAY_FACTOR[wd] * (1 + di * 0.003) * (0.96 + r() * 0.08);
    const plan = PLAN.filter((p) => !p.days || p.days.includes(wd))
      .map((p) => ({ ...p, litres: Math.round((p.milk * factor * (0.95 + r() * 0.1)) / 10) * 10 }));
    const needed = plan.reduce((t, p) => t + p.litres, 0);
    let minute = 0;
    const at = (h: number) => `${date} ${String(h).padStart(2, "0")}:00:00+05:30`;
    const stamp = (h: number) => `(timestamptz '${at(h)}' + interval '${minute++} minutes')`;

    // --- milk in: the day's real collections into RMST1
    const chart = await getChart({ date });
    let farmerLitres = 0;
    for (const row of await storedCollections(date)) {
      const centre = centreList.find((c) => c.center === row.center_code);
      if (centre?.kind === "tanker") continue;
      const ref = collectionRef(row, date);
      if (await one(`select 1 from tank_movement where scenario_id = $1 and source_ref = $2`, [scenario, ref])) continue;
      const milk = collectionMilk(row);
      if (milk.litres <= 0) continue;
      const price = collectionPrice(chart, row).rate ?? 0;
      const m = (await one<{ id: string }>(
        `insert into tank_movement (scenario_id, tank_id, movement_date, direction, qty_litre, fat_pct, snf_pct, cost_per_litre, notes, source, source_ref, created_at)
         values ($1, $2, $3, 'in', $4, $5, $6, $7, $8, 'vamaa', $9, ${stamp(6)}) returning id`,
        [scenario, rm1, date, milk.litres, milk.fat, milk.snf, price,
          `Milk in · ${centre?.name ?? row.center_code} · farmer ${row.farmer_code} · ${row.shift === "M" ? "morning" : "evening"} shift`, ref]))!;
      await rec("tank_movement", m.id);
      farmerLitres += milk.litres;
    }

    // --- tanker loads make up the rest (plus a little to carry over)
    const carry = Number((await one<{ q: number }>(`select coalesce(sum(qty_litre), 0) as q from tank where id = any($1)`, [[rm1, rm2]]))!.q);
    let tanker = Math.max(0, Math.round((needed - farmerLitres - carry + 250 + r() * 200) / 10) * 10);
    const loads: number[] = [];
    while (tanker > 0) { const l = Math.min(tanker, 9500); loads.push(l); tanker -= l; }
    for (const [li, litres] of loads.entries()) {
      const supplier = TANKER_SUPPLIERS[(di + li) % TANKER_SUPPLIERS.length];
      const m = (await one<{ id: string }>(
        `insert into tank_movement (scenario_id, tank_id, movement_date, direction, qty_litre, fat_pct, snf_pct, cost_per_litre, notes, created_at)
         values ($1, $2, $3, 'in', $4, $5, $6, $7, $8, ${stamp(8)}) returning id`,
        [scenario, li === 0 ? rm2 : rm1, date, litres, round(3.9 + r() * 0.5, 2), round(8.2 + r() * 0.3, 2), round(44 + r() * 3, 2),
          `Demo tanker · ${supplier}`]))!;
      await rec("tank_movement", m.id);
    }
    await withClient(async (c) => { await recomputeTank(c, rm1); await recomputeTank(c, rm2); });

    // --- bulk batches: milk drawn from RMST2 first, then RMST1
    const bal = new Map<string, number>((await query<{ id: string; q: number }>(
      `select id, qty_litre as q from tank where id = any($1)`, [[rm1, rm2]])).map((t) => [t.id, Number(t.q)]));
    const batchIds: string[] = [];
    const yields = new Map<string, number>();
    for (const p of plan) {
      const product = productByCode.get(p.code);
      if (!product) continue;
      const out = round(p.litres * p.yield * (0.98 + r() * 0.04), 1);
      yields.set(p.code, out);
      const b = (await one<{ id: string }>(
        `insert into bulk_batch (scenario_id, batch_date, bulk_product_id, output_qty) values ($1, $2, $3, $4) returning id`,
        [scenario, date, product.id, out]))!;
      await rec("bulk_batch", b.id);
      batchIds.push(b.id);

      for (const [i, s] of standing.filter((x) => x.bulk_product_id === product.id).entries()) {
        const qty = round((dose(p.code, s.name, s.unit) * p.litres) / 100 * (0.97 + r() * 0.06), 3);
        await query(
          `insert into bulk_batch_ingredient (batch_id, ingredient_id, name, qty, unit, sort_order) values ($1, $2, $3, $4, $5, $6)`,
          [b.id, s.ingredient_id, s.name, qty, s.unit, i]);
      }

      let left = p.litres;
      for (const tank of [rm2, rm1]) {
        const take = Math.min(left, Math.floor((bal.get(tank) ?? 0) * 10) / 10);
        if (take <= 0) continue;
        await query(
          `insert into tank_movement (scenario_id, tank_id, movement_date, direction, qty_litre, notes, source, bulk_batch_id, created_at)
           values ($1, $2, $3, 'out', $4, $5, 'production', $6, ${stamp(14)})`,
          [scenario, tank, date, take, `Production · ${product.name}`, b.id]);
        bal.set(tank, (bal.get(tank) ?? 0) - take);
        left -= take;
      }
      if (left > 0.05) throw new Error(`${date}: not enough milk in the tanks for ${product.name}`);
    }
    await withClient(async (c) => { await recomputeTank(c, rm1); await recomputeTank(c, rm2); await syncBatchMilk(c, batchIds); });
    await syncMilkProcessed(scenario, [date]);

    // --- SKU packing, with packing material
    let materialRows = 0;
    for (const [productCode, split] of Object.entries(SKU_SPLIT)) {
      const y = yields.get(productCode);
      if (!y) continue;
      for (const [skuCode, share] of Object.entries(split)) {
        const sku = skuByCode.get(skuCode);
        if (!sku?.bulk_qty_per_pc) continue;
        const pcs = Math.floor((y * 0.985 * share) / Number(sku.bulk_qty_per_pc));
        if (pcs <= 0) continue;
        const cases = Math.floor(pcs / sku.pcs_per_case);
        const loose = pcs - cases * sku.pcs_per_case;
        const d = (await one<{ id: string }>(
          `insert into sku_pack_day (scenario_id, sku_id, day, cases, loose_pcs) values ($1, $2, $3, $4, $5) returning id`,
          [scenario, sku.id, date, cases, loose]))!;
        await rec("sku_pack_day", d.id);
        for (const [i, [item, qty]] of materialFor(skuCode, pcs, cases, sku.case_unit).entries()) {
          const p = PACKAGING[item];
          const m = (await one<{ id: string }>(
            `insert into sku_pack_material (scenario_id, sku_id, day, packaging_id, name, qty, unit, price, sort_order)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
            [scenario, sku.id, date, packItems.get(item) ?? null, item, qty, p.unit === "kg" ? "kg" : "pcs", p.rate, i]))!;
          await rec("sku_pack_material", m.id);
          materialRows++;
        }
      }
    }

    // --- transport: every transporter, both sections
    for (const t of transporters) {
      let km: number | null = null, trips: number | null = null, diesel: number | null = null;
      if (t.section === "milk_to_plant") {
        if (t.name.startsWith("Roshni")) km = Math.round(112 + (r() - 0.5) * 8);
        else if (t.name.startsWith("Sahu")) km = Math.round(144 + (r() - 0.5) * 10);
        else if (t.name.startsWith("JangluRam")) km = Math.round(138 + (r() - 0.5) * 10);
        else diesel = loads.length ? round(115 + r() * 15, 1) : null;
      } else {
        if (t.name.startsWith("Balaji")) km = Math.round(160 + r() * 50);
        else if (t.name.startsWith("Roshni")) km = Math.round(140 + r() * 50);
        else if (t.name.startsWith("Mahadev") || t.name.startsWith("Khollari")) trips = 1;
        else diesel = round(35 + r() * 20, 1);
      }
      if (km === null && trips === null && diesel === null) continue;
      const run = (await one<{ id: string }>(
        `insert into transport_run (scenario_id, transporter_id, run_date, distance_km, trips, diesel_litre)
         values ($1, $2, $3, $4, $5, $6) on conflict (transporter_id, run_date) do nothing returning id`,
        [scenario, t.id, date, km, trips, diesel]));
      if (run) await rec("transport_run", run.id);
    }
    await syncFuelDays(scenario, "milk_to_plant", [date]);
    await syncFuelDays(scenario, "delivery", [date]);

    // --- coal for the boiler
    const fuel = (await one<{ id: string }>(
      `insert into plant_fuel_day (scenario_id, fuel_id, day, qty) values ($1, $2, $3, $4)
       on conflict (fuel_id, day) do nothing returning id`,
      [scenario, coal.id, date, Math.round(needed * (0.05 + r() * 0.01))]));
    if (fuel) await rec("plant_fuel_day", fuel.id);
    await syncPlantFuelDays(scenario, [date]);

    // --- electricity (₹ per unit in force) and labour
    const day = (await one<{ id: string }>(`select id from production_day where scenario_id = $1 and day = $2`, [scenario, date]))!;
    const rate = Number((await one<{ rate: number }>(
      `select rate from electricity_rate where scenario_id = $1 and effective_from <= $2 order by effective_from desc limit 1`, [scenario, date]))!.rate);
    // ~0.07-0.085 kWh per litre for a mixed plant (chilling, pasteurising, CIP, cold room)
    const units = Math.round(needed * (0.07 + r() * 0.015) + 120);
    // 28-34 labourers on ₹420-460 a day; Sunday runs a lighter shift
    const workers = (wd === 0 ? 24 : 28) + Math.floor(r() * 7);
    const wage = 420 + Math.floor(r() * 5) * 10;
    for (const [code, qty, perUnit, amount] of [
      ["electricity", units, rate, round(units * rate, 2)],
      ["labour", workers, wage, workers * wage],
    ] as const) {
      const head = (await one<{ id: string }>(`select id from overhead_head where scenario_id = $1 and code = $2`, [scenario, code]))!;
      const before = await one<{ id: string; qty: number | null; rate: number | null; amount: number | null }>(
        `select id, qty, rate, amount from daily_overhead where day_id = $1 and head_id = $2`, [day.id, head.id]);
      const row = (await one<{ id: string }>(
        `insert into daily_overhead (day_id, head_id, qty, rate, amount) values ($1, $2, $3, $4, $5)
         on conflict (day_id, head_id) do update set qty = excluded.qty, rate = excluded.rate, amount = excluded.amount returning id`,
        [day.id, head.id, qty, perUnit, amount]))!;
      if (before) await rec("daily_overhead", before.id, { qty: before.qty, rate: before.rate, amount: before.amount });
      else await rec("daily_overhead", row.id);
    }
    await freezeDay(day.id);

    console.log(`${date}: ${plan.length} batches, ${needed} L milk (farmers ${round(farmerLitres, 0)} L + tankers ${loads.join(" + ") || 0} L), ${materialRows} packing lines`);
  }

  // production days this script brought into being go when it is undone
  for (const d of await query<{ id: string; d: string }>(
    `select id, to_char(day, 'YYYY-MM-DD') as d from production_day where scenario_id = $1 and day = any($2)`, [scenario, DATES])) {
    if (!preDays.has(d.d)) await rec("production_day", d.id);
  }
  console.log("Done. Undo with: npm run db:seed:demo -- --undo");
}

// ---------------------------------------------------------------- undo
const ALLOWED = new Set(["tank_movement", "bulk_batch", "sku_pack_day", "sku_pack_material", "transport_run",
  "plant_fuel_day", "daily_overhead", "production_day", "field_value", "cost_object", "sku"]);

async function undo() {
  const scenario = await activeScenarioId();
  const rows = await query<{ id: number; tbl: string; row_id: string; old: Record<string, unknown> | null }>(
    `select id, tbl, row_id, old from demo_seed order by id desc`);
  if (!rows.length) { console.log("No demo data to take out."); return; }
  for (const r of rows) {
    if (!ALLOWED.has(r.tbl)) throw new Error(`Unexpected table ${r.tbl} in demo_seed`);
    if (r.old === null) {
      await query(`delete from ${r.tbl} where id = $1`, [r.row_id]);
    } else {
      const keys = Object.keys(r.old);
      await query(`update ${r.tbl} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} where id = $1`,
        [r.row_id, ...keys.map((k) => r.old![k])]);
    }
  }
  await query(`delete from demo_seed`);

  for (const t of await query<{ id: string }>(`select id from tank where scenario_id = $1`, [scenario])) {
    await withClient((c) => recomputeTank(c, t.id));
  }
  await syncMilkProcessed(scenario, DATES);
  await syncFuelDays(scenario, "milk_to_plant", DATES);
  await syncFuelDays(scenario, "delivery", DATES);
  await syncPlantFuelDays(scenario, DATES);
  await recompute(scenario, "demo-undo");
  console.log(`Took out ${rows.length} demo rows and restored the old values.`);
}

(process.argv.includes("--undo") ? undo() : seed())
  .then(() => pool.end())
  .catch(async (e) => { console.error(e instanceof Error ? e.message : e); await pool.end(); process.exit(1); });
