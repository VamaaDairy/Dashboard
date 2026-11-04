/**
 * One-off: puts the gaiadairy.com product photos and category icons (which the apps used to carry inside
 * themselves) into Product Master, so from now on the Dashboard alone decides what the apps show.
 *
 * Each product on an app list is matched to its website photos by name, exactly as the apps did. The
 * website photos go in front of the product's existing photos (so the apps look the same as before); a
 * category gets its icon only when it has none yet. Safe to run again: a photo already loaded is skipped.
 *
 *   npx tsx db/load-site-photos.ts <folder with p/ and cat/>
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { Client } from "pg";

/** The website product a catalogue product is, by the words in its name (first match wins) - as the apps did. */
function handleFor(name: string, category: string): string | null {
  const t = `${name} ${category}`.toLowerCase();
  const has = (w: string) => t.includes(w);
  // packs the website has no photo of keep their own
  if (has("bucket") || has(" tin") || has("tray") || has("lychee") || (has("shrikhand") && has("box")) || (has("chaas") && has("glass"))) return null;
  if (has("kadhi")) return "gaia-kadhi-dahi-pouch";
  if (has("mishti")) return "mishti-doi";
  if (has("shrikhand")) return "shrikhand";
  if (has("peda")) return has("kesar") ? "kesar-peda" : "gaia-milk-peda";
  if (has("rabdi") || has("rabri")) return "gaia-shahi-rabdi";
  if (has("mango")) return "gaia-mango-lassi-glass-180-ml";
  if (has("lassi")) return "gaia-strawberry-lassi";
  if (has("chaas") || has("chhach") || has("butter milk") || has("buttermilk")) return "gaia-masala-chaas-pouch-200-ml";
  if (has("paneer") || has("panner")) return "gaia-malai-paneer";
  if (has("dahi") || has("curd")) return has("cup") ? "gaia-dahi-cup" : "gaia-dahi-pouch";
  if (has("ghee")) {
    if (has("ceka")) return has("cow") ? "cow-ghee-ceka-pack" : "desi-ghee-ceka-pack";
    return has("cow") ? "cow-ghee" : "gaia-premium-desi-ghee-jar";
  }
  if (has("gold")) return "premium-milk-copy";
  if (has("lite")) return "lite-milk";
  if (has("max") || has("esl")) return "esl-120-ml";
  if (has("uht") || has("premium")) return "premium-milk";
  if (has("cow")) return "cow-milk-500ml";
  if (has("milk") || has("doodh")) return "gaia-doodh-toned-fat-3-0";
  return null;
}

