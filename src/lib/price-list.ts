import "server-only";
import { one, query, tx } from "@/lib/db";
import { displayName } from "@/lib/shop/pricing";
import { firmPrices, type FirmPrice } from "@/lib/distributor";

/**
 * Prices by customer, as the Price list page shows and edits them:
 *  - standard: MRP (fp_product.mrp) and the retailer / distributor channel rates (fp_channel_rate, channel RT / DB),
 *  - party price lists: the portal's price slabs (fp_slab, fp_slab_rate) and the customers on each (fp_slab_firm_mapping).
 * The Gaia app prices a customer the same way (lib/distributor dealerPrices): its list, else its channel, else the product's DP.
 */

export type Channel = "RT" | "DB";
export const CHANNEL_LABEL: Record<Channel, string> = { RT: "Retailer", DB: "Distributor" };

export interface PriceRow {
  uid: string;
  sku: string;
  /** The Product Master name, tidied exactly as the Gaia app shows it. */
  name: string;
  category: string;
  mrp: number;
  rt: number | null;
  db: number | null;
  /** Has an MRP, so distributors and retailers see it in the Gaia app (where they have a price). */
  inApp: boolean;
  /** Also in the customer (D2C) shop - hidden ones are for distributors and retailers only. */
  inShop: boolean;
}

const latestRate = (code: Channel) => `(
  select r.dealer_price from fp_channel_rate r join fp_channel c on c.uid = r.channel_uid
  where r.product_uid = p.uid and upper(c.channel_code) = '${code}' and r.state_state is null
  order by r.updated_at desc limit 1)`;

/** Every active product with its MRP and standard retailer / distributor prices. */
export async function standardPrices(): Promise<PriceRow[]> {
  const rows = await query<PriceRow>(
    `select p.uid, p.sku_code as sku, p.sku_name as name, coalesce(nullif(trim(p.category), ''), 'Other') as category, p.mrp::float as mrp,
            ${latestRate("RT")}::float as rt, ${latestRate("DB")}::float as db,
            p.mrp > 0 as "inApp", (p.mrp > 0 and coalesce(si.visible, true)) as "inShop"
     from fp_product p left join shop_item si on si.sku_code = p.sku_code
     where p.active = 1
     order by category, p.sku_name`,
  );
  return rows.map((r) => ({ ...r, name: displayName(r.name) }));
}

// ---------------------------------------------------------------- overview (every price on one screen)

export interface ChannelCol {
  uid: string;
  name: string;
  code: string;
}

/** The customer channels (Distributor, Retailer, Super Stockist, MFS, Institution ...), the company itself left out. */
export const channels = () =>
  query<ChannelCol>(
    `select uid, channel as name, upper(channel_code) as code from fp_channel
     where level > 1 order by level, channel`,
  );

/** product uid -> channel uid -> that channel's all-states rate. */
export async function channelRates(): Promise<Map<string, Map<string, number>>> {
  const rows = await query<{ product: string; channel: string; price: number }>(
    `select distinct on (product_uid, channel_uid) product_uid as product, channel_uid as channel, dealer_price::float as price
     from fp_channel_rate where state_state is null and dealer_price > 0 and product_uid is not null and channel_uid is not null
     order by product_uid, channel_uid, updated_at desc`,
  );
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) out.set(r.product, (out.get(r.product) ?? new Map()).set(r.channel, r.price));
  return out;
}

/** product uid -> list uid -> that list's price. */
export async function allListPrices(): Promise<Map<string, Map<string, number>>> {
  const rows = await query<{ product: string; list: string; price: number }>(
    `select distinct on (sr.product_uid, sr.slab_uid) sr.product_uid as product, sr.slab_uid as list, sr.dp::float as price
     from fp_slab_rate sr join fp_slab sl on sl.uid = sr.slab_uid and coalesce(sl.active, 1) = 1
     where coalesce(sr.active, 1) = 1 and sr.dp > 0
     order by sr.product_uid, sr.slab_uid, sr.updated_at desc`,
  );
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) out.set(r.product, (out.get(r.product) ?? new Map()).set(r.list, r.price));
  return out;
}

export interface CustomerCheck {
  uid: string;
  code: string;
  name: string;
  channel: string | null;
  city: string | null;
  list: string | null;
  /** sku -> what the Gaia app charges this customer, and why. */
  prices: Map<string, FirmPrice>;
}

