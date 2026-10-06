import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { batchComplete } from "@/lib/production/complete";

/*
 * Actual costing, from what really happened each day:
 *
 *   batch  = milk drawn from the tanks (at the tanks' blended ₹/L)
 *          + ingredients (quantity x the ingredient master rate)
 *          + its share of the day's shared costs, head by head: each overhead
 *            head except delivery fuel (electricity, labour, coal, milk
 *            transport...) divided by the litres of milk that went into bulk
 *            batches that day, times this batch's litres
 *          + any labour entered on the batch itself
 *   unit   = batch / yield
 *   SKU    = bulk product in the pieces (at that product's unit cost that day,
 *            else its latest batch before) + packing material + a share of the
 *            day's delivery fuel by the quantity packed
 */

export interface CostDay {
  day: string;
  milk_litre: number;                                     // milk that went into bulk batches
  heads: { code: string; label: string; amount: number }[];
  shared: number;                                         // overheads spread over the milk (all but delivery)
  delivery: number;                                       // delivery fuel, spread over SKUs packed
  rate_per_litre: number | null;                          // shared / milk
  rates: Record<string, number>;                          // per head (code): ₹ per litre of milk
}

/** A shared-cost head that showed up in the period (everything but delivery fuel). */
export interface SharedHead { code: string; label: string }

export interface BatchCost {
  day: string;
  product_id: string;
  product: string;
  unit: string;
  milk_litre: number;
  fat_pct: number | null;
  snf_pct: number | null;
  milk_cost: number;
  ingredient_cost: number;
  ingredient_by_item: Record<string, number>;   // ingredient_cost split by ingredient name
  overhead_cost: number;
  shared_by_head: Record<string, number>;   // overhead_cost split by head code
  labour_cost: number;
  total: number;
  output: number | null;
  unit_cost: number | null;   // ₹ per kg / L of yield
  complete: boolean;
}

export interface SkuCost {
  day: string;
  sku_id: string;
  code: string;
  name: string;
  category: string;
  pcs: number;
  case_unit: string;          // CRT, CBX, PCS, KG
  pcs_per_case: number;
  cases: number;              // full cases packed
  loose_pcs: number;
  bulk_qty: number;           // kg / L of bulk product in the pieces
  bulk_unit: string | null;
  bulk_cost: number;
  shared_cost: number;        // the part of bulk_cost that is the day's shared costs
  shared_by_head: Record<string, number>;
  milk_cost: number;          // the part of bulk_cost that is milk
  ingredient_by_item: Record<string, number>;   // the ingredients in the pieces, by name
  material_cost: number;
  material_by_item: Record<string, number>;     // packing material, by item name
  delivery_cost: number;
  total: number;
  per_pc: number | null;
  per_unit: number | null;    // ₹ per kg / L of product in the pieces
}

export interface Costing {
  heads: SharedHead[];
  days: CostDay[];
  batches: BatchCost[];
  skus: SkuCost[];
}

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/** Quantity in `from` units expressed in `to` units (kg/g, L/ml); unrelated units pass through. */
function convert(qty: number, from: string, to: string): number {
  if (from === to) return qty;
  const f: Record<string, [string, number]> = { g: ["kg", 0.001], kg: ["kg", 1], ml: ["L", 0.001], L: ["L", 1], pc: ["pcs", 1], pcs: ["pcs", 1] };
  const a = f[from], b = f[to];
  if (!a || !b || a[0] !== b[0]) return qty;
  return (qty * a[1]) / b[1];
}