/** The website's icon for a category (file name in cat/), as the apps did. */
function iconFor(category: string): string | null {
  const t = category.toLowerCase();
  if (t.includes("ghee")) return "ghee";
  if (t.includes("paneer")) return "paneer";
  if (t.includes("dahi") || t.includes("curd")) return "dahi";
  if (t.includes("chaas") || t.includes("butter")) return "chaas";
  if (t.includes("lassi") || t.includes("beverage") || t.includes("drink")) return "lassi";
  if (t.includes("dessert") || t.includes("sweet") || t.includes("peda") || t.includes("mithai")) return "dessert";
  if (t.includes("milk") || t.includes("uht") || t.includes("doodh")) return "milk";
  return null;
}

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Usage: npx tsx db/load-site-photos.ts <folder with p/ and cat/>");
  const photoFiles = readdirSync(join(dir, "p")).filter((f) => MIME[extname(f).toLowerCase()]).sort();
  const galleryOf = (h: string) => photoFiles.filter((f) => f.startsWith(`${h}_`)).sort((a, b) => Number(a.split("_").pop()!.split(".")[0]) - Number(b.split("_").pop()!.split(".")[0]));

  const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp" });
  await db.connect();
  try {
    const owner = (await db.query<{ uid: string }>(`select uid from fp_staff order by created_at limit 1`)).rows[0]?.uid;
    if (!owner) throw new Error("No employee to file the photos under.");

    // every product on any app list, with the name and category an app shows it under
    const products = (
      await db.query<{ uid: string; sku: string; name: string; category: string }>(
        `select distinct on (p.uid) p.uid, p.sku_code as sku, coalesce(nullif(trim(a.name), ''), p.sku_name) as name,
                coalesce(nullif(trim(a.category), ''), p.category, '') as category
           from app_product a join fp_product p on p.uid = a.product_uid
          order by p.uid, (a.channel = 'd2c') desc`,
      )
    ).rows;

    let added = 0, touched = 0;
    for (const p of products) {
      const h = handleFor(p.name, p.category);
      const files = h ? galleryOf(h) : [];
      if (!files.length) continue;
      const have = new Set(
        (await db.query<{ source_url: string }>(`select source_url from fp_product_image where product_uid = $1 and source_url like 'gaiadairy.com:%'`, [p.uid])).rows.map((r) => r.source_url),
      );
      const fresh = files.filter((f) => !have.has(`gaiadairy.com:${f}`));
      if (!fresh.length) continue;
      await db.query("begin");
      try {
        // the website photos go first, in their own order; the product's other photos follow
        await db.query(`update fp_product_image set imagesno = coalesce(imagesno, 0) + $2, updated_at = now() where product_uid = $1`, [p.uid, files.length]);
        for (const [i, f] of files.entries()) {
          const src = `gaiadairy.com:${f}`;
          if (have.has(src)) {
            await db.query(`update fp_product_image set imagesno = $3, updated_at = now() where product_uid = $1 and source_url = $2`, [p.uid, src, i + 1]);
            continue;
          }
          await db.query(
            `insert into fp_product_image (uid, image_url, data, mime, source_url, imagesno, product_uid, staff_uid)
             values (gen_random_uuid(), '', $1, $2, $3, $4, $5, $6)`,
            [readFileSync(join(dir, "p", f)), MIME[extname(f).toLowerCase()], src, i + 1, p.uid, owner],
          );
          added++;
        }
        await db.query(`update fp_product_image set image_url = '/api/shop/product-image/' || uid where product_uid = $1 and image_url = ''`, [p.uid]);
        await db.query(
          `insert into master_audit (actor, slug, record_id, action, summary) values ('load-site-photos', 'fpproducts', $1, 'update', 'Website photos added')`,
          [p.uid],
        );
        await db.query("commit");
        touched++;
        console.log(`${p.sku.padEnd(14)} ${p.name} -> ${fresh.length} photo(s)`);
      } catch (e) {
        await db.query("rollback");
        throw e;
      }
    }
    console.log(`Photos: ${added} added to ${touched} products.`);

    // category icons, on every list, only where a category has none yet
    let icons = 0;
    const cats = (
      await db.query<{ channel: string; name: string }>(
        `select channel, name from app_category
         union
         select a.channel, coalesce(nullif(trim(a.category), ''), p.category) from app_product a join fp_product p on p.uid = a.product_uid
          where coalesce(nullif(trim(a.category), ''), p.category) is not null`,
      )
    ).rows;
    for (const c of cats) {
      const key = iconFor(c.name);
      if (!key) continue;
      const bytes = readFileSync(join(dir, "cat", `${key}.png`));
      const r = await db.query(
        `insert into app_category (channel, name, sort, icon_data, icon_mime, updated_at)
         values ($1, $2, coalesce((select max(sort) from app_category where channel = $1), 0) + 10, $3, 'image/png', now())
         on conflict (channel, name) do update set icon_data = excluded.icon_data, icon_mime = excluded.icon_mime, updated_at = now()
           where app_category.icon_data is null`,
        [c.channel, c.name, bytes],
      );
      if (r.rowCount) {
        icons++;
        console.log(`icon ${c.channel}/${c.name} -> ${key}`);
      }
    }
    console.log(`Category icons: ${icons} set.`);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
