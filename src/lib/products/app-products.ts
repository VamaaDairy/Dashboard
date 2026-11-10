import "server-only";
import { randomUUID } from "node:crypto";
import { one, query, tx } from "@/lib/db";
import { PUBLIC_URL, photoUrlOf, type ShopProduct } from "@/lib/shop/catalog";
import { displayName, shopCategory } from "@/lib/shop/pricing";
import { qtyUnit } from "@/lib/products/qty-unit";

/**
 * Product Master for the apps: one product list per app channel (migration 068). D2C is the Gaia shop app,
 * Retail and Distributors are the Gaia Distributors app (retailer logins, and distributor / sales officer logins).
 * Each list holds, for its app only, which products show, their order, category, name and size.
 */
export type AppChannel = "d2c" | "retail" | "distributor";

export const APP_CHANNELS: Array<{ key: AppChannel; label: string; app: string }> = [
  { key: "d2c", label: "D2C", app: "Gaia app (customers)" },
  { key: "retail", label: "Retailer", app: "Gaia Distributors app (retailers)" },
  { key: "distributor", label: "Wholesale (Distributors)", app: "Gaia Distributors app (distributors & sales officers)" },
];

export const isAppChannel = (c: string): c is AppChannel => APP_CHANNELS.some((x) => x.key === c);

// ---------------------------------------------------------------- name and size

