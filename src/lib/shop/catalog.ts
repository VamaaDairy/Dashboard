import "server-only";
import { query } from "@/lib/db";
import { displayName } from "./pricing";

export interface ShopProduct {
  sku: string;
  name: string;
  category: string;
  subCategory: string;
  size: string | null;
  mrp: number;
  price: number;
  description: string | null;
  image: string | null;
  /** Every photo, first one = `image`; the app's product page swipes through them. */
  images: string[];
}

const SELECT = `
  select p.sku_code as sku, p.sku_name as name, p.category, p.sub_category as "subCategory", p.sku_size as size,
         p.mrp, coalesce(si.price, p.mrp) as price, nullif(trim(p.description), '') as description,
         (select i.image_url from fp_product_image i where i.product_uid = p.uid order by i.imagesno nulls last limit 1) as image,
         coalesce((select array_agg(i.image_url order by i.imagesno nulls last) from fp_product_image i where i.product_uid = p.uid), '{}') as images
  from fp_product p
  left join shop_item si on si.sku_code = p.sku_code
  where p.active = 1 and p.mrp > 0 and coalesce(si.visible, true)`;

const clean = (r: ShopProduct): ShopProduct => ({ ...r, name: displayName(r.name) });

/** Everything on sale, in the order the shop shows it. */
export async function listProducts(): Promise<ShopProduct[]> {
  const rows = await query<ShopProduct>(`${SELECT} order by si.sort nulls last, p.position nulls last, p.sku_name`);
  return rows.map(clean);
}

export async function getProduct(sku: string): Promise<ShopProduct | null> {
  const rows = await query<ShopProduct>(`${SELECT} and p.sku_code = $1`, [sku]);
  return rows[0] ? clean(rows[0]) : null;
}

/** The prices a customer would really pay for these SKUs - the order never trusts what the browser sent. */
export async function pricesFor(skus: string[]): Promise<Map<string, ShopProduct>> {
  if (!skus.length) return new Map();
  const rows = await query<ShopProduct>(`${SELECT} and p.sku_code = any($1)`, [skus]);
  return new Map(rows.map((r) => [r.sku, clean(r)]));
}
