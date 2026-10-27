/**
 * Puts the product photos in db/product-photos/<sku code>/ (in file order: 00.jpg / 01.jpg first) into the
 * database, so the Gaia app, its orders and the Product Master show them. Each product's old photos are
 * removed first - many were links to the old system's storage that no longer open - so these become its photos.
 * Safe to run again.
 *
 * Two sets: pack shots named by barcode (EAN) for 8 SKUs, and the shop photos (gaia-product-images, named by
 * product) for the rest. Combo / offer pictures are not products and are not here.
 *
 *   npm run db:product-photos
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const DIR = join(__dirname, "product-photos");

/** SKU code -> where its photos came from (for the record; every folder in DIR is loaded). */
const SETS: Record<string, string> = {
  // pack shots, by barcode
  "1003": "EAN 8906101510009 - Gaia Toned Milk 500 ml",
  "1014": "EAN 8906101510054 - Gaia Dahi Pouch 1 kg",
  "1005": "EAN 8906101510146 - Gaia Paneer 200 g",
  "1013": "EAN 8906101510450 - Gaia Dahi Pouch 400 g",
  "999": "EAN 8906101510627 - Gaia Cow Milk 500 ml (front from shop photo 39)",
  "1056": "EAN 8906101510726 - Gaia Dahi Cup 200 g box",
  "1050": "EAN 8906101510856 - Gaia Premium Milk UHT 1 L",
  "1051": "EAN 8906101510917 - Gaia Lite Milk UHT 1 L",
  // shop photos, by product name (the number is the file's in gaia-product-images)
  "1033": "01 Gaia Ghee Tin 15 kg",
  "1041": "02 Cow Ghee Jar 1 L",
  "1039": "03 Cow Ghee Jar 200 ml",
  "1040": "04 Cow Ghee Jar 500 ml",
  "1037": "05 Cow Ghee Ceka Pack 1 L",
  "1031": "06 Gaia Ghee Jar 1 L",
  "1029": "07 Gaia Ghee Jar 200 ml",
  "1030": "08 Gaia Ghee Jar 500 ml",
  "1032": "09 Gaia Ghee Jar 5 L",
  "1038": "10 Gaia Ghee Ceka Pack 1 L",
  "1055": "11 Gaia Ghee Pouch 20 ml",
  "1011": "12 + 61 Gaia Dahi Cup 200 g",
  "1012": "14 Gaia Dahi Pouch 200 g",
  "1015": "16 Gaia Dahi Pouch 5 kg",
  "1016": "17 Gaia Dahi Bucket 15 kg",
  "1047": "18 Gaia Dahi Bucket 5 kg",
  "1042": "20 Gaia Maxx 120 ml",
  "1045": "21 Gaia Maxx 400 ml",
  "1007": "22 Gaia Malai Paneer 1 kg",
  "1006": "24 Gaia Malai Paneer 500 g",
  "1008": "25 Loose Paneer 1 kg",
  "1017": "26 Gaia Premium Sweet Dahi (Lychee) 90 g",
  "1020": "27 Gaia Kadhi Dahi 200 g",
  "1019": "28 Gaia Kadhi Dahi 1 kg",
  "1021": "29 Gaia Kadhi Dahi 5 kg",
  "1022": "31 Gaia Kadhi Dahi Bucket 15 kg",
  "1034": "32 Gaia Peda 200 g",
  "1023": "33 Gaia Plain Lassi Glass 180 ml",
  "1046": "34 Gaia Masala Chaas Glass 180 ml",
  "1024": "35 Mango Lassi 180 ml",
  "1057": "37 Gaia Shahi Rabdi 80 g",
  "1049": "38 Kesar Peda 200 g",
  "1052": "46 Gaia Gold Milk Tetra Pack 1 L",
  "1048": "47 Rabdi Tray 6 pcs",
  "1058": "64 Gaia Shrikhand 80 g",
};

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp" });
  await db.connect();
  try {
    const owner = (
      await db.query<{ uid: string }>(
        `select uid from fp_staff order by (lower(email) = 'admin@vamaadairy.com') desc, active desc, created_at limit 1`,
      )
    ).rows[0]?.uid;
    if (!owner) throw new Error("No employees in fp_staff to own the photos - import the employees first.");

    for (const sku of readdirSync(DIR).filter((d) => !d.startsWith(".")).sort()) {
      const source = SETS[sku] ?? "product-photos";
      const files = readdirSync(join(DIR, sku)).filter((f) => f.endsWith(".jpg")).sort();
      // SKU codes were imported both as "1012" and "1,012": compare without separators
      const product = (
        await db.query<{ uid: string; name: string }>(
          `select uid, sku_name as name from fp_product
           where sku_code = $1 or regexp_replace(sku_code, '[^0-9A-Za-z]', '', 'g') = $1
           order by (sku_code = $1) desc, active desc limit 1`,
          [sku],
        )
      ).rows[0];
      if (!product) {
        console.log(`SKU ${sku}: no such product - skipped`);
        continue;
      }

      await db.query("begin");
      try {
        const tag = `product-photos/${sku}/`;
        // these become the product's photos: old ones (often dead links to the old storage) go
        await db.query(`delete from fp_product_image where product_uid = $1`, [product.uid]);
        let next = (
          await db.query<{ n: number }>(`select coalesce(max(imagesno), 0) + 1 as n from fp_product_image where product_uid = $1`, [product.uid])
        ).rows[0].n;
        for (const f of files) {
          const id = randomUUID();
          await db.query(
            `insert into fp_product_image (uid, image_url, data, mime, source_url, imagesno, product_uid, staff_uid)
             values ($1, $2, $3, 'image/jpeg', $4, $5, $6, $7)`,
            [id, `/api/shop/product-image/${id}`, readFileSync(join(DIR, sku, f)), `${tag}${f} (${source})`, next++, product.uid, owner],
          );
        }
        await db.query("commit");
        console.log(`SKU ${sku} ${product.name}: ${files.length} photo(s) set`);
      } catch (e) {
        await db.query("rollback");
        throw e;
      }
    }
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
