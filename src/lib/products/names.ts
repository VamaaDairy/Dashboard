import "server-only";
import { one, query, tx } from "@/lib/db";
import { displayName } from "@/lib/shop/pricing";
import { splitSize } from "@/lib/products/app-products";

/**
 * One name for every product, everywhere in the dashboard (migration 093).
 *
 * The name is the one the Gaia D2C app shows: its own name on the D2C list (Product Master > D2C), else the
 * Product Master name without the quantity. The pack quantity and unit are kept apart ("500" + "ml"), never
 * run into the name, and every product carries its SKU code and first photo.
 *
 * Other lists name products their own way (production SKUs "Gaia Doodh Toned 500ml- Pkt", route orders, credit
 * notes). They link to the Product Master by the digits of the SKU code (T1042 = 1,042 = 1042), and show this
 * name instead; a code the Product Master doesn't have keeps its own name, split the same way and marked.
 */
export interface ProductLabel {
  sku: string;
  skuNo: number | null;
  name: string;
  qty: string | null;
  unit: string | null;
  image: string | null;
  /** False when the SKU code is not in the Product Master (the name is then that list's own). */
  inMaster: boolean;
  /**
   * Set when this list's own name for the SKU code looks like a different product from the Product Master's
   * (no word in common): the list's own name is shown, and this holds the master's, until someone fixes the code.
   */
  clash?: string;
}

// words that say nothing about which product it is
const NOISE = new Set([
  "gaia", "premium", "pure", "fresh", "pkt", "packet", "packets", "crt", "box", "pcs", "pc", "jar", "pack", "cup", "cups", "glass",
  "pouch", "bucket", "tin", "tetra", "ceka", "ltr", "kilogram", "gms", "gm", "the", "and", "with", "loose", "case", "tray",
]);
const words = (s: string) =>
  new Set((s.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => !NOISE.has(w)).map((w) => (w === "doodh" ? "milk" : w === "chaach" ? "chaas" : w)));

/** The pack size in grams / ml ("1.5 KG" -> 1500, "500ml" -> 500), or null when the name has none. */
function grams(s: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(kilograms?|kgs?|ltrs?|litres?|liters?|l|ml|gms?|grams?|g)\b/i.exec(s);
  if (!m) return null;
  const big = /^(k|l)/i.test(m[2]) && !/^ml$/i.test(m[2]);
  return Math.round(Number(m[1]) * (big ? 1000 : 1));
}

/**
 * True when two names can't be the same product: no word that identifies a product in common ("Kesar Peda" vs
 * "Khowa Brown"), or both give a pack size and the sizes differ ("Kadhi Dahi Bucket 1.5 KG" vs "Sweet Dahi 90 g").
 */
export function looksDifferent(a: string, b: string): boolean {
  const ga = grams(a);
  const gb = grams(b);
  if (ga !== null && gb !== null && ga !== gb) return true;
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return false;
  for (const w of x) if (y.has(w)) return false;
  return true;
}

/** The digits of a SKU code, the key every list shares: "T1042", "1,042" and "1042" are all 1042. */
export function skuNo(code: string | number | null | undefined): number | null {
  const d = String(code ?? "").replace(/\D/g, "");
  return d ? Number(d) : null;
}

import { qtyUnit } from "@/lib/products/qty-unit";
export { qtyUnit };

/** A name from some other list, tidied the same way (no quantity in it). */
export function looseLabel(code: string | number | null | undefined, rawName: string | null | undefined): ProductLabel {
  const split = splitSize(displayName(String(rawName ?? "").trim() || String(code ?? "")));
  return { sku: String(code ?? "").trim(), skuNo: skuNo(code), name: split.name, ...qtyUnit(split.size), image: null, inMaster: false };
}

const IMAGE = `(select case when i.data is not null then '/api/shop/product-image/' || i.uid || '?v=' || extract(epoch from i.updated_at)::bigint else i.image_url end
                 from fp_product_image i where i.product_uid = p.uid and i.archived_at is null order by i.imagesno nulls last limit 1)`;

const FINGERPRINT = `
  select md5(coalesce(string_agg(concat_ws('|', p.uid, p.sku_code, p.sku_name, p.sku_size, a.name, a.size, ${IMAGE}), ',' order by p.uid), '')) as f
  from fp_product p left join app_product a on a.channel = 'd2c' and a.product_uid = p.uid`;

