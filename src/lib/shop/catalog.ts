import "server-only";
import { query } from "@/lib/db";
import { appCatalog } from "@/lib/products/app-products";

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
export const PUBLIC_URL = (process.env.SHOP_PUBLIC_URL ?? "https://production.vamadairy.in").replace(/\/+$/, "").replace(/'/g, "");

/** A photo's link: our own copy when we hold the picture (versioned, so a new upload is not served from cache), else the imported link. */
export const photoUrlOf = (a: string) =>
  `case when ${a}.data is not null then '${PUBLIC_URL}/api/shop/product-image/' || ${a}.uid || '?v=' || extract(epoch from ${a}.updated_at)::bigint else ${a}.image_url end`;

/**
 * Every visible product on a Product Master app list (D2C, Retail or Distributors), in that app's order. For
 * Retail / Distributors `price` is the D2C price; the Partners app puts each customer's own price on top.
 */
export async function listAllProducts(channel: "retail" | "distributor"): Promise<ShopProduct[]> {
  return appCatalog(channel);
}

/** Everything on sale in the D2C app, in the order it shows it (Product Master > D2C). */
export async function listProducts(): Promise<ShopProduct[]> {
  return appCatalog("d2c");
}

export async function getProduct(sku: string): Promise<ShopProduct | null> {
  return (await appCatalog("d2c", [sku]))[0] ?? null;
}

/** The prices a customer would really pay for these SKUs - the order never trusts what the browser sent. */
export async function pricesFor(skus: string[]): Promise<Map<string, ShopProduct>> {
  if (!skus.length) return new Map();
  return new Map((await appCatalog("d2c", skus)).map((r) => [r.sku, r]));
}

export async function productImage(uid: string): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return null;
  const rows = await query<{ data: Buffer; mime: string | null }>(`select data, mime from fp_product_image where uid = $1 and data is not null`, [uid]);
  return rows[0] ? { bytes: rows[0].data, mime: rows[0].mime ?? "image/jpeg" } : null;
}