const UNIT: Record<string, string> = {
  ml: "ml", l: "Ltr", lt: "Ltr", ltr: "Ltr", ltrs: "Ltr", litre: "Ltr", litres: "Ltr", liter: "Ltr", liters: "Ltr",
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", kg: "kg", kgs: "kg", pc: "pc", pcs: "pc",
};
const SIZE_RE = /(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(ml|ltrs?|litres?|liters?|lt|l|gms?|grams?|g|kgs?)\b/i;
// a pack count: "6 pc", "6Pc", "6 pcs", "6 pieces"
const COUNT_RE = /(\d+)\s*(?:pcs?|pieces?)\b/i;
// words still in capitals after the name is tidied ("JAR", "CEKA"), except the ones that are meant to be
const KEEP_CAPS = new Set(["UHT", "KE", "FG"]);

const cut = (s: string, m: RegExpExecArray) => s.slice(0, m.index) + " " + s.slice(m.index + m[0].length);

/**
 * "Gaia Toned Milk 500 ml" -> { name: "Gaia Toned Milk", size: "500 ml" }; "Gaia Shahi Rabdi 80g-Box 6Pc" ->
 * { name: "Gaia Shahi Rabdi Box", size: "6 x 80 g" }. A name without a quantity keeps its name and has no size.
 */
export function splitSize(full: string): { name: string; size: string | null } {
  let rest = full;
  let size: string | null = null;
  const m = SIZE_RE.exec(rest);
  if (m) {
    size = `${m[1] ? `${m[1]} x ` : ""}${m[2]} ${UNIT[m[3].toLowerCase()] ?? m[3]}`;
    rest = cut(rest, m);
  }
  const n = COUNT_RE.exec(rest);
  if (n) {
    size = size ? `${n[1]} x ${size}` : `${n[1]} pc`;
    rest = cut(rest, n);
  }
  const name = rest
    .replace(/\s*[-–,]\s*(?=\s|$)/g, " ")
    .replace(/(^|\s)[-–](?=\S)/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\b[A-Z]{3,}\b/g, (w) => (KEEP_CAPS.has(w) ? w : w[0] + w.slice(1).toLowerCase()))
    .replace(/\s+/g, " ")
    .trim();
  return { name: name || full.trim(), size };
}

// ---------------------------------------------------------------- reading a list

interface Row {
  uid: string;
  sku: string;
  masterName: string;
  masterCategory: string;
  masterSize: string | null;
  ownName: string | null;
  ownSize: string | null;
  ownCategory: string | null;
  visible: boolean;
  sort: number;
  mrp: number;
  description: string | null;
  active: boolean;
  image: string | null;
  images: string[];
}

export interface AppProduct {
  uid: string;
  sku: string;
  /**
   * What the app shows: the name without the quantity, the quantity, the category. Name and size are the same
   * in every app - the D2C list's - so a SKU never has two names; only the category and order are per list.
   */
  name: string;
  size: string | null;
  /** The size split for tables: pack quantity and unit ("500" + "ml"). */
  qty: string | null;
  unit: string | null;
  category: string;
  /** What the D2C list has set (name, size) and this list (category); null = taken from the Product Master. */
  own: { name: string | null; size: string | null; category: string | null };
  masterName: string;
  visible: boolean;
  /** False when the product is switched off in the company Product Master (then no app shows it). */
  active: boolean;
  /** The one price: what the D2C app sells at, and the MRP every app shows. */
  mrp: number;
  description: string | null;
  image: string | null;
  images: string[];
}

// read when called: catalog.ts imports this file too
const photo = () => photoUrlOf("i");

async function rows(channel: AppChannel, where = "true", params: unknown[] = []): Promise<Row[]> {
  return query<Row>(
    `select p.uid, p.sku_code as sku, p.sku_name as "masterName", coalesce(nullif(trim(p.category), ''), 'Other') as "masterCategory",
            nullif(trim(p.sku_size), '') as "masterSize",
            -- one name and size for a SKU in every app: the D2C list's (see src/lib/products/names.ts)
            nullif(trim(d.name), '') as "ownName", nullif(trim(d.size), '') as "ownSize",
            nullif(trim(a.category), '') as "ownCategory", a.visible, a.sort, p.mrp::float as mrp,
            nullif(trim(p.description), '') as description, coalesce(p.active, 0) = 1 and p.mrp > 0 as active,
            (select ${photo()} from fp_product_image i where i.product_uid = p.uid and i.archived_at is null order by i.imagesno nulls last limit 1) as image,
            coalesce((select array_agg(${photo()} order by i.imagesno nulls last) from fp_product_image i where i.product_uid = p.uid and i.archived_at is null), '{}') as images
     from app_product a
     join fp_product p on p.uid = a.product_uid
     left join app_product d on d.channel = 'd2c' and d.product_uid = p.uid
     where a.channel = $1 and ${where}`,
    [channel, ...params],
  );
}

const shape = (r: Row): AppProduct => {
  const split = splitSize(displayName(r.masterName));
  const size = r.ownSize ?? r.masterSize ?? split.size;
  return {
    uid: r.uid,
    sku: r.sku,
    name: r.ownName ?? split.name,
    size,
    ...qtyUnit(size),
    category: r.ownCategory ?? shopCategory(r.masterCategory),
    own: { name: r.ownName, size: r.ownSize, category: r.ownCategory },
    masterName: r.masterName,
    visible: r.visible,
    active: r.active,
    mrp: Number(r.mrp),
    description: r.description,
    image: r.image,
    images: r.images,
  };
};

/** The list's categories in their order; a category used by a product but not ordered yet comes last, by name. */
async function categoryOrder(channel: AppChannel, used: string[]): Promise<string[]> {
  const set = (await query<{ name: string }>(`select name from app_category where channel = $1 order by sort, name`, [channel])).map((r) => r.name);
  const extra = [...new Set(used)].filter((c) => !set.includes(c)).sort((a, b) => a.localeCompare(b));
  return [...set, ...extra];
}

/** Products in the order the app shows them: category by category, and within one by the list's order. */
function inOrder(products: AppProduct[], sorts: Map<string, number>, cats: string[]) {
  const rank = new Map(cats.map((c, i) => [c, i]));
  return [...products].sort(
    (a, b) => (rank.get(a.category) ?? 1e6) - (rank.get(b.category) ?? 1e6) || (sorts.get(a.uid) ?? 0) - (sorts.get(b.uid) ?? 0) || a.name.localeCompare(b.name),
  );
}

/** A whole list for the Product Master page: every product on it, shown or hidden, plus its categories in order. */
export async function appList(channel: AppChannel): Promise<{ categories: string[]; products: AppProduct[] }> {
  const raw = await rows(channel);
  const products = raw.map(shape);
  const cats = await categoryOrder(channel, products.map((p) => p.category));
  const sorts = new Map(raw.map((r) => [r.uid, r.sort]));
  return { categories: cats, products: inOrder(products, sorts, cats) };
}

/**
 * What an app shows: the list's visible products that are active with an MRP, in order. `price` is the D2C
 * price, which is the MRP; the Partners app puts each customer's own price on top.
 */
export async function appCatalog(channel: AppChannel, skus?: string[]): Promise<ShopProduct[]> {
  const raw = await rows(
    channel,
    `a.visible and p.active = 1 and p.mrp > 0${skus ? " and p.sku_code = any($2)" : ""}`,
    skus ? [skus] : [],
  );
  const products = raw.map(shape);
  const cats = await categoryOrder(channel, products.map((p) => p.category));
  const sorts = new Map(raw.map((r) => [r.uid, r.sort]));
  return inOrder(products, sorts, cats).map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    subCategory: p.category,
    size: p.size,
    mrp: p.mrp,
    price: p.mrp,
    description: p.description,
    image: p.image,
    images: p.images,
  }));
}