export async function getCosting(from: string, to: string): Promise<Costing> {
  const scenario = await activeScenarioId();

  const [heads, batches, lines, rates, standing, skuRows, material] = await Promise.all([
    query<{ day: string; code: string; label: string; amount: number }>(
      `select to_char(d.day, 'YYYY-MM-DD') as day, h.code, h.label, o.amount
         from daily_overhead o join production_day d on d.id = o.day_id join overhead_head h on h.id = o.head_id
        where d.scenario_id = $1 and d.day between $2 and $3 and o.amount is not null
        order by h.sort_order`, [scenario, from, to]),
    query<{ id: string; day: string; product_id: string; product: string; unit: string; milk_litre: number | null;
            fat: number | null; snf: number | null; milk_cost: number | null; output: number | null; labour: number | null }>(
      `select b.id, to_char(b.batch_date, 'YYYY-MM-DD') as day, p.id as product_id, p.name as product, p.unit,
              b.milk_litre, b.milk_fat_pct as fat, b.milk_snf_pct as snf, b.milk_cost, b.output_qty as output, b.labour_cost as labour
         from bulk_batch b join bulk_product p on p.id = b.bulk_product_id
        where b.scenario_id = $1 and b.batch_date between $2 and $3
        order by b.batch_date, p.sort_order`, [scenario, from, to]),
    query<{ batch_id: string; ingredient_id: string | null; name: string; qty: number; unit: string }>(
      `select l.batch_id, l.ingredient_id, l.name, l.qty, l.unit from bulk_batch_ingredient l
         join bulk_batch b on b.id = l.batch_id
        where b.scenario_id = $1 and b.batch_date between $2 and $3`, [scenario, from, to]),
    query<{ id: string; unit: string | null; rate: number | null }>(
      `select o.id,
              max(coalesce(v.computed_text, v.input_text)) filter (where v.field_key = 'unit') as unit,
              max(coalesce(v.computed_num, v.input_num)) filter (where v.field_key = 'rate') as rate
         from cost_object o join object_class k on k.id = o.class_id and k.code = 'ingredient'
         left join v_cell v on v.object_id = o.id
        where o.scenario_id = $1 group by o.id`, [scenario]),
    query<{ bulk_product_id: string; ingredient_id: string }>(`select bulk_product_id, ingredient_id from bulk_product_ingredient`),
    query<{ day: string; sku_id: string; code: string; name: string; category: string; pcs: number;
            per_pc: number | null; bulk_product_id: string | null; bulk_unit: string | null;
            case_unit: string; pcs_per_case: number; cases: number; loose_pcs: number }>(
      `select to_char(d.day, 'YYYY-MM-DD') as day, s.id as sku_id, s.code, s.name, s.category,
              d.cases * s.pcs_per_case + d.loose_pcs as pcs, s.bulk_qty_per_pc as per_pc, s.bulk_product_id, p.unit as bulk_unit,
              s.case_unit, s.pcs_per_case, d.cases, d.loose_pcs
         from sku_pack_day d join sku s on s.id = d.sku_id left join bulk_product p on p.id = s.bulk_product_id
        where d.scenario_id = $1 and d.day between $2 and $3
        order by d.day, s.sort_order`, [scenario, from, to]),
    query<{ day: string; sku_id: string; name: string; amount: number }>(
      `select to_char(day, 'YYYY-MM-DD') as day, sku_id, name, sum(qty * price) as amount from sku_pack_material
        where scenario_id = $1 and day between $2 and $3 group by day, sku_id, name`, [scenario, from, to]),
  ]);

  // --- days
  const dayMap = new Map<string, CostDay>();
  const dayOf = (d: string) => {
    let x = dayMap.get(d);
    if (!x) { x = { day: d, milk_litre: 0, heads: [], shared: 0, delivery: 0, rate_per_litre: null, rates: {} }; dayMap.set(d, x); }
    return x;
  };
  for (const h of heads) {
    const d = dayOf(h.day);
    d.heads.push({ code: h.code, label: h.label, amount: n(h.amount) });
    if (h.code === "fuel_delivery") d.delivery += n(h.amount);
    else d.shared += n(h.amount);
  }
  for (const b of batches) dayOf(b.day).milk_litre += n(b.milk_litre);
  const sharedHeads = new Map<string, string>();
  for (const h of heads) if (h.code !== "fuel_delivery") sharedHeads.set(h.code, h.label);
  for (const d of dayMap.values()) {
    d.rate_per_litre = d.milk_litre > 0 ? d.shared / d.milk_litre : null;
    for (const h of d.heads) if (h.code !== "fuel_delivery" && d.milk_litre > 0) d.rates[h.code] = (d.rates[h.code] ?? 0) + h.amount / d.milk_litre;
  }

  // --- batches
  const rateById = new Map(rates.map((r) => [r.id, r]));
  const standingBy = new Map<string, { ingredient_id: string }[]>();
  for (const s of standing) standingBy.set(s.bulk_product_id, [...(standingBy.get(s.bulk_product_id) ?? []), s]);
  const linesBy = new Map<string, typeof lines>();
  for (const l of lines) linesBy.set(l.batch_id, [...(linesBy.get(l.batch_id) ?? []), l]);

  const batchCosts: BatchCost[] = batches.map((b) => {
    const ls = linesBy.get(b.id) ?? [];
    let ingredient = 0;
    const byItem: Record<string, number> = {};
    for (const l of ls) {
      const r = l.ingredient_id ? rateById.get(l.ingredient_id) : undefined;
      if (!r || !r.rate) continue;
      const v = convert(n(l.qty), l.unit, r.unit ?? l.unit) * n(r.rate);
      ingredient += v;
      byItem[l.name] = (byItem[l.name] ?? 0) + v;
    }
    const milk = n(b.milk_litre);
    const day = dayMap.get(b.day);
    const byHead: Record<string, number> = {};
    for (const [code, r] of Object.entries(day?.rates ?? {})) byHead[code] = milk * r;
    const overhead = Object.values(byHead).reduce((t, v) => t + v, 0);
    const labour = n(b.labour);
    const total = n(b.milk_cost) + ingredient + overhead + labour;
    const output = b.output === null ? null : n(b.output);
    return {
      day: b.day, product_id: b.product_id, product: b.product, unit: b.unit, milk_litre: milk,
      fat_pct: b.fat === null ? null : n(b.fat), snf_pct: b.snf === null ? null : n(b.snf),
      milk_cost: n(b.milk_cost), ingredient_cost: ingredient, ingredient_by_item: byItem, overhead_cost: overhead, shared_by_head: byHead, labour_cost: labour, total,
      output, unit_cost: output && output > 0 ? total / output : null,
      complete: batchComplete(standingBy.get(b.product_id) ?? [], ls.map((l) => ({ ingredient_id: l.ingredient_id, qty: n(l.qty) })), milk),
    };
  });

  // unit cost of a product on a day: that day's batch, else the latest one before it in the period
  // (a SKU packed from a batch made before the period shows no bulk cost)
  const batchFor = (productId: string, day: string): BatchCost | null => {
    const same = batchCosts.filter((b) => b.product_id === productId && b.day <= day && b.unit_cost !== null);
    return same.length ? same[same.length - 1] : null;
  };

  // --- SKUs
  const matBy = new Map<string, number>();
  const matItems = new Map<string, Record<string, number>>();
  for (const m of material) {
    const k = `${m.day}|${m.sku_id}`;
    matBy.set(k, (matBy.get(k) ?? 0) + n(m.amount));
    const items = matItems.get(k) ?? {};
    items[m.name] = (items[m.name] ?? 0) + n(m.amount);
    matItems.set(k, items);
  }
  const packedQty = new Map<string, number>();
  for (const s of skuRows) {
    const q = n(s.pcs) * n(s.per_pc);
    packedQty.set(s.day, (packedQty.get(s.day) ?? 0) + q);
  }
  const skuCosts: SkuCost[] = skuRows.map((s) => {
    const pcs = n(s.pcs);
    const bulkQty = pcs * n(s.per_pc);
    const b = s.bulk_product_id ? batchFor(s.bulk_product_id, s.day) : null;
    const bulk = b?.unit_cost ? bulkQty * b.unit_cost : 0;
    const sharedPart = b && b.output ? bulkQty * (b.overhead_cost / b.output) : 0;
    const sharedByHead: Record<string, number> = {};
    const ingByItem: Record<string, number> = {};
    if (b && b.output) {
      for (const [code, v] of Object.entries(b.shared_by_head)) sharedByHead[code] = bulkQty * (v / b.output);
      for (const [name, v] of Object.entries(b.ingredient_by_item)) ingByItem[name] = bulkQty * (v / b.output);
    }
    const milkPart = b && b.output ? bulkQty * (b.milk_cost / b.output) : 0;
    const mat = matBy.get(`${s.day}|${s.sku_id}`) ?? 0;
    const dayPacked = packedQty.get(s.day) ?? 0;
    const delivery = dayPacked > 0 ? ((dayMap.get(s.day)?.delivery ?? 0) * bulkQty) / dayPacked : 0;
    const total = bulk + mat + delivery;
    return {
      day: s.day, sku_id: s.sku_id, code: s.code, name: s.name, category: s.category, pcs,
      case_unit: s.case_unit, pcs_per_case: n(s.pcs_per_case), cases: n(s.cases), loose_pcs: n(s.loose_pcs), bulk_qty: bulkQty,
      bulk_unit: s.bulk_unit, bulk_cost: bulk, shared_cost: sharedPart, shared_by_head: sharedByHead,
      milk_cost: milkPart, ingredient_by_item: ingByItem, material_cost: mat, material_by_item: matItems.get(`${s.day}|${s.sku_id}`) ?? {}, delivery_cost: delivery, total,
      per_pc: pcs > 0 ? total / pcs : null,
      per_unit: bulkQty > 0 ? total / bulkQty : null,
    };
  });

  return {
    heads: [...sharedHeads.entries()].map(([code, label]) => ({ code, label })),
    days: [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
    batches: batchCosts,
    skus: skuCosts,
  };
}
