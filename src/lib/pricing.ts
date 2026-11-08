import "server-only";
import { one, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { skuNo } from "@/lib/products/names";
import { firmPrices, type FirmPrice } from "@/lib/distributor";
import { allListPrices, channelRates, channels, priceLists, standardPrices, type PriceRow } from "@/lib/price-list";

/**
 * The Pricing section's views on top of the price data in lib/price-list:
 *  - packaging cost per piece of each SKU (from the plant's packing list for that SKU, at the packing-material rates),
 *  - one SKU's price card (every price it has, its packaging, its history),
 *  - customers with the price list they are on, and one customer's full price sheet.
 */

// ---------------------------------------------------------------- packaging cost per SKU

export interface PackLine {
  name: string;
  /** per piece, or per full case (then shared over the pieces in it) */
  qty: number;
  unit: "kg" | "pcs";
  per: "pc" | "case";
  /** ₹ per kg / per piece of the material (incl. GST and freight), null = no rate set */
  rate: number | null;
  /** ₹ this line adds to one piece */
  perPc: number;
}

export interface PackCost {
  /** the plant's SKU it comes from */
  skuCode: string;
  skuName: string;
  pcsPerCase: number;
  /** ₹ per piece; null when the SKU has no packing list and no flat rate */
  perPc: number | null;
  /** costed at a flat rate per piece instead of a list */
  flat: boolean;
  lines: PackLine[];
  /** a line has no rate, so the total is short */
  missingRate: boolean;
}

/** Packaging cost per piece for every plant SKU, by SKU number (digits of the code, as the product names match). */
export async function packCosts(): Promise<Map<number, PackCost>> {
  const scenario = await activeScenarioId();
  const [skus, lines] = await Promise.all([
    query<{ id: string; code: string; name: string; pcs_per_case: number; pack_rate_per_pc: number | null }>(
      `select id, code, name, pcs_per_case, pack_rate_per_pc::float8 as pack_rate_per_pc from sku where scenario_id = $1 order by is_active desc, sort_order`,
      [scenario],
    ),
    query<{ sku_id: string; name: string; unit: "kg" | "pcs"; qty: number; per: "pc" | "case"; rate: number | null }>(
      `select i.sku_id, o.name,
              case when coalesce(u.value_text, u.computed_text) = 'kg' then 'kg' else 'pcs' end as unit,
              i.qty::float8 as qty, i.per, r.value_num::float8 as rate
         from sku_packing_item i
         join sku s on s.id = i.sku_id and s.scenario_id = $1
         join cost_object o on o.id = i.packaging_id
         left join field_def fu on fu.class_id = o.class_id and fu.key = 'unit'
         left join field_value u on u.object_id = o.id and u.field_def_id = fu.id
         left join field_def fr on fr.class_id = o.class_id and fr.key = 'rate'
         left join field_value r on r.object_id = o.id and r.field_def_id = fr.id
        order by i.sku_id, i.sort_order`,
      [scenario],
    ),
  ]);
  const bySku = new Map<string, typeof lines>();
  for (const l of lines) bySku.set(l.sku_id, [...(bySku.get(l.sku_id) ?? []), l]);

  const out = new Map<number, PackCost>();
  for (const s of skus) {
    const no = skuNo(s.code);
    if (no === null || out.has(no)) continue; // first (active) one wins
    const perCase = Math.max(1, Number(s.pcs_per_case) || 1);
    const list: PackLine[] = (bySku.get(s.id) ?? []).map((l) => {
      const qty = Number(l.qty);
      const rate = l.rate === null ? null : Number(l.rate);
      return { name: l.name, qty, unit: l.unit, per: l.per, rate, perPc: rate === null ? 0 : (qty * rate) / (l.per === "case" ? perCase : 1) };
    });
    const flat = s.pack_rate_per_pc !== null;
    const perPc = flat ? Number(s.pack_rate_per_pc) : list.length ? list.reduce((a, l) => a + l.perPc, 0) : null;
    out.set(no, {
      skuCode: s.code, skuName: s.name, pcsPerCase: perCase, perPc: perPc === null ? null : round(perPc, 4), flat, lines: list,
      missingRate: !flat && list.some((l) => l.rate === null),
    });
  }
  return out;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** A product's packaging cost, matched on its SKU number. */
export const packFor = (costs: Map<number, PackCost>, sku: string) => {
  const no = skuNo(sku);
  return no === null ? null : costs.get(no) ?? null;
};

/** Margin a buyer keeps between what they pay and the MRP, as a % of MRP. */
export const marginPct = (price: number | null | undefined, mrp: number) => (price && mrp > 0 ? round(((mrp - price) / mrp) * 100, 1) : null);

// ---------------------------------------------------------------- one SKU's price card

export interface SkuCard {
  product: PriceRow;
  pack: PackCost | null;
  channels: Array<{ uid: string; name: string; code: string; price: number | null }>;
  lists: Array<{ uid: string; name: string; grp: string | null; customers: number; price: number | null }>;
  history: Array<{ at: Date; actor: string; summary: string }>;
}

export async function skuCard(uid: string): Promise<SkuCard | null> {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return null;
  const [products, chans, rates, lists, listPrices, costs] = await Promise.all([
    standardPrices(), channels(), channelRates(), priceLists(), allListPrices(), packCosts(),
  ]);
  const product = products.find((p) => p.uid === uid);
  if (!product) return null;
  const masterName = (await one<{ name: string }>(`select sku_name as name from fp_product where uid = $1`, [uid]))?.name ?? product.name;
  const history = await query<{ at: Date; actor: string; summary: string }>(
    `select at, actor, summary from master_audit
      where (record_id = $1 and slug in ('priceList', 'fpproducts'))
         or (slug = 'priceList' and summary like $2)
      order by at desc limit 40`,
    [uid, `%: ${masterName} %`],
  ).catch(() => []);
  const pr = rates.get(uid);
  const lp = listPrices.get(uid);
  return {
    product,
    pack: packFor(costs, product.sku),
    channels: chans.map((c) => ({ ...c, price: pr?.get(c.uid) ?? null })),
    lists: lists.map((l) => ({ uid: l.uid, name: l.name, grp: l.grp, customers: l.customers, price: lp?.get(l.uid) ?? null })),
    history,
  };
}

// ---------------------------------------------------------------- customers and what they pay

export interface PricedCustomer {
  uid: string;
  code: string;
  name: string;
  channel: string | null;
  channelCode: string | null;
  city: string | null;
  active: boolean;
  listUid: string | null;
  list: string | null;
  /** products their list prices (0 = pays channel prices) */
  listPriced: number;
}

/** Trade customers (every channel below the company: distributors, retailers, super stockists ...) with their price list. */
export async function pricedCustomers(f: { q?: string; channel?: string; list?: string }): Promise<PricedCustomer[]> {
  const q = f.q?.trim() ?? "";
  return query<PricedCustomer>(
    `select x.uid, x.firm_code as code, x.name, ch.channel, upper(ch.channel_code) as "channelCode", x.city, x.active = 1 as active,
            sl.uid as "listUid", sl.name as list,
            coalesce((select count(*)::int from fp_slab_rate r where r.slab_uid = sl.uid and coalesce(r.active, 1) = 1 and r.dp > 0), 0) as "listPriced"
       from fp_firm x
       join fp_channel ch on ch.uid = x.channel_uid and ch.level > 1
       left join lateral (
         select s.uid, s.name from fp_slab_firm_mapping m join fp_slab s on s.uid = m.slab_uid and coalesce(s.active, 1) = 1
          where m.firm_uid = x.uid limit 1) sl on true
      where ($1 = '' or x.name ilike '%' || $1 || '%' or x.firm_code ilike $1 || '%' or coalesce(x.city, '') ilike '%' || $1 || '%')
        and ($2 = '' or upper(ch.channel_code) = upper($2))
        and ($3 = '' or ($3 = 'none' and sl.uid is null) or sl.uid::text = $3)
      order by (x.active = 1) desc, x.name
      limit 1000`,
    [q, f.channel ?? "", f.list ?? ""],
  );
}

export interface CustomerSheetRow {
  product: PriceRow;
  pays: FirmPrice | null;
  /** what the customer's channel would charge without a list */
  channelPrice: number | null;
  pack: number | null;
}

export interface CustomerSheet {
  customer: PricedCustomer & { phone: string | null; servedBy: string | null };
  rows: CustomerSheetRow[];
}

/** Every product with exactly what the Gaia app charges this customer - the same code its orders use. */
export async function customerSheet(uid: string): Promise<CustomerSheet | null> {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return null;
  const customer = await one<CustomerSheet["customer"]>(
    `select x.uid, x.firm_code as code, x.name, ch.channel, upper(ch.channel_code) as "channelCode", x.city, x.active = 1 as active,
            x.phone, p.name as "servedBy", sl.uid as "listUid", sl.name as list,
            coalesce((select count(*)::int from fp_slab_rate r where r.slab_uid = sl.uid and coalesce(r.active, 1) = 1 and r.dp > 0), 0) as "listPriced"
       from fp_firm x
       left join fp_channel ch on ch.uid = x.channel_uid
       left join fp_firm p on p.uid = x.parent_firm_uid
       left join lateral (
         select s.uid, s.name from fp_slab_firm_mapping m join fp_slab s on s.uid = m.slab_uid and coalesce(s.active, 1) = 1
          where m.firm_uid = x.uid limit 1) sl on true
      where x.uid = $1`,
    [uid],
  );
  if (!customer) return null;
  const [products, pays, rates, chan, costs] = await Promise.all([
    standardPrices(),
    firmPrices(uid),
    channelRates(),
    one<{ uid: string }>(`select channel_uid as uid from fp_firm where uid = $1`, [uid]),
    packCosts(),
  ]);
  const bySku = new Map(pays.map((p) => [p.sku, p]));
  return {
    customer,
    rows: products.filter((p) => p.inApp).map((p) => ({
      product: p,
      pays: bySku.get(p.sku) ?? null,
      channelPrice: chan?.uid ? rates.get(p.uid)?.get(chan.uid) ?? null : null,
      pack: packFor(costs, p.sku)?.perPc ?? null,
    })),
  };
}
