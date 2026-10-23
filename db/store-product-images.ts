/**
 * Copies every product photo that is only a link to the old system's storage into our own
 * database (fp_product_image.data), so the pictures stay even if that storage goes away and can be
 * replaced from the Product Master. Safe to run again: it only touches rows that have no copy yet.
 *
 *   npx tsx db/store-product-images.ts
 */
import "dotenv/config";
import { Client } from "pg";

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp" });
  await db.connect();
  try {
    const { rows } = await db.query<{ uid: string; image_url: string }>(`select uid, image_url from fp_product_image where data is null and image_url ~* '^https?://'`);
    let stored = 0;
    const failed: string[] = [];
    for (const r of rows) {
      try {
        const res = await fetch(r.image_url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
        if (!mime.startsWith("image/")) throw new Error(`not an image (${mime})`);
        await db.query(`update fp_product_image set data = $2, mime = $3, source_url = coalesce(source_url, image_url), updated_at = now() where uid = $1`, [r.uid, Buffer.from(await res.arrayBuffer()), mime]);
        stored++;
      } catch (e) {
        failed.push(`${r.uid} ${r.image_url}: ${(e as Error).message}`);
      }
    }
    console.log(`Stored ${stored} of ${rows.length} photos.`);
    if (failed.length) console.log(`Not stored:\n${failed.join("\n")}`);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