/** Exactly what the Gaia app shows one customer - the same code the app and its orders use. */
export async function customerCheck(firmUid: string): Promise<CustomerCheck | null> {
  if (!/^[0-9a-f-]{36}$/i.test(firmUid)) return null;
  const f = await one<Omit<CustomerCheck, "prices">>(
    `select f.uid, f.firm_code as code, f.name, ch.channel, f.city,
            (select sl.name from fp_slab_firm_mapping m join fp_slab sl on sl.uid = m.slab_uid and coalesce(sl.active, 1) = 1 where m.firm_uid = f.uid limit 1) as list
     from fp_firm f left join fp_channel ch on ch.uid = f.channel_uid where f.uid = $1`,
    [firmUid],
  );
  if (!f) return null;
  return { ...f, prices: new Map((await firmPrices(firmUid)).map((r) => [r.sku, r])) };
}

export interface PriceList {
  uid: string;
  name: string;
  grp: string | null;
  customers: number;
  priced: number;
}

export const priceLists = () =>
  query<PriceList>(
    `select sl.uid, sl.name, sl.grp,
            (select count(*)::int from fp_slab_firm_mapping m where m.slab_uid = sl.uid) as customers,
            (select count(*)::int from fp_slab_rate r where r.slab_uid = sl.uid and coalesce(r.active, 1) = 1) as priced
     from fp_slab sl where coalesce(sl.active, 1) = 1
     order by sl.grp nulls last, sl.name`,
  );

export const priceList = (uid: string) =>
  /^[0-9a-f-]{36}$/i.test(uid) ? one<PriceList>(`select sl.uid, sl.name, sl.grp, 0 as customers, 0 as priced from fp_slab sl where sl.uid = $1`, [uid]) : Promise.resolve(null);

/** product uid -> this list's price. */
export async function listPrices(slabUid: string): Promise<Map<string, number>> {
  const rows = await query<{ product: string; dp: number }>(
    `select distinct on (product_uid) product_uid as product, dp::float as dp from fp_slab_rate
     where slab_uid = $1 and coalesce(active, 1) = 1 order by product_uid, updated_at desc`,
    [slabUid],
  );
  return new Map(rows.map((r) => [r.product, r.dp]));
}

export interface ListCustomer {
  uid: string;
  code: string;
  name: string;
  city: string | null;
  channel: string | null;
  active: boolean;
}

export const listCustomers = (slabUid: string) =>
  query<ListCustomer>(
    `select f.uid, f.firm_code as code, f.name, f.city, ch.channel, f.active = 1 as active
     from fp_slab_firm_mapping m join fp_firm f on f.uid = m.firm_uid left join fp_channel ch on ch.uid = f.channel_uid
     where m.slab_uid = $1 order by f.name`,
    [slabUid],
  );

/** Customers matching a code or name, with the list each is on now - for adding customers to a list. */
export const findCustomers = (q: string) =>
  query<ListCustomer & { list: string | null }>(
    `select f.uid, f.firm_code as code, f.name, f.city, ch.channel, f.active = 1 as active,
            (select sl.name from fp_slab_firm_mapping m join fp_slab sl on sl.uid = m.slab_uid where m.firm_uid = f.uid limit 1) as list
     from fp_firm f left join fp_channel ch on ch.uid = f.channel_uid
     where f.firm_code ilike $1 or f.name ilike $2
     order by (f.firm_code ilike $1) desc, f.active desc, f.name limit 12`,
    [`${q.trim()}%`, `%${q.trim()}%`],
  );

// ---------------------------------------------------------------- changes (each one in the change log)

const staffOwner = async (c: { query: (s: string) => Promise<{ rows: Array<{ uid: string }> }> }) =>
  (await c.query(`select uid from fp_staff order by (lower(email) = 'admin@vamaadairy.com') desc, active desc, created_at limit 1`)).rows[0]?.uid;

const audit = (c: { query: (s: string, p: unknown[]) => Promise<unknown> }, who: string, record: string, summary: string, before: unknown, after: unknown) =>
  c.query(`insert into master_audit (actor, slug, record_id, action, summary, before, after) values ($1, 'priceList', $2, 'update', $3, $4, $5)`, [
    who, record, summary, JSON.stringify(before), JSON.stringify(after),
  ]);