/**
 * The list as the new D2C app shows it: what is on sale, then (last in each category) the hidden or switched-off
 * products that have an MRP, marked `available: false` - the app shows those greyed as out of stock. Only for
 * display: orders and prices always go through [appCatalog] (on sale only).
 */
export async function appCatalogWithUnavailable(channel: AppChannel): Promise<ShopProduct[]> {
  const raw = await rows(channel, `p.mrp > 0`);
  const products = raw.map(shape);
  const cats = await categoryOrder(channel, products.map((p) => p.category));
  const sorts = new Map(raw.map((r) => [r.uid, r.sort]));
  const ordered = inOrder(products, sorts, cats);
  const on = (p: AppProduct) => p.visible && p.active;
  // within each category: the ones on sale first, out of stock after them
  const byCat = new Map<string, AppProduct[]>();
  for (const p of ordered) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
  return [...byCat.values()].flatMap((list) => [...list.filter(on), ...list.filter((p) => !on(p))]).map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    subCategory: p.category,
    size: p.size,
    mrp: p.mrp,
    price: p.mrp,
    description: p.description,
    image: p.image,
    images: p.images,
    available: on(p),
  }));
}

/** "Gaia Toned Milk" + "500 ml": the full name for an order line or a message. */
export const fullName = (p: { name: string; size: string | null }) => (p.size ? `${p.name} ${p.size}` : p.name);

/** Company products that are not on this list yet (to add). */
export async function notOnList(channel: AppChannel) {
  const r = await query<{ uid: string; sku: string; name: string; category: string; mrp: number; active: boolean }>(
    `select p.uid, p.sku_code as sku, p.sku_name as name, coalesce(nullif(trim(p.category), ''), 'Other') as category, p.mrp::float as mrp,
            coalesce(p.active, 0) = 1 as active
     from fp_product p
     where not exists (select 1 from app_product a where a.channel = $1 and a.product_uid = p.uid)
     order by (coalesce(p.active, 0) = 1) desc, p.category, p.sku_name`,
    [channel],
  );
  return r.map((x) => ({ ...x, name: displayName(x.name) }));
}

// ---------------------------------------------------------------- changes

export type Result = { ok: true } | { ok: false; error: string };
const OK: Result = { ok: true };

const audit = (who: string, channel: AppChannel, record: string, action: string, summary: string, before: unknown = null, after: unknown = null) =>
  query(`insert into master_audit (actor, slug, record_id, action, summary, before, after) values ($1, $2, $3, $4, $5, $6, $7)`, [
    who, `productmaster.${channel}`, record, action, summary, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after),
  ]);

const label = (channel: AppChannel) => APP_CHANNELS.find((c) => c.key === channel)!.label;

/** Moves a product one place up or down within its category. */
export async function moveProduct(channel: AppChannel, uid: string, dir: -1 | 1, who: string): Promise<Result> {
  const { products } = await appList(channel);
  const i = products.findIndex((p) => p.uid === uid);
  if (i < 0) return { ok: false, error: "That product is not on this list." };
  const j = i + dir;
  if (j < 0 || j >= products.length || products[j].category !== products[i].category) return OK;
  const order = products.map((p) => p.uid);
  [order[i], order[j]] = [order[j], order[i]];
  await writeOrder(channel, order);
  await audit(who, channel, uid, "update", `${label(channel)}: ${products[i].name} moved ${dir < 0 ? "up" : "down"}`);
  return OK;
}