let checkedAt = 0;
let inFlight: Promise<void> | null = null;

/**
 * Brings product_label up to date with the Product Master, the D2C list and the photos. Cheap when nothing
 * changed (one checksum query, at most every 15 seconds per server); rebuilds the table when something did.
 */
export function syncProductLabels(force = false): Promise<void> {
  if (!force && Date.now() - checkedAt < 15_000) return inFlight ?? Promise.resolve();
  inFlight ??= (async () => {
    try {
      const [{ f }] = await query<{ f: string }>(FINGERPRINT);
      const state = await one<{ fingerprint: string }>(`select fingerprint from product_label_state where id = 1`);
      if (state?.fingerprint === f && !force) return;
      const rows = await query<{ uid: string; sku: string; masterName: string; masterSize: string | null; ownName: string | null; ownSize: string | null; image: string | null }>(
        `select p.uid, p.sku_code as sku, p.sku_name as "masterName", nullif(trim(p.sku_size), '') as "masterSize",
                nullif(trim(a.name), '') as "ownName", nullif(trim(a.size), '') as "ownSize", ${IMAGE} as image
         from fp_product p left join app_product a on a.channel = 'd2c' and a.product_uid = p.uid`,
      );
      const labels = rows.map((r) => {
        const split = splitSize(displayName(r.masterName));
        const { qty, unit } = qtyUnit(r.ownSize ?? r.masterSize ?? split.size);
        return [r.uid, r.sku, skuNo(r.sku), r.ownName ?? split.name, qty, unit, r.image] as const;
      });
      await tx(async (c) => {
        await c.query(`delete from product_label`);
        if (labels.length) {
          await c.query(
            `insert into product_label (product_uid, sku_code, sku_no, name, qty, unit, image)
             select * from unnest($1::uuid[], $2::text[], $3::bigint[], $4::text[], $5::text[], $6::text[], $7::text[])`,
            [0, 1, 2, 3, 4, 5, 6].map((k) => labels.map((l) => l[k])),
          );
        }
        await c.query(
          `insert into product_label_state (id, fingerprint, refreshed_at) values (1, $1, now())
           on conflict (id) do update set fingerprint = excluded.fingerprint, refreshed_at = now()`,
          [f],
        );
      });
    } catch (e) {
      // never take a page down over names: the last good labels stay
      console.error("[product-label] sync failed:", e);
    } finally {
      checkedAt = Date.now();
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Every product's label, by SKU number. */
export async function productLabels(): Promise<Map<number, ProductLabel>> {
  await syncProductLabels();
  const rows = await query<{ sku: string; skuNo: string | null; name: string; qty: string | null; unit: string | null; image: string | null }>(
    `select sku_code as sku, sku_no as "skuNo", name, qty, unit, image from product_label order by sku_no`,
  );
  const map = new Map<number, ProductLabel>();
  for (const r of rows) {
    const n = r.skuNo === null ? null : Number(r.skuNo);
    if (n !== null && !map.has(n)) map.set(n, { sku: r.sku, skuNo: n, name: r.name, qty: r.qty, unit: r.unit, image: r.image, inMaster: true });
  }
  return map;
}

/**
 * The label for a SKU code, falling back to that list's own name when the Product Master doesn't have it
 * (and to that list's own photo when the master has none).
 */
export function labelOf(
  labels: Map<number, ProductLabel>, code: string | number | null | undefined, ownName?: string | null, ownImage?: string | null,
): ProductLabel {
  const n = skuNo(code);
  let l = (n !== null && labels.get(n)) || looseLabel(code, ownName);
  // the code points at another product than this list means: keep the list's name, and say so
  if (l.inMaster && ownName && looksDifferent(ownName, l.name)) l = { ...looseLabel(code, ownName), clash: l.name };
  return l.image || !ownImage ? l : { ...l, image: ownImage };
}

/** "1042 Gaia Maxx UHT 110 ml": for plain text (messages, CSV, search), with the quantity after the name. */
export const labelText = (p: ProductLabel) => [p.sku, p.name, [p.qty, p.unit].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

export { labelJoin, skuNoSql } from "@/lib/products/label-sql";