export type Target = { kind: "mrp" } | { kind: "channel"; channel: Channel } | { kind: "list"; list: string };

/** Sets one price. A list price of null takes the product off that list (the customer then pays its channel price). */
export async function setPrice(target: Target, productUid: string, value: number | null, who: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(productUid)) return { ok: false, error: "Unknown product." };
  if (value !== null && !(Number.isFinite(value) && value > 0 && value < 1e7)) return { ok: false, error: "Enter a price above zero." };
  const v = value === null ? null : Math.round(value * 100) / 100;
  return tx(async (c) => {
    const p = (await c.query<{ sku: string; name: string; mrp: number }>(`select sku_code as sku, sku_name as name, mrp from fp_product where uid = $1`, [productUid])).rows[0];
    if (!p) return { ok: false as const, error: "Unknown product." };

    if (target.kind === "mrp") {
      if (v === null) return { ok: false as const, error: "A product needs an MRP." };
      await c.query(`update fp_product set mrp = $2, updated_at = now() where uid = $1`, [productUid, v]);
      await audit(c, who, productUid, `MRP of ${p.name}: ${p.mrp} -> ${v}`, { mrp: p.mrp }, { mrp: v });
      return { ok: true as const };
    }

    if (target.kind === "channel") {
      if (v === null) return { ok: false as const, error: `Enter the ${CHANNEL_LABEL[target.channel].toLowerCase()} price.` };
      const chans = (await c.query<{ uid: string }>(`select uid from fp_channel where upper(channel_code) = $1`, [target.channel])).rows;
      if (!chans.length) return { ok: false as const, error: `There is no ${CHANNEL_LABEL[target.channel].toLowerCase()} channel.` };
      for (const ch of chans) {
        const cur = (await c.query<{ uid: string; dealer_price: number }>(
          `select uid, dealer_price from fp_channel_rate where channel_uid = $1 and product_uid = $2 and state_state is null order by updated_at desc limit 1`,
          [ch.uid, productUid],
        )).rows[0];
        if (cur) await c.query(`update fp_channel_rate set dealer_price = $2, selling_price = $3, updated_at = now() where uid = $1`, [cur.uid, v, p.mrp]);
        else
          await c.query(
            `insert into fp_channel_rate (channel_uid, product_uid, sku_code, dealer_price, selling_price, from_date) values ($1, $2, $3, $4, $5, to_char(now(), 'YYYY-MM-DD'))`,
            [ch.uid, productUid, p.sku, v, p.mrp],
          );
      }
      await audit(c, who, productUid, `${CHANNEL_LABEL[target.channel]} price of ${p.name} -> ${v}`, null, { [target.channel]: v });
      return { ok: true as const };
    }

    const list = (await c.query<{ name: string }>(`select name from fp_slab where uid = $1`, [target.list])).rows[0];
    if (!list) return { ok: false as const, error: "That price list no longer exists." };
    const cur = (await c.query<{ uid: string; dp: number }>(
      `select uid, dp from fp_slab_rate where slab_uid = $1 and product_uid = $2 order by updated_at desc limit 1`,
      [target.list, productUid],
    )).rows[0];
    if (v === null) {
      if (cur) await c.query(`update fp_slab_rate set active = 0, updated_at = now() where slab_uid = $1 and product_uid = $2`, [target.list, productUid]);
    } else if (cur) {
      await c.query(`update fp_slab_rate set dp = $2, sp = $3, active = 1, updated_at = now() where uid = $1`, [cur.uid, v, p.mrp]);
    } else {
      await c.query(
        `insert into fp_slab_rate (slab_uid, product_uid, dp, sp, max_allowed_discount, active, from_date) values ($1, $2, $3, $4, 0, 1, now())`,
        [target.list, productUid, v, p.mrp],
      );
    }
    await audit(c, who, target.list, `${list.name}: ${p.name} ${v === null ? "removed" : `-> ${v}`}`, cur ? { dp: cur.dp } : null, { dp: v });
    return { ok: true as const };
  });
}