/** Puts the list in exactly this order (products not named keep their place after these). */
export async function reorderProducts(channel: AppChannel, uids: string[], who: string): Promise<Result> {
  const { products } = await appList(channel);
  const named = new Set(uids);
  const order = [...uids.filter((u) => products.some((p) => p.uid === u)), ...products.map((p) => p.uid).filter((u) => !named.has(u))];
  await writeOrder(channel, order);
  await audit(who, channel, "order", "update", `${label(channel)}: products reordered`);
  return OK;
}

async function writeOrder(channel: AppChannel, order: string[]) {
  await query(
    `update app_product a set sort = o.n * 10, updated_at = now()
     from unnest($2::uuid[]) with ordinality o(uid, n)
     where a.channel = $1 and a.product_uid = o.uid and a.sort is distinct from o.n * 10`,
    [channel, order],
  );
}

/** Moves a category one place up or down. */
export async function moveCategory(channel: AppChannel, name: string, dir: -1 | 1, who: string): Promise<Result> {
  const { categories } = await appList(channel);
  const i = categories.indexOf(name);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= categories.length) return OK;
  [categories[i], categories[j]] = [categories[j], categories[i]];
  await writeCategories(channel, categories);
  await audit(who, channel, name, "update", `${label(channel)}: category ${name} moved ${dir < 0 ? "up" : "down"}`);
  return OK;
}

async function writeCategories(channel: AppChannel, names: string[]) {
  await query(
    `insert into app_category (channel, name, sort)
     select $1, o.name, o.n * 10 from unnest($2::text[]) with ordinality o(name, n)
     on conflict (channel, name) do update set sort = excluded.sort, updated_at = now()`,
    [channel, names],
  );
}

const cleanCategory = (s: string) => s.trim().replace(/\s+/g, " ");

/** Renames a category on this list: every product in it moves to the new name. */
export async function renameCategory(channel: AppChannel, from: string, to: string, who: string): Promise<Result> {
  const name = cleanCategory(to);
  if (name.length < 2 || name.length > 40) return { ok: false, error: "A category name is 2 to 40 letters." };
  if (name === from) return OK;
  const { categories, products } = await appList(channel);
  if (!categories.includes(from)) return { ok: false, error: "That category is not on this list." };
  const uids = products.filter((p) => p.category === from).map((p) => p.uid);
  await tx(async (c) => {
    await c.query(`update app_product set category = $3, updated_at = now() where channel = $1 and product_uid = any($2::uuid[])`, [channel, uids, name]);
    await c.query(
      `insert into app_category (channel, name, sort, icon_data, icon_mime)
       select $1, $3, sort, icon_data, icon_mime from app_category where channel = $1 and name = $2
       on conflict (channel, name) do update set icon_data = coalesce(app_category.icon_data, excluded.icon_data),
         icon_mime = coalesce(app_category.icon_mime, excluded.icon_mime)`,
      [channel, from, name],
    );
    await c.query(`delete from app_category where channel = $1 and name = $2`, [channel, from]);
  });
  await audit(who, channel, from, "update", `${label(channel)}: category ${from} renamed to ${name}`);
  return OK;
}

/** A new, empty category at the end of this list (products are then moved into it). */
export async function addCategory(channel: AppChannel, name: string, who: string): Promise<Result> {
  const n = cleanCategory(name);
  if (n.length < 2 || n.length > 40) return { ok: false, error: "A category name is 2 to 40 letters." };
  const { categories } = await appList(channel);
  if (categories.some((c) => c.toLowerCase() === n.toLowerCase())) return { ok: false, error: "That category is already on this list." };
  await writeCategories(channel, [...categories, n]);
  await audit(who, channel, n, "create", `${label(channel)}: category ${n} added`);
  return OK;
}

