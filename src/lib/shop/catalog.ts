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

/** Where the app reaches this server: stored photos are given to it as full links. */
const PUBLIC_URL = (process.env.SHOP_PUBLIC_URL ?? "https://production.vamadairy.in").replace(/\/+$/, "").replace(/'/g, "");

/** A photo's link: our own copy when we hold the picture (versioned, so a new upload is not served from cache), else the imported link. */
const photoUrl = `case when i.data is not null then '${PUBLIC_URL}/api/shop/product-image/' || i.uid || '?v=' || extract(epoch from i.updated_at)::bigint else i.image_url end`;

const COLUMNS = `
  select p.sku_code as sku, p.sku_name as name, p.category, p.sub_category as "subCategory", p.sku_size as size,
         p.mrp, coalesce(si.price, p.mrp) as price, nullif(trim(p.description), '') as description,
         (select ${photoUrl} from fp_product_image i where i.product_uid = p.uid order by i.imagesno nulls last limit 1) as image,
         coalesce((select array_agg(${photoUrl} order by i.imagesno nulls last) from fp_product_image i where i.product_uid = p.uid), '{}') as images
  from fp_product p
  left join shop_item si on si.sku_code = p.sku_code
  where p.active = 1 and p.mrp > 0`;
const SELECT = `${COLUMNS} and coalesce(si.visible, true)`;

const clean = (r: ShopProduct): ShopProduct => ({ ...r, name: displayName(r.name) });

/**
 * Every active product with an MRP, including the ones hidden from the customer shop - what distributors and
 * retailers can order (at their own price), in the shop's order.
 */
export async function listAllProducts(): Promise<ShopProduct[]> {
  const rows = await query<ShopProduct>(`${COLUMNS} order by si.sort nulls last, p.position nulls last, p.sku_name`);
  return rows.map(clean);
}

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

export async function productImage(uid: string): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return null;
  const rows = await query<{ data: Buffer; mime: string | null }>(`select data, mime from fp_product_image where uid = $1 and data is not null`, [uid]);
  return rows[0] ? { bytes: rows[0].data, mime: rows[0].mime ?? "image/jpeg" } : null;
}