export async function createList(name: string, grp: string, who: string): Promise<{ ok: true; uid: string } | { ok: false; error: string }> {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 2) return { ok: false, error: "Give the price list a name." };
  return tx(async (c) => {
    if ((await c.query(`select 1 from fp_slab where lower(name) = lower($1) and coalesce(active, 1) = 1`, [n])).rowCount) return { ok: false as const, error: "A price list with this name already exists." };
    const owner = await staffOwner(c);
    if (!owner) return { ok: false as const, error: "There are no employees yet to own a price list." };
    const uid = (await c.query<{ uid: string }>(
      `insert into fp_slab (name, active, grp, created_staff_uid, updated_staff_uid) values ($1, 1, $2, $3, $3) returning uid`,
      [n, grp.trim() || null, owner],
    )).rows[0].uid;
    await audit(c, who, uid, `New price list ${n}`, null, { name: n, grp });
    return { ok: true as const, uid };
  });
}

export async function updateList(uid: string, patch: { name?: string; grp?: string; active?: boolean }, who: string): Promise<{ ok: boolean; error?: string }> {
  return tx(async (c) => {
    const cur = (await c.query<{ name: string }>(`select name from fp_slab where uid = $1`, [uid])).rows[0];
    if (!cur) return { ok: false, error: "That price list no longer exists." };
    if (patch.name !== undefined) {
      const n = patch.name.trim().replace(/\s+/g, " ");
      if (n.length < 2) return { ok: false, error: "Give the price list a name." };
      await c.query(`update fp_slab set name = $2, updated_at = now() where uid = $1`, [uid, n]);
    }
    if (patch.grp !== undefined) await c.query(`update fp_slab set grp = $2, updated_at = now() where uid = $1`, [uid, patch.grp.trim() || null]);
    if (patch.active === false) {
      // switched off: its customers go back to their channel price
      await c.query(`update fp_slab set active = 0, updated_at = now() where uid = $1`, [uid]);
      await c.query(`delete from fp_slab_firm_mapping where slab_uid = $1`, [uid]);
    }
    await audit(c, who, uid, patch.active === false ? `Removed price list ${cur.name}` : `Edited price list ${cur.name}`, { name: cur.name }, patch);
    return { ok: true };
  });
}

/** Puts a customer on a list. A customer is on one list at a time, so it leaves any other. */
export async function addCustomer(listUid: string, firmUid: string, who: string): Promise<{ ok: true; moved: string | null } | { ok: false; error: string }> {
  return tx(async (c) => {
    const list = (await c.query<{ name: string }>(`select name from fp_slab where uid = $1 and coalesce(active, 1) = 1`, [listUid])).rows[0];
    const firm = (await c.query<{ name: string; code: string }>(`select name, firm_code as code from fp_firm where uid = $1`, [firmUid])).rows[0];
    if (!list || !firm) return { ok: false as const, error: "That price list or customer no longer exists." };
    const was = (await c.query<{ name: string }>(
      `select sl.name from fp_slab_firm_mapping m join fp_slab sl on sl.uid = m.slab_uid where m.firm_uid = $1 and m.slab_uid <> $2 limit 1`,
      [firmUid, listUid],
    )).rows[0]?.name ?? null;
    const owner = await staffOwner(c);
    if (!owner) return { ok: false as const, error: "There are no employees yet." };
    await c.query(`delete from fp_slab_firm_mapping where firm_uid = $1 and slab_uid <> $2`, [firmUid, listUid]);
    await c.query(
      `insert into fp_slab_firm_mapping (firm_uid, slab_uid, assigned_staff_uid)
       select $1, $2, $3 where not exists (select 1 from fp_slab_firm_mapping where firm_uid = $1 and slab_uid = $2)`,
      [firmUid, listUid, owner],
    );
    await audit(c, who, listUid, `${firm.code} ${firm.name} put on ${list.name}${was ? ` (was ${was})` : ""}`, { list: was }, { list: list.name });
    return { ok: true as const, moved: was };
  });
}

export async function removeCustomer(listUid: string, firmUid: string, who: string): Promise<{ ok: boolean }> {
  return tx(async (c) => {
    const r = await c.query(`delete from fp_slab_firm_mapping where slab_uid = $1 and firm_uid = $2`, [listUid, firmUid]);
    if (r.rowCount) await audit(c, who, listUid, `Customer ${firmUid} taken off the list`, null, null);
    return { ok: true };
  });
}