/** Changes how this list shows a product. An empty name / size / category goes back to the Product Master's. */
export async function updateProduct(
  channel: AppChannel,
  uid: string,
  patch: { name?: string | null; size?: string | null; category?: string | null; visible?: boolean },
  who: string,
): Promise<Result> {
  const before = await one<{ name: string | null; size: string | null; category: string | null; visible: boolean }>(
    `select name, size, category, visible from app_product where channel = $1 and product_uid = $2`,
    [channel, uid],
  );
  if (!before) return { ok: false, error: "That product is not on this list." };
  const text = (v: string | null | undefined, max: number) => (v === undefined ? undefined : (v ?? "").trim().replace(/\s+/g, " ").slice(0, max) || null);
  // a SKU has one name and size in every app: only the D2C list sets them; the others keep their category and order
  const name = channel === "d2c" ? text(patch.name, 80) : undefined;
  const size = channel === "d2c" ? text(patch.size, 30) : undefined;
  const category = patch.category === undefined ? undefined : patch.category === null ? null : cleanCategory(patch.category).slice(0, 40) || null;
  if (category && category.length < 2) return { ok: false, error: "A category name is 2 to 40 letters." };

  const next = {
    name: name === undefined ? before.name : name,
    size: size === undefined ? before.size : size,
    category: category === undefined ? before.category : category,
    visible: patch.visible ?? before.visible,
  };
  await query(
    `update app_product set name = $3, size = $4, category = $5, visible = $6, updated_at = now() where channel = $1 and product_uid = $2`,
    [channel, uid, next.name, next.size, next.category, next.visible],
  );
  // a category used for the first time goes to the end of the category order
  if (next.category) {
    await query(
      `insert into app_category (channel, name, sort)
       select $1, $2, coalesce(max(sort), 0) + 10 from app_category where channel = $1
       on conflict (channel, name) do nothing`,
      [channel, next.category],
    );
  }
  const what = patch.visible !== undefined && Object.keys(patch).length === 1 ? (patch.visible ? "shown" : "hidden") : "edited";
  await audit(who, channel, uid, "update", `${label(channel)}: product ${what}`, before, next);
  return OK;
}

/** Puts company products on this list, at the end of their category, shown. */
export async function addToList(channel: AppChannel, uids: string[], who: string): Promise<Result> {
  if (!uids.length) return OK;
  await query(
    `insert into app_product (channel, product_uid, visible, sort)
     select $1, u, true, coalesce((select max(sort) from app_product where channel = $1), 0) + o.n * 10
     from unnest($2::uuid[]) with ordinality o(u, n)
     where exists (select 1 from fp_product p where p.uid = o.u)
     on conflict (channel, product_uid) do nothing`,
    [channel, uids],
  );
  await audit(who, channel, uids.join(","), "create", `${label(channel)}: ${uids.length} product(s) added to the list`);
  return OK;
}

/** Takes a product off this list (it stays in the company Product Master and on the other lists). */
export async function removeFromList(channel: AppChannel, uid: string, who: string): Promise<Result> {
  const before = await one(`delete from app_product where channel = $1 and product_uid = $2 returning *`, [channel, uid]);
  if (!before) return { ok: false, error: "That product is not on this list." };
  await audit(who, channel, uid, "delete", `${label(channel)}: product removed from the list`, before);
  return OK;
}

/** The MRP (Product Master): the one price - the D2C app sells at it and every app shows it. */
export async function setPrices(uid: string, patch: { mrp: number }, who: string): Promise<Result> {
  const p = await one<{ sku: string; mrp: number }>(`select sku_code as sku, mrp::float as mrp from fp_product where uid = $1`, [uid]);
  if (!p) return { ok: false, error: "That product no longer exists." };
  if (!Number.isFinite(patch.mrp) || patch.mrp <= 0 || patch.mrp > 1e6) return { ok: false, error: "Enter a valid MRP." };
  await query(`update fp_product set mrp = $2, updated_at = now() where uid = $1`, [uid, patch.mrp]);
  await query(`insert into master_audit (actor, slug, record_id, action, summary, before, after) values ($1, 'fpproducts', $2, 'update', $3, $4, $5)`, [
    who, uid, `Price changed (${p.sku})`, JSON.stringify({ mrp: p.mrp }), JSON.stringify(patch),
  ]);
  return OK;
}

