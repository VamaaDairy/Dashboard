/**
 * Gives every SKU its standing packing list - which packaging items go into
 * it and how much per piece or per case - and makes sure each item is in the
 * Packaging master with a rate (incl. GST). Items and rates set here are
 * permanent master data: if the demo seed created them first, they are taken
 * out of its undo list so `db:seed:demo -- --undo` leaves them alone.
 *
 *   npm run db:seed:sku-packing
 *
 * Safe to re-run: a SKU's list is replaced; rates already set aren't touched.
 */
import "dotenv/config";
import { one, pool, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { recompute } from "@/lib/model/recompute";

// item -> unit and rate incl. GST (used only where the master has no rate yet)
const ITEMS: Record<string, { unit: "pc" | "kg"; rate: number }> = {
  "Poly Film": { unit: "kg", rate: 210 }, "Box": { unit: "pc", rate: 12 }, "Cup": { unit: "pc", rate: 1.6 },
  "Pouch": { unit: "pc", rate: 0.6 }, "Small Cup 80-90 g": { unit: "pc", rate: 1.2 }, "Glass Cup 180 ml": { unit: "pc", rate: 2.2 },
  "Bucket 1.5 kg": { unit: "pc", rate: 18 }, "Bucket 5 kg": { unit: "pc", rate: 38 }, "Bucket 15 kg": { unit: "pc", rate: 85 },
  "Tetra Pack 110 ml": { unit: "pc", rate: 2.5 }, "Tetra Pack 400 ml": { unit: "pc", rate: 4.5 }, "Tetra Pack 1 L": { unit: "pc", rate: 9 },
  "Vacuum Pouch Paneer": { unit: "pc", rate: 3 }, "Sachet 20 ml": { unit: "pc", rate: 0.9 }, "Jar 200 ml": { unit: "pc", rate: 9 },
  "Jar 500 ml": { unit: "pc", rate: 15 }, "Jar 1 L": { unit: "pc", rate: 22 }, "Jar 5 L": { unit: "pc", rate: 85 },
  "Ceka Pack 1 L": { unit: "pc", rate: 6.5 }, "Ceka Pack 900 ml": { unit: "pc", rate: 6 }, "Tin 15 kg": { unit: "pc", rate: 165 },
  "Peda Box 200 g": { unit: "pc", rate: 7 }, "Label": { unit: "pc", rate: 0.35 },
};

type Line = [item: string, qty: number, per: "pc" | "case"];
const film = (g: number): Line => ["Poly Film", g / 1000, "pc"];
const pc = (item: string, qty = 1): Line => [item, qty, "pc"];
const box: Line = ["Box", 1, "case"];

// SKU code -> its packing list
const LISTS: Record<string, Line[]> = {
  "1003": [film(3.5)], "999": [film(3.5)],
  "1042": [pc("Tetra Pack 110 ml"), box], "1045": [pc("Tetra Pack 400 ml"), box],
  "1050": [pc("Tetra Pack 1 L"), box], "1051": [pc("Tetra Pack 1 L"), box], "1052": [pc("Tetra Pack 1 L"), box],
  "1012": [film(2.5)], "1013": [film(3.5)], "1014": [film(6)], "1015": [film(22)],
  "1047": [pc("Bucket 5 kg"), pc("Label")], "1016": [pc("Bucket 15 kg"), pc("Label")],
  "1056": [pc("Cup"), box], "1011": [pc("Cup"), box],
  "1010": [pc("Small Cup 80-90 g"), box], "1026": [pc("Small Cup 80-90 g"), box], "1027": [pc("Small Cup 80-90 g")],
  "1020": [film(2.5)], "1019": [film(6)], "1021": [film(22)],
  "1018": [pc("Bucket 1.5 kg"), pc("Label")], "1022": [pc("Bucket 15 kg"), pc("Label")],
  "1023": [pc("Glass Cup 180 ml"), box], "1024": [pc("Glass Cup 180 ml"), box], "1046": [pc("Glass Cup 180 ml"), box],
  "1028": [film(2.2)], "1049": [pc("Glass Cup 180 ml"), box],
  "1005": [pc("Vacuum Pouch Paneer"), pc("Label")], "1006": [pc("Vacuum Pouch Paneer"), pc("Label")],
  "1007": [pc("Vacuum Pouch Paneer"), pc("Label")], "1008": [film(8)], "1009": [film(25)],
  "1055": [pc("Sachet 20 ml"), box], "1029": [pc("Jar 200 ml"), pc("Label"), box], "1030": [pc("Jar 500 ml"), pc("Label"), box],
  "1031": [pc("Jar 1 L"), pc("Label"), box], "1038": [pc("Ceka Pack 1 L"), box], "1053": [pc("Ceka Pack 900 ml"), box],
  "1032": [pc("Jar 5 L"), pc("Label"), box], "1039": [pc("Jar 200 ml"), pc("Label"), box], "1040": [pc("Jar 500 ml"), pc("Label"), box],
  "1041": [pc("Jar 1 L"), pc("Label"), box], "1054": [pc("Ceka Pack 900 ml"), box], "1037": [pc("Ceka Pack 1 L"), box],
  "1033": [pc("Tin 15 kg"), pc("Label")],
  "1048": [pc("Small Cup 80-90 g"), box], "1043": [pc("Small Cup 80-90 g"), box], "1044": [pc("Small Cup 80-90 g"), box],
  "1034": [pc("Peda Box 200 g"), box], "1035": [pc("Peda Box 200 g"), box],
  "1058": [film(5)], "1059": [film(5)],
};

async function main() {
  const scenario = await activeScenarioId();
  const cls = (await one<{ id: string }>(`select id from object_class where scenario_id = $1 and code = 'packaging'`, [scenario]))!.id;

  // --- packaging items: present, with a unit and (if missing) a rate; permanent
  const ids = new Map<string, string>();
  for (const r of await query<{ id: string; name: string }>(`select id, name from cost_object where class_id = $1`, [cls])) ids.set(r.name, r.id);
  for (const [name, item] of Object.entries(ITEMS)) {
    let id = ids.get(name);
    if (!id) {
      const code = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      id = (await one<{ id: string }>(
        `insert into cost_object (scenario_id, class_id, code, name, sort_order)
         values ($1, $2, $3, $4, (select coalesce(max(sort_order), 0) + 1 from cost_object where class_id = $2)) returning id`,
        [scenario, cls, code, name]))!.id;
      ids.set(name, id);
    }
    await query(
      `insert into field_value (object_id, field_def_id, value_text)
       select $1, f.id, $3 from field_def f where f.class_id = $2 and f.key = 'unit'
       on conflict (object_id, field_def_id) do nothing`, [id, cls, item.unit]);
    await query(
      `insert into field_value (object_id, field_def_id, value_num)
       select $1, f.id, $3 from field_def f where f.class_id = $2 and f.key = 'rate'
       on conflict (object_id, field_def_id) do update set value_num = coalesce(field_value.value_num, excluded.value_num)`,
      [id, cls, item.rate]);
  }
  // keep them (and their rates) out of the demo seed's undo
  const all = [...ids.values()];
  await query(`delete from demo_seed where tbl = 'cost_object' and row_id = any($1)`, [all]);
  await query(`delete from demo_seed where tbl = 'field_value' and row_id in (select id from field_value where object_id = any($1))`, [all]);

  // --- each SKU's list
  let n = 0;
  for (const [code, lines] of Object.entries(LISTS)) {
    const sku = await one<{ id: string }>(`select id from sku where scenario_id = $1 and code = $2`, [scenario, code]);
    if (!sku) continue;
    await query(`delete from sku_packing_item where sku_id = $1`, [sku.id]);
    for (const [i, [item, qty, per]] of lines.entries()) {
      await query(`insert into sku_packing_item (sku_id, packaging_id, qty, per, sort_order) values ($1, $2, $3, $4, $5)`,
        [sku.id, ids.get(item), qty, per, i]);
    }
    n++;
  }
  await recompute(scenario, "sku-packing-seed");
  console.log(`Packing lists set for ${n} SKUs; ${Object.keys(ITEMS).length} packaging items in the master.`);
}

main().then(() => pool.end()).catch(async (e) => { console.error(e instanceof Error ? e.message : e); await pool.end(); process.exit(1); });
