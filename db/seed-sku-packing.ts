/**
 * Gives every SKU its standing packing list - which packaging items go into
 * it and how much per piece or per case - and makes sure each item is in the
 * Packaging master with a rate (incl. GST). Items and rates set here are
 * permanent master data: if the demo seed created them first, they are taken
 * out of its undo list so `db:seed:demo -- --undo` leaves them alone.
 *
 *   npm run db:seed:sku-packing
 *
 * Rates come from COST SHEET..xlsx (landed: rate + GST + freight) and are reset
 * on every run; the few items the sheet doesn't cover keep whatever rate is
 * already set. Safe to re-run: a SKU's list is replaced.
 */
import "dotenv/config";
import { one, pool, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { recompute } from "@/lib/model/recompute";

type Item = { unit: "pc" | "kg"; rate: number };

// item -> unit and landed rate (incl. GST and freight), from COST SHEET..xlsx.
// Film bought by weight is per kg; everything else per piece.
const SHEET: Record<string, Item> = {
  // film by weight (₹/kg)
  "Milk Film 500ml": { unit: "kg", rate: 308.9333 }, "Dahi Film": { unit: "kg", rate: 308.1333 }, "Lassi Film": { unit: "kg", rate: 167.56 },
  "Paneer Top Film 80 mic": { unit: "kg", rate: 536.9 }, "Paneer Bottom Film 200 mic": { unit: "kg", rate: 513.3 },
  "Peda Top Film 80 mic": { unit: "kg", rate: 495.6 }, "Peda Bottom Film 450 mic": { unit: "kg", rate: 525.1 },
  "Paneer Horeca Pouch 1 kg": { unit: "pc", rate: 2.4067 }, "Paneer Horeca Pouch 5 kg": { unit: "pc", rate: 6.4515 },
  // dahi / sweet dahi / shrikhand / rabdi cups
  "Dahi Cup 200 g": { unit: "pc", rate: 4.585 }, "Foil 200 g Cup": { unit: "pc", rate: 0.9776 }, "Carton Dahi Cup 200 g": { unit: "pc", rate: 8.0925 },
  "Sweet Dahi Cup 90 g": { unit: "pc", rate: 1.7084 }, "Foil 90 g Cup": { unit: "pc", rate: 0.5882 }, "Carton Sweet Dahi 90 g": { unit: "pc", rate: 7.305 },
  "Cup 80 g (Shrikhand / Mishti Doi)": { unit: "pc", rate: 3.4151 }, "Foil 80 g Cup": { unit: "pc", rate: 0.5056 },
  "Carton Shrikhand / Mishti Doi 80 g": { unit: "pc", rate: 7.0425 },
  "Rabdi Cup 80 g": { unit: "pc", rate: 4.1821 }, "Carton Rabdi 80 g": { unit: "pc", rate: 6.675 },
  // lassi / chaas glass
  "Lassi Glass 180 ml": { unit: "pc", rate: 3.7058 }, "Lassi Glass 180 ml (Strawberry)": { unit: "pc", rate: 2.3402 },
  "Foil 180 ml Glass": { unit: "pc", rate: 0.7298 }, "Foil 180 ml Glass (Strawberry)": { unit: "pc", rate: 0.7062 },
  "Carton Lassi 180 ml": { unit: "pc", rate: 7.41 }, "Carton Masala Chaas 180 ml": { unit: "pc", rate: 7.83 }, "Partition 180 ml": { unit: "pc", rate: 2.865 },
  // buckets
  "Bucket 5 kg": { unit: "pc", rate: 57.39 }, "Bucket 15 kg": { unit: "pc", rate: 132.8 }, "Bucket 15 kg (Kadhi)": { unit: "pc", rate: 96.22 },
  "Sticker 5 kg Bucket": { unit: "pc", rate: 2.124 }, "Sticker 15 kg Bucket": { unit: "pc", rate: 2.891 },
  // ghee jars and cartons
  "Desi Ghee Jar 200 ml": { unit: "pc", rate: 10.9672 }, "Desi Ghee Jar 500 ml": { unit: "pc", rate: 18.568 },
  "Desi Ghee Jar 1 L": { unit: "pc", rate: 29.2486 }, "Desi Ghee Jar 5 L": { unit: "pc", rate: 66.714 },
  "Cow Ghee Jar 200 ml": { unit: "pc", rate: 10.7986 }, "Cow Ghee Jar 500 ml": { unit: "pc", rate: 16.7724 }, "Cow Ghee Jar 1 L": { unit: "pc", rate: 24.402 },
  "Carton Desi Ghee 200 ml": { unit: "pc", rate: 83.25 }, "Carton Desi Ghee 500 ml": { unit: "pc", rate: 66.45 },
  "Carton Desi Ghee 1 L": { unit: "pc", rate: 74.85 }, "Carton Desi Ghee 5 L": { unit: "pc", rate: 52.8 },
  "Carton Cow Ghee 200 ml": { unit: "pc", rate: 69.6 }, "Carton Cow Ghee 500 ml": { unit: "pc", rate: 52.8 }, "Carton Cow Ghee 1 L": { unit: "pc", rate: 54.9 },
  "Ceka Inner Carton (Desi)": { unit: "pc", rate: 8.81 }, "Ceka Inner Carton (Cow)": { unit: "pc", rate: 8.0033 }, "Ceka Outer Carton": { unit: "pc", rate: 54.375 },
  "Tin 15 kg": { unit: "pc", rate: 185.76 }, "Tin Cap": { unit: "pc", rate: 3.422 }, "Sticker Set 15 kg Tin": { unit: "pc", rate: 14.16 },
  "Carton Ghee 15 kg": { unit: "pc", rate: 27.6 },
  // ghee 30 ml pouch (a carton holds 6 jars of 50 pouches)
  "Ghee Pouch 30 ml": { unit: "pc", rate: 0.8427 }, "Ghee Jar (pouch pack)": { unit: "pc", rate: 22.42 },
  "Ghee Jar Sticker (pouch pack)": { unit: "pc", rate: 4.13 }, "Carton Ghee Pouch Pack": { unit: "pc", rate: 60.25 },
  // packs in the sheet that no SKU uses yet (see TEMPLATES)
  "Milk Film": { unit: "kg", rate: 306.8 },
  "Paneer Bottom Film 200 mic (Horeca)": { unit: "kg", rate: 430.7 },
  "Paneer Polythene 200 g": { unit: "pc", rate: 0.7527 }, "Paneer Polythene 1 kg": { unit: "pc", rate: 2.6465 },
  "Tray Rabdi 80 g": { unit: "pc", rate: 6.78 },
  // peda
  "Carton Milk Peda": { unit: "pc", rate: 6.3251 }, "Carton Kesar Peda": { unit: "pc", rate: 5.9019 },
};

// SKUs the sheet doesn't cost yet (UHT, khowa, 1.5 kg bucket) keep these estimates
const PLACEHOLDER: Record<string, Item> = {
  "Poly Film": { unit: "kg", rate: 210 }, "Box": { unit: "pc", rate: 12 }, "Label": { unit: "pc", rate: 0.35 },
  "Bucket 1.5 kg": { unit: "pc", rate: 18 },
  "Tetra Pack 110 ml": { unit: "pc", rate: 2.5 }, "Tetra Pack 400 ml": { unit: "pc", rate: 4.5 }, "Tetra Pack 1 L": { unit: "pc", rate: 9 },
};
const ITEMS: Record<string, Item> = { ...PLACEHOLDER, ...SHEET };

// item -> [category, base rate, GST %, freight]: what the sheet's landed rate is built from.
// A null base means the rate is entered as it stands (a per-pouch figure worked out in the sheet).
const DETAILS: Record<string, [category: string, base: number | null, gst: number, freight: number]> = {
  "Milk Film 500ml": ["Film", 260, 18.0, 2.1333],
  "Dahi Film": ["Film", 260, 18.0, 1.3333],
  "Lassi Film": ["Film", 142, 18.0, 0],
  "Paneer Top Film 80 mic": ["Film", 455, 18.0, 0],
  "Paneer Bottom Film 200 mic": ["Film", 435, 18.0, 0],
  "Peda Top Film 80 mic": ["Film", 420, 18.0, 0],
  "Peda Bottom Film 450 mic": ["Film", 445, 18.0, 0],
  "Paneer Horeca Pouch 1 kg": ["Pouch", null, 0, 0],
  "Paneer Horeca Pouch 5 kg": ["Pouch", null, 0, 0],
  "Dahi Cup 200 g": ["Cup / glass", 3.75, 18.0, 0.16],
  "Foil 200 g Cup": ["Foil", 0.82, 18.0, 0.01],
  "Carton Dahi Cup 200 g": ["Cup / glass", 7.25, 5.0, 0.48],
  "Sweet Dahi Cup 90 g": ["Cup / glass", 1.38, 18.0, 0.08],
  "Foil 90 g Cup": ["Foil", 0.49, 18.0, 0.01],
  "Carton Sweet Dahi 90 g": ["Carton", 6.5, 5.0, 0.48],
  "Cup 80 g (Shrikhand / Mishti Doi)": ["Cup / glass", 2.8, 18.0, 0.1111],
  "Foil 80 g Cup": ["Foil", 0.42, 18.0, 0.01],
  "Carton Shrikhand / Mishti Doi 80 g": ["Carton", 6.25, 5.0, 0.48],
  "Rabdi Cup 80 g": ["Cup / glass", 3.45, 18.0, 0.1111],
  "Carton Rabdi 80 g": ["Carton", 5.9, 5.0, 0.48],
  "Lassi Glass 180 ml": ["Cup / glass", 3.05, 18.0, 0.1068],
  "Lassi Glass 180 ml (Strawberry)": ["Cup / glass", 1.89, 18.0, 0.11],
  "Foil 180 ml Glass": ["Foil", 0.61, 18.0, 0.01],
  "Foil 180 ml Glass (Strawberry)": ["Foil", 0.59, 18.0, 0.01],
  "Carton Lassi 180 ml": ["Carton", 6.6, 5.0, 0.48],
  "Carton Masala Chaas 180 ml": ["Carton", 7, 5.0, 0.48],
  "Partition 180 ml": ["Partition", 2.5, 5.0, 0.24],
  "Bucket 5 kg": ["Bucket", 48, 18.0, 0.75],
  "Bucket 15 kg": ["Bucket", 110, 18.0, 3],
  "Bucket 15 kg (Kadhi)": ["Bucket", 79, 18.0, 3],
  "Sticker 5 kg Bucket": ["Sticker / label", 1.8, 18.0, 0],
  "Sticker 15 kg Bucket": ["Sticker / label", 2.45, 18.0, 0],
  "Desi Ghee Jar 200 ml": ["Jar", 9, 18.0, 0.3472],
  "Desi Ghee Jar 500 ml": ["Jar", 15.1, 18.0, 0.75],
  "Desi Ghee Jar 1 L": ["Jar", 23.77, 18.0, 1.2],
  "Desi Ghee Jar 5 L": ["Jar", 52.3, 18.0, 5],
  "Cow Ghee Jar 200 ml": ["Jar", 9, 18.0, 0.1786],
  "Cow Ghee Jar 500 ml": ["Jar", 13.9, 18.0, 0.3704],
  "Cow Ghee Jar 1 L": ["Jar", 20.15, 18.0, 0.625],
  "Carton Desi Ghee 200 ml": ["Carton", 77, 5.0, 2.4],
  "Carton Desi Ghee 500 ml": ["Carton", 61, 5.0, 2.4],
  "Carton Desi Ghee 1 L": ["Carton", 69, 5.0, 2.4],
  "Carton Desi Ghee 5 L": ["Carton", 48, 5.0, 2.4],
  "Carton Cow Ghee 200 ml": ["Carton", 64, 5.0, 2.4],
  "Carton Cow Ghee 500 ml": ["Carton", 48, 5.0, 2.4],
  "Carton Cow Ghee 1 L": ["Carton", 50, 5.0, 2.4],
  "Ceka Inner Carton (Desi)": ["Carton", 7.2, 5.0, 1.25],
  "Ceka Inner Carton (Cow)": ["Carton", 7.4, 5.0, 0.2333],
  "Ceka Outer Carton": ["Carton", 49.5, 5.0, 2.4],
  "Tin 15 kg": ["Tin", 132, 18.0, 30],
  "Tin Cap": ["Cap", 2.9, 18.0, 0],
  "Sticker Set 15 kg Tin": ["Sticker / label", 12, 18.0, 0],
  "Carton Ghee 15 kg": ["Carton", 24, 5.0, 2.4],
  "Ghee Pouch 30 ml": ["Pouch", null, 0, 0],
  "Ghee Jar (pouch pack)": ["Jar", null, 0, 0],
  "Ghee Jar Sticker (pouch pack)": ["Sticker / label", null, 0, 0],
  "Carton Ghee Pouch Pack": ["Carton", 57, 5.0, 0.4],
  "Milk Film": ["Film", 260, 18.0, 0],
  "Paneer Bottom Film 200 mic (Horeca)": ["Film", 365, 18.0, 0],
  "Paneer Polythene 200 g": ["Pouch", null, 0, 0],
  "Paneer Polythene 1 kg": ["Pouch", null, 0, 0],
  "Tray Rabdi 80 g": ["Tray", 6, 5.0, 0.48],
  "Carton Milk Peda": ["Carton", 5.5, 5.0, 0.5501],
  "Carton Kesar Peda": ["Carton", 5.5, 5.0, 0.1269],
  "Poly Film": ["Film", null, 0, 0], "Box": ["Carton", null, 0, 0], "Label": ["Sticker / label", null, 0, 0],
  "Bucket 1.5 kg": ["Bucket", null, 0, 0], "Tetra Pack 110 ml": ["Tetra Pack", null, 0, 0],
  "Tetra Pack 400 ml": ["Tetra Pack", null, 0, 0], "Tetra Pack 1 L": ["Tetra Pack", null, 0, 0],
};

// qty is what the costing uses; basis + factor keep how it was worked out (see 035_packing_factors.sql)
type Basis = "qty" | "grams" | "per_kg" | "share";
type Line = [item: string, qty: number, per: "pc" | "case", basis?: Basis, factor?: number];
const pc = (item: string, qty = 1): Line => [item, qty, "pc"];
const cs = (item: string, qty = 1): Line => [item, qty, "case"];
const film = (item: string, g: number): Line => [item, g / 1000, "pc", "grams", g];                          // grams of film per piece
const yieldFilm = (item: string, perKg: number): Line => [item, Math.round(1e6 / perKg) / 1e6, "pc", "per_kg", perKg];   // pieces per kg of film
const share = (item: string, pieces: number): Line => [item, Math.round(1e6 / pieces) / 1e6, "pc", "share", pieces];     // one item covers this many pieces
const box: Line = ["Box", 1, "case"];

// SKU code -> its packing list
const LISTS: Record<string, Line[]> = {
  // milk: film weight per packet
  "1003": [film("Milk Film 500ml", 2.94)], "999": [film("Milk Film 500ml", 2.94)],
  // UHT: not in the sheet yet
  "1042": [pc("Tetra Pack 110 ml"), box], "1045": [pc("Tetra Pack 400 ml"), box],
  "1050": [pc("Tetra Pack 1 L"), box], "1051": [pc("Tetra Pack 1 L"), box], "1052": [pc("Tetra Pack 1 L"), box],
  // dahi / kadhi dahi
  "1012": [film("Dahi Film", 1.75)], "1013": [film("Dahi Film", 2.85)], "1014": [film("Dahi Film", 4.38)], "1015": [film("Dahi Film", 24.6)],
  "1020": [film("Dahi Film", 1.75)], "1019": [film("Dahi Film", 4.38)], "1021": [film("Dahi Film", 24.65)],
  "1047": [pc("Bucket 5 kg"), pc("Sticker 5 kg Bucket")], "1016": [pc("Bucket 15 kg"), pc("Sticker 15 kg Bucket")],
  "1022": [pc("Bucket 15 kg (Kadhi)"), pc("Sticker 15 kg Bucket")],
  "1018": [pc("Bucket 1.5 kg"), pc("Label")],   // not in the sheet yet
  "1056": [pc("Dahi Cup 200 g"), pc("Foil 200 g Cup"), cs("Carton Dahi Cup 200 g")],
  "1011": [pc("Dahi Cup 200 g"), pc("Foil 200 g Cup"), cs("Carton Dahi Cup 200 g")],
  "1026": [pc("Sweet Dahi Cup 90 g"), pc("Foil 90 g Cup"), cs("Carton Sweet Dahi 90 g")],
  "1027": [pc("Sweet Dahi Cup 90 g"), pc("Foil 90 g Cup")],
  "1010": [pc("Cup 80 g (Shrikhand / Mishti Doi)"), pc("Foil 80 g Cup"), cs("Carton Shrikhand / Mishti Doi 80 g")],
  // lassi / chaas
  "1023": [pc("Lassi Glass 180 ml"), pc("Foil 180 ml Glass"), cs("Carton Lassi 180 ml"), cs("Partition 180 ml")],
  "1024": [pc("Lassi Glass 180 ml"), pc("Foil 180 ml Glass"), cs("Carton Lassi 180 ml"), cs("Partition 180 ml")],
  "1049": [pc("Lassi Glass 180 ml (Strawberry)"), pc("Foil 180 ml Glass (Strawberry)"), cs("Carton Lassi 180 ml"), cs("Partition 180 ml")],
  "1046": [pc("Lassi Glass 180 ml"), pc("Foil 180 ml Glass"), cs("Carton Masala Chaas 180 ml"), cs("Partition 180 ml")],
  "1028": [film("Lassi Film", 1.5)],
  // paneer: top / bottom film, pieces per kg of film as labelled in the sheet
  "1005": [yieldFilm("Paneer Top Film 80 mic", 710), yieldFilm("Paneer Bottom Film 200 mic", 350)],
  "1006": [yieldFilm("Paneer Top Film 80 mic", 350), yieldFilm("Paneer Bottom Film 200 mic", 165)],
  "1007": [yieldFilm("Paneer Top Film 80 mic", 350), yieldFilm("Paneer Bottom Film 200 mic", 165)],
  "1008": [pc("Paneer Horeca Pouch 1 kg")], "1009": [pc("Paneer Horeca Pouch 5 kg")],
  // ghee
  "1055": [pc("Ghee Pouch 30 ml"), share("Ghee Jar (pouch pack)", 50), share("Ghee Jar Sticker (pouch pack)", 50), share("Carton Ghee Pouch Pack", 300)],
  "1029": [pc("Desi Ghee Jar 200 ml"), cs("Carton Desi Ghee 200 ml")],
  "1030": [pc("Desi Ghee Jar 500 ml"), cs("Carton Desi Ghee 500 ml")],
  "1031": [pc("Desi Ghee Jar 1 L"), cs("Carton Desi Ghee 1 L")],
  "1032": [pc("Desi Ghee Jar 5 L"), cs("Carton Desi Ghee 5 L")],
  "1038": [pc("Ceka Inner Carton (Desi)"), cs("Ceka Outer Carton")], "1053": [pc("Ceka Inner Carton (Desi)"), cs("Ceka Outer Carton")],
  "1039": [pc("Cow Ghee Jar 200 ml"), cs("Carton Cow Ghee 200 ml")],
  "1040": [pc("Cow Ghee Jar 500 ml"), cs("Carton Cow Ghee 500 ml")],
  "1041": [pc("Cow Ghee Jar 1 L"), cs("Carton Cow Ghee 1 L")],
  "1054": [pc("Ceka Inner Carton (Cow)"), cs("Ceka Outer Carton")], "1037": [pc("Ceka Inner Carton (Cow)"), cs("Ceka Outer Carton")],
  "1033": [pc("Tin 15 kg"), pc("Tin Cap"), pc("Sticker Set 15 kg Tin"), pc("Carton Ghee 15 kg")],
  // rabdi / shrikhand
  "1048": [pc("Rabdi Cup 80 g"), pc("Foil 80 g Cup"), cs("Carton Rabdi 80 g")],
  "1043": [pc("Cup 80 g (Shrikhand / Mishti Doi)"), pc("Foil 80 g Cup"), cs("Carton Shrikhand / Mishti Doi 80 g")],
  "1044": [pc("Cup 80 g (Shrikhand / Mishti Doi)"), pc("Foil 80 g Cup"), cs("Carton Shrikhand / Mishti Doi 80 g")],
  // peda
  "1034": [yieldFilm("Peda Top Film 80 mic", 667), yieldFilm("Peda Bottom Film 450 mic", 111), pc("Carton Milk Peda")],
  "1035": [yieldFilm("Peda Top Film 80 mic", 667), yieldFilm("Peda Bottom Film 450 mic", 111), pc("Carton Kesar Peda")],
  // khowa: not in the sheet yet
  "1058": [film("Poly Film", 5)], "1059": [film("Poly Film", 5)],
};

// Packs from the sheet that have no SKU yet, saved against the bulk product they belong to (null = no
// matching product yet) so they can be loaded onto a SKU when one is added.
const TEMPLATES: { name: string; product: string | null; note: string; lines: Line[] }[] = [
  { name: "Toned Milk 200 ml - film", product: "Toned Milk", note: "Sheet: Tm 200ml", lines: [film("Milk Film", 1.29)] },
  { name: "Standard Milk 200 ml - film", product: null, note: "Sheet: Sm 200ml - no standard milk product yet", lines: [film("Milk Film", 1.29)] },
  { name: "Double Toned Milk 500 ml - film", product: null, note: "Sheet: DTM 500 - no double toned product yet", lines: [film("Milk Film", 2.7)] },
  { name: "Paneer 200 g - polythene", product: "Paneer", note: "Sheet: Gaia Paneer 200gm polythene", lines: [pc("Paneer Polythene 200 g")] },
  { name: "Paneer 1 kg - polythene", product: "Paneer", note: "Sheet: Gaia Paneer 1kg polythene", lines: [pc("Paneer Polythene 1 kg")] },
  { name: "Paneer 1 kg - Multivac (Horeca)", product: "Paneer", note: "Sheet: loose paneer Multivac Horeca 1 kg",
    lines: [yieldFilm("Paneer Top Film 80 mic", 350), yieldFilm("Paneer Bottom Film 200 mic (Horeca)", 165)] },
  { name: "Rabdi 80 g - tray", product: "Rabadi", note: "Sheet: Rabdi 80gm cup (tray of 6)", lines: [pc("Rabdi Cup 80 g"), pc("Foil 80 g Cup"), share("Tray Rabdi 80 g", 6)] },
];

async function main() {
  const scenario = await activeScenarioId();
  const cls = (await one<{ id: string }>(`select id from object_class where scenario_id = $1 and code = 'packaging'`, [scenario]))!.id;

  // --- packaging items: present, with a unit and a rate; permanent
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
       on conflict (object_id, field_def_id) do update set value_text = excluded.value_text`, [id, cls, item.unit]);
    // sheet rates always win; the estimates only fill a rate that isn't set
    await query(
      `insert into field_value (object_id, field_def_id, value_num)
       select $1, f.id, $3 from field_def f where f.class_id = $2 and f.key = 'rate'
       on conflict (object_id, field_def_id) do update set value_num =
         case when $4::boolean then excluded.value_num else coalesce(field_value.value_num, excluded.value_num) end`,
      [id, cls, item.rate, name in SHEET]);
  }

  // --- details behind each rate (the sheet's own are reset; ones typed in the app for other items stay)
  for (const [name, [category, base, gst, freight]] of Object.entries(DETAILS)) {
    const id = ids.get(name);
    if (!id) continue;
    await query(
      `insert into packaging_detail (packaging_id, category, base_rate, gst_pct, freight) values ($1, $2, $3, $4, $5)
       on conflict (packaging_id) do update set category = excluded.category, base_rate = excluded.base_rate,
         gst_pct = excluded.gst_pct, freight = excluded.freight`,
      [id, category, base, gst, freight]);
  }

  // --- each SKU's list
  let n = 0;
  for (const [code, lines] of Object.entries(LISTS)) {
    const sku = await one<{ id: string }>(`select id from sku where scenario_id = $1 and code = $2`, [scenario, code]);
    if (!sku) continue;
    await query(`delete from sku_packing_item where sku_id = $1`, [sku.id]);
    for (const [i, [item, qty, per, basis, factor]] of lines.entries()) {
      await query(`insert into sku_packing_item (sku_id, packaging_id, qty, per, basis, factor, sort_order) values ($1, $2, $3, $4, $5, $6, $7)`,
        [sku.id, ids.get(item), qty, per, basis ?? "qty", factor ?? null, i]);
    }
    n++;
  }

  // --- saved packs
  await query(`delete from pack_template where scenario_id = $1`, [scenario]);
  for (const [t, tpl] of TEMPLATES.entries()) {
    const product = tpl.product
      ? (await one<{ id: string }>(`select id from bulk_product where scenario_id = $1 and name = $2`, [scenario, tpl.product]))?.id ?? null
      : null;
    const id = (await one<{ id: string }>(
      `insert into pack_template (scenario_id, bulk_product_id, name, note, sort_order) values ($1, $2, $3, $4, $5) returning id`,
      [scenario, product, tpl.name, tpl.note, t]))!.id;
    for (const [i, [item, qty, per, basis, factor]] of tpl.lines.entries()) {
      await query(`insert into pack_template_item (template_id, packaging_id, qty, per, basis, factor, sort_order) values ($1, $2, $3, $4, $5, $6, $7)`,
        [id, ids.get(item), qty, per, basis ?? "qty", factor ?? null, i]);
    }
  }

  // --- retire the old estimated items nothing uses any more
  await query(
    `delete from cost_object o where o.class_id = $1 and o.name <> all($2)
        and not exists (select 1 from sku_packing_item i where i.packaging_id = o.id)
        and not exists (select 1 from sku_pack_material m where m.packaging_id = o.id)
        and not exists (select 1 from bom_line b where b.component_object_id = o.id)
        and not exists (select 1 from pack_template_item t where t.packaging_id = o.id)`,
    [cls, Object.keys(ITEMS)]);

  // keep them (and their rates) out of the demo seed's undo
  const all = [...ids.values()];
  await query(`delete from demo_seed where tbl = 'cost_object' and row_id = any($1)`, [all]);
  await query(`delete from demo_seed where tbl = 'field_value' and row_id in (select id from field_value where object_id = any($1))`, [all]);

  await recompute(scenario, "sku-packing-seed");
  console.log(`Packing lists set for ${n} SKUs; ${Object.keys(ITEMS).length} packaging items in the master.`);
}

main().then(() => pool.end()).catch(async (e) => { console.error(e instanceof Error ? e.message : e); await pool.end(); process.exit(1); });