// ---------------------------------------------------------------- photos

export const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const PHOTO_MAX = 4 * 1024 * 1024;

async function photoOwner(): Promise<string | null> {
  return (await one<{ uid: string }>(`select uid from fp_staff order by (lower(email) = 'admin@vamaadairy.com') desc, active desc, created_at limit 1`))?.uid ?? null;
}

/** Adds a photo to a product (Product Master, so every app). `first` makes it the photo the apps show. */
export async function addPhoto(uid: string, bytes: Buffer, mime: string, first: boolean, who: string): Promise<Result> {
  if (!PHOTO_TYPES.has(mime)) return { ok: false, error: "The photo must be a JPG, PNG or WebP image." };
  if (bytes.length > PHOTO_MAX) return { ok: false, error: "The photo must be under 4 MB." };
  const owner = await photoOwner();
  if (!owner) return { ok: false, error: "No employee to file the photo under - add one in Employee Profile first." };
  if (!(await one(`select 1 from fp_product where uid = $1`, [uid]))) return { ok: false, error: "That product no longer exists." };
  await tx(async (c) => {
    if (first) await c.query(`update fp_product_image set imagesno = coalesce(imagesno, 0) + 1, updated_at = now() where product_uid = $1 and archived_at is null`, [uid]);
    const n = first ? 1 : (await c.query<{ n: number }>(`select coalesce(max(imagesno), 0) + 1 as n from fp_product_image where product_uid = $1 and archived_at is null`, [uid])).rows[0].n;
    const id = randomUUID();
    await c.query(
      `insert into fp_product_image (uid, image_url, data, mime, source_url, imagesno, product_uid, staff_uid)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, `/api/shop/product-image/${id}`, bytes, mime, `Product Master upload by ${who}`, n, uid, owner],
    );
  });
  await query(`insert into master_audit (actor, slug, record_id, action, summary) values ($1, 'fpproducts', $2, 'update', 'Photo added')`, [who, uid]);
  return OK;
}

/** The photos of a product, first one = what the apps show. */
export async function photosOf(uid: string) {
  return query<{ uid: string; url: string }>(
    `select i.uid, ${photo()} as url from fp_product_image i where i.product_uid = $1 and i.archived_at is null order by i.imagesno nulls last, i.created_at`,
    [uid],
  );
}

/** The product's archived photos (no app shows them), most recently archived first. */
export async function archivedPhotosOf(uid: string) {
  return query<{ uid: string; url: string }>(
    `select i.uid, ${photo()} as url from fp_product_image i where i.product_uid = $1 and i.archived_at is not null order by i.archived_at desc, i.imagesno`,
    [uid],
  );
}

/** Takes a photo out of the apps without deleting it; it waits in the product's Archive. */
export async function archivePhoto(productUid: string, photoUid: string, who: string): Promise<Result> {
  const r = await one(`update fp_product_image set archived_at = now(), updated_at = now() where uid = $1 and product_uid = $2 and archived_at is null returning uid`, [photoUid, productUid]);
  if (!r) return { ok: false, error: "That photo is not on the product any more." };
  await query(`insert into master_audit (actor, slug, record_id, action, summary) values ($1, 'fpproducts', $2, 'update', 'Photo archived')`, [who, productUid]);
  return OK;
}

/** Puts an archived photo back on the product, after its other photos. */
export async function restorePhoto(productUid: string, photoUid: string, who: string): Promise<Result> {
  const r = await one(
    `update fp_product_image set archived_at = null, updated_at = now(),
            imagesno = (select coalesce(max(imagesno), 0) + 1 from fp_product_image where product_uid = $2 and archived_at is null)
      where uid = $1 and product_uid = $2 and archived_at is not null returning uid`,
    [photoUid, productUid],
  );
  if (!r) return { ok: false, error: "That photo is not in the archive any more." };
  await query(`insert into master_audit (actor, slug, record_id, action, summary) values ($1, 'fpproducts', $2, 'update', 'Photo restored from archive')`, [who, productUid]);
  return OK;
}

export async function removePhoto(productUid: string, photoUid: string, who: string): Promise<Result> {
  const r = await one(`delete from fp_product_image where uid = $1 and product_uid = $2 returning uid`, [photoUid, productUid]);
  if (!r) return { ok: false, error: "That photo is already gone." };
  await query(`insert into master_audit (actor, slug, record_id, action, summary) values ($1, 'fpproducts', $2, 'update', 'Photo removed')`, [who, productUid]);
  return OK;
}

/** Makes this photo the one the apps show first. */
export async function makeFirstPhoto(productUid: string, photoUid: string, who: string): Promise<Result> {
  const all = await photosOf(productUid);
  if (!all.some((p) => p.uid === photoUid)) return { ok: false, error: "That photo is already gone." };
  const order = [photoUid, ...all.map((p) => p.uid).filter((u) => u !== photoUid)];
  await query(
    `update fp_product_image i set imagesno = o.n, updated_at = now() from unnest($1::uuid[]) with ordinality o(uid, n) where i.uid = o.uid`,
    [order],
  );
  await query(`insert into master_audit (actor, slug, record_id, action, summary) values ($1, 'fpproducts', $2, 'update', 'Main photo changed')`, [who, productUid]);
  return OK;
}

// ---------------------------------------------------------------- a brand-new product

export interface NewProduct {
  sku: string;
  name: string;
  size: string;
  category: string;
  mrp: number;
  /** distributor price (DP) for the Product Master; 0 when not known yet */
  dp: number;
}

/**
 * Creates a product in the company Product Master and puts it on the chosen app lists. The fields the
 * Product Master needs that the form does not ask (brand, tax, unit ...) are copied from a product of the
 * same category, else from the most recently made product.
 */
export async function createProduct(input: NewProduct, channels: AppChannel[], who: string): Promise<{ ok: true; uid: string } | { ok: false; error: string }> {
  const sku = input.sku.trim().toUpperCase();
  const name = input.name.trim().replace(/\s+/g, " ");
  const size = input.size.trim().replace(/\s+/g, " ");
  const category = cleanCategory(input.category);
  if (!/^[A-Z0-9][A-Z0-9_\-/.]{1,29}$/.test(sku)) return { ok: false, error: "Give a SKU code (letters and numbers, up to 30)." };
  if (name.length < 3) return { ok: false, error: "Give the product a name." };
  if (category.length < 2) return { ok: false, error: "Choose a category." };
  if (!Number.isFinite(input.mrp) || input.mrp <= 0) return { ok: false, error: "Enter the MRP." };
  if (!Number.isFinite(input.dp) || input.dp < 0) return { ok: false, error: "Enter a valid DP (or 0)." };
  if (await one(`select 1 from fp_product where upper(sku_code) = $1`, [sku])) return { ok: false, error: `SKU ${sku} already exists.` };

  const template = await one<Record<string, unknown>>(
    `select * from fp_product order by (lower(trim(category)) = lower($1)) desc, (active = 1) desc, created_at desc limit 1`,
    [category],
  );
  if (!template) return { ok: false, error: "The Product Master is empty - import the products first." };

  // jsonb columns: sent as JSON text (pg would turn a JS array into a Postgres array)
  const json = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v));
  const uid = await tx(async (c) => {
    const r = await c.query<{ uid: string }>(
      `insert into fp_product (model_number, brand, super_brand, category, sub_category, model_name, sku_code, sku_name, sku_size, mrp, dp,
                               variant, active, tax_configuration_uid, primary_unit, secondary_units, division, position)
       values ($1, $2, $3, $4, $4, $5, $1, $5, $6, $7, $8, $9, 1, $10, $11, $12, $13,
               (select coalesce(max(position), 0) + 1 from fp_product))
       returning uid`,
      [
        sku, template.brand, template.super_brand, category, size ? `${name} ${size}` : name, size || null, input.mrp, input.dp,
        size || String(template.variant ?? "-"), template.tax_configuration_uid, json(template.primary_unit), json(template.secondary_units), json(template.division),
      ],
    );
    const id = r.rows[0].uid;
    for (const ch of channels) {
      await c.query(
        `insert into app_product (channel, product_uid, name, size, category, visible, sort)
         values ($1, $2, $3, $4, $5, true, coalesce((select max(sort) from app_product where channel = $1), 0) + 10)
         on conflict do nothing`,
        [ch, id, name, size || null, category],
      );
      await c.query(
        `insert into app_category (channel, name, sort)
         select $1, $2, coalesce(max(sort), 0) + 10 from app_category where channel = $1
         on conflict (channel, name) do nothing`,
        [ch, category],
      );
    }
    await c.query(`insert into master_audit (actor, slug, record_id, action, summary, after) values ($1, 'fpproducts', $2, 'create', $3, $4)`, [
      who, id, `New product ${sku} ${name}`, JSON.stringify({ ...input, channels }),
    ]);
    return id;
  });
  return { ok: true, uid };
}

// ---------------------------------------------------------------- category icons and descriptions

/**
 * The link of each category's own icon on this list (versioned, so a new upload is not served from cache). The name goes
 * in the query string: IIS in front of the app rejects an encoded `&` in a path ("Lassi & Chass" -> 400).
 */
export async function categoryIcons(channel: AppChannel): Promise<Map<string, string>> {
  const rows = await query<{ name: string; v: string }>(
    `select name, extract(epoch from updated_at)::bigint::text as v from app_category where channel = $1 and icon_data is not null`,
    [channel],
  );
  return new Map(rows.map((r) => [r.name, `${PUBLIC_URL}/api/shop/category-icon/${channel}?c=${encodeURIComponent(r.name)}&v=${r.v}`]));
}

export async function categoryIcon(channel: string, name: string): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!isAppChannel(channel)) return null;
  const r = await one<{ data: Buffer; mime: string | null }>(
    `select icon_data as data, icon_mime as mime from app_category where channel = $1 and name = $2 and icon_data is not null`,
    [channel, name],
  );
  return r ? { bytes: r.data, mime: r.mime ?? "image/png" } : null;
}

/** Sets (bytes) or removes (null) a category's icon on this list. */
export async function setCategoryIcon(channel: AppChannel, name: string, icon: { bytes: Buffer; mime: string } | null, who: string): Promise<Result> {
  if (icon) {
    if (!PHOTO_TYPES.has(icon.mime)) return { ok: false, error: "The icon must be a JPG, PNG or WebP image." };
    if (icon.bytes.length > PHOTO_MAX) return { ok: false, error: "The icon must be under 4 MB." };
  }
  const { categories } = await appList(channel);
  if (!categories.includes(name)) return { ok: false, error: "That category is not on this list." };
  // a category used by products but never ordered has no row yet: give it one at the end
  await query(
    `insert into app_category (channel, name, sort, icon_data, icon_mime, updated_at)
     values ($1, $2, coalesce((select max(sort) from app_category where channel = $1), 0) + 10, $3, $4, now())
     on conflict (channel, name) do update set icon_data = excluded.icon_data, icon_mime = excluded.icon_mime, updated_at = now()`,
    [channel, name, icon?.bytes ?? null, icon?.mime ?? null],
  );
  await audit(who, channel, name, "update", `${label(channel)}: category ${name} icon ${icon ? "changed" : "removed"}`);
  return OK;
}

/** The product's description (Product Master, so every app shows the same text); empty = none. */
export async function setDescription(uid: string, text: string, who: string): Promise<Result> {
  const d = text.replace(/\r\n/g, "\n").trim().slice(0, 2000) || null;
  const r = await one<{ before: string | null }>(
    `update fp_product p set description = $2 from (select description as before from fp_product where uid = $1) o where p.uid = $1 returning o.before`,
    [uid, d],
  );
  if (!r) return { ok: false, error: "That product no longer exists." };
  if ((r.before ?? null) !== d) {
    await query(`insert into master_audit (actor, slug, record_id, action, summary) values ($1, 'fpproducts', $2, 'update', 'Description changed')`, [who, uid]);
  }
  return OK;
}
