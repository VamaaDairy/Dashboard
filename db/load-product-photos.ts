/**
 * Puts the product photos in db/product-photos/<sku code>/ (01.jpg first, then in order) into the
 * database, so the shop app and the Product Master show them. The photos come from the pack-shot
 * set named by barcode (EAN); each set is filed under the SKU it belongs to.
 *
 * For a "replace" product its old photos are removed first, so these become its photos. For an
 * "append" product (no front-of-pack shot in the set) the existing photos stay first and these are
 * added after them. Safe to run again: earlier copies loaded by this script are replaced, not doubled.
 *
 *   npx tsx db/load-product-photos.ts
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const DIR = join(__dirname, "product-photos");

/** SKU code -> barcode on the pack, and whether the set replaces the product's photos. */
const SETS: Record<string, { ean: string; mode: "replace" | "append" }> = {
  "1003": { ean: "8906101510009", mode: "replace" }, // Gaia Toned Milk 500 ml
  "1014": { ean: "8906101510054", mode: "replace" }, // Gaia Dahi Pouch 1 kg
  "1005": { ean: "8906101510146", mode: "replace" }, // Gaia Paneer 200 g
  "1013": { ean: "8906101510450", mode: "replace" }, // Gaia Dahi Pouch 400 g
  "999": { ean: "8906101510627", mode: "append" }, // Gaia Cow Milk 500 ml - back of pack only
  "1056": { ean: "8906101510726", mode: "replace" }, // Gaia Dahi Cup 200 g box
  "1050": { ean: "8906101510856", mode: "replace" }, // Gaia Premium Milk UHT 1 L
  "1051": { ean: "8906101510917", mode: "replace" }, // Gaia Lite Milk UHT 1 L
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

    for (const [sku, set] of Object.entries(SETS)) {
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
        if (set.mode === "replace") {
          await db.query(`delete from fp_product_image where product_uid = $1`, [product.uid]);
        } else {
          await db.query(`delete from fp_product_image where product_uid = $1 and source_url like $2`, [product.uid, `${tag}%`]);
        }
        let next = (
          await db.query<{ n: number }>(`select coalesce(max(imagesno), 0) + 1 as n from fp_product_image where product_uid = $1`, [product.uid])
        ).rows[0].n;
        for (const f of files) {
          const id = randomUUID();
          await db.query(
            `insert into fp_product_image (uid, image_url, data, mime, source_url, imagesno, product_uid, staff_uid)
             values ($1, $2, $3, 'image/jpeg', $4, $5, $6, $7)`,
            [id, `/api/shop/product-image/${id}`, readFileSync(join(DIR, sku, f)), `${tag}${f} (EAN ${set.ean})`, next++, product.uid, owner],
          );
        }
        await db.query("commit");
        console.log(`SKU ${sku} ${product.name}: ${files.length} photo(s) ${set.mode === "replace" ? "set" : "added"}`);
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
