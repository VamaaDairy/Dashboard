import { pool, query } from "@/lib/db";

/**
 * Costs one day of production from what the plant actually spent.
 *
 * The day supplies two things the standard card cannot: the milk actually
 * processed, and the shared costs actually incurred. Divide the second by the
 * first and you get that day's conversion cost per litre - the real version of
 * the standing 3.56/L. Every product then carries that rate in proportion to
 * the milk embodied in it, and adds its own raw material and packing on top.
 */

interface ObjectRow {
  id: string;
  code: string;
  name: string;
  class_code: string;
}

interface LineRow {
  parent_object_id: string;
  component_object_id: string | null;
  line_type: string;
  computed_qty: number | null;
  computed_rate: number | null;
  computed_divisor: number | null;
  computed_amount: number | null;
}

export interface ProductDayCost {
  product_id: string;
  code: string;
  name: string;
  qty_produced: number;
  pack_size: number;
  milk_qty_per_unit: number;
  milk_rate: number;
  conversion_rate: number;
  material_cost: number;
  conversion_cost: number;
  packing_cost: number;
  other_cost: number;
  unit_cost: number;
  cost_per_kg: number | null;
  market_transport: number;
  landed_unit_cost: number;
  landed_per_kg: number | null;
  total_cost: number;
}

export interface DayCosting {
  dayId: string;
  day: string;
  milkProcessed: number;
  totalOverhead: number;
  conversionRate: number;
  products: ProductDayCost[];
  totalProductionCost: number;
  milkAccountedFor: number;
}

const n = (v: number | null | undefined) => (v === null || v === undefined ? 0 : Number(v));

export async function computeDay(dayId: string): Promise<DayCosting | null> {
  const day = await query<{
    id: string; day: string; scenario_id: string; milk_processed_l: number | null;
  }>(`select id, day, scenario_id, milk_processed_l from production_day where id = $1`, [dayId]);
  if (!day.length) return null;
  const { scenario_id: scenarioId, milk_processed_l } = day[0];
  const milkProcessed = n(milk_processed_l);

  const [overheads, objects, lines, cells, production, materialUse] = await Promise.all([
    query<{ amount: number | null }>(
      `select amount from daily_overhead where day_id = $1`, [dayId]),
    query<ObjectRow>(
      `select o.id, o.code, o.name, c.code as class_code
         from cost_object o join object_class c on c.id = o.class_id
        where o.scenario_id = $1 and o.is_active`, [scenarioId]),
    query<LineRow>(
      `select parent_object_id, component_object_id, line_type,
              computed_qty, computed_rate, computed_divisor, computed_amount
         from bom_line where scenario_id = $1 and include_in_total`, [scenarioId]),
    query<{ object_id: string; field_key: string; computed_num: number | null }>(
      `select v.object_id, v.field_key, v.computed_num
         from v_cell v
        where v.scenario_id = $1
          and v.field_key in ('solids_rate', 'commission', 'proc_transport', 'packing_cost',
                              'additives_cost', 'yield_qty', 'making_charges', 'rate',
                              'pack_size', 'market_transport')`,
      [scenarioId]),
    query<{ product_id: string; qty_produced: number }>(
      `select product_id, qty_produced from daily_production where day_id = $1`, [dayId]),
    query<{ product_id: string; amount: number | null }>(
      `select product_id, amount from daily_material_use where day_id = $1`, [dayId]),
  ]);

  const totalOverhead = overheads.reduce((s, o) => s + n(o.amount), 0);
  const conversionRate = milkProcessed > 0 ? totalOverhead / milkProcessed : 0;

  const objectById = new Map(objects.map((o) => [o.id, o]));
  const linesByParent = new Map<string, LineRow[]>();
  for (const l of lines) {
    const list = linesByParent.get(l.parent_object_id) ?? [];
    list.push(l);
    linesByParent.set(l.parent_object_id, list);
  }
  const cell = new Map<string, number>();
  for (const c of cells) cell.set(`${c.object_id}:${c.field_key}`, n(c.computed_num));
  const val = (id: string, key: string) => cell.get(`${id}:${key}`) ?? 0;

  /** Litres of milk embodied in one unit of an object. */
  const milkMemo = new Map<string, number>();
  function milkPerUnit(id: string, seen = new Set<string>()): number {
    const cached = milkMemo.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return 0;
    seen.add(id);

    const object = objectById.get(id);
    if (!object) return 0;
    if (object.class_code === "milk_batch") {
      milkMemo.set(id, 1);
      return 1;
    }

    let litres = 0;
    for (const l of linesByParent.get(id) ?? []) {
      if (l.line_type !== "input" || !l.component_object_id) continue;
      const qty = n(l.computed_qty) / (n(l.computed_divisor) || 1);
      litres += qty * milkPerUnit(l.component_object_id, seen);
    }
    // a recipe's lines are stated per batch, so bring them down to one unit
    const yieldQty = val(id, "yield_qty");
    if (object.class_code === "recipe" && yieldQty > 0) litres /= yieldQty;

    milkMemo.set(id, litres);
    return litres;
  }

  /**
   * Input cost of one unit at purchase rates only - milk at what it was bought
   * for, ingredients at their rate. Conversion is deliberately excluded; the day
   * supplies that separately.
   */
  const purchaseMemo = new Map<string, number>();
  function purchaseCost(id: string, seen = new Set<string>()): number {
    const cached = purchaseMemo.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return 0;
    seen.add(id);

    const object = objectById.get(id);
    if (!object) return 0;

    if (object.class_code === "milk_batch") {
      const rate = val(id, "solids_rate") + val(id, "commission") + val(id, "proc_transport");
      purchaseMemo.set(id, rate);
      return rate;
    }
    if (object.class_code === "ingredient" || object.class_code === "packaging") {
      const rate = val(id, "rate");
      purchaseMemo.set(id, rate);
      return rate;
    }

    let cost = 0;
    for (const l of linesByParent.get(id) ?? []) {
      if (l.line_type !== "input" || !l.component_object_id) continue;
      const qty = n(l.computed_qty) / (n(l.computed_divisor) || 1);
      cost += qty * purchaseCost(l.component_object_id, seen);
    }
    const yieldQty = val(id, "yield_qty");
    if (object.class_code === "recipe" && yieldQty > 0) {
      cost = cost / yieldQty + val(id, "making_charges");
    }

    purchaseMemo.set(id, cost);
    return cost;
  }

  const producedByProduct = new Map(production.map((p) => [p.product_id, n(p.qty_produced)]));
  const actualMaterial = new Map<string, number>();
  for (const m of materialUse) {
    actualMaterial.set(m.product_id, (actualMaterial.get(m.product_id) ?? 0) + n(m.amount));
  }

  const products: ProductDayCost[] = [];
  let milkAccountedFor = 0;

  for (const object of objects) {
    if (object.class_code !== "product") continue;
    const qtyProduced = producedByProduct.get(object.id) ?? 0;
    if (qtyProduced <= 0) continue;

    const milkQty = milkPerUnit(object.id);
    const materialCost = actualMaterial.get(object.id) ?? purchaseCost(object.id);
    const conversionCost = milkQty * conversionRate;
    const packingCost = val(object.id, "packing_cost");
    const otherCost = val(object.id, "additives_cost");
    const unitCost = materialCost + conversionCost + packingCost + otherCost;

    // pack size is what the piece holds, so it converts a per-piece cost to per kg / litre
    const packSize = val(object.id, "pack_size");
    const marketTransport = val(object.id, "market_transport");
    const landedUnitCost = unitCost + marketTransport;

    milkAccountedFor += milkQty * qtyProduced;
    products.push({
      product_id: object.id,
      code: object.code,
      name: object.name,
      qty_produced: qtyProduced,
      pack_size: packSize,
      milk_qty_per_unit: milkQty,
      milk_rate: milkQty > 0 ? materialCost / milkQty : 0,
      conversion_rate: conversionRate,
      material_cost: materialCost,
      conversion_cost: conversionCost,
      packing_cost: packingCost,
      other_cost: otherCost,
      unit_cost: unitCost,
      cost_per_kg: packSize > 0 ? unitCost / packSize : null,
      market_transport: marketTransport,
      landed_unit_cost: landedUnitCost,
      landed_per_kg: packSize > 0 ? landedUnitCost / packSize : null,
      total_cost: unitCost * qtyProduced,
    });
  }

  products.sort((a, b) => b.total_cost - a.total_cost);

  return {
    dayId,
    day: day[0].day,
    milkProcessed,
    totalOverhead,
    conversionRate,
    products,
    totalProductionCost: products.reduce((s, p) => s + p.total_cost, 0),
    milkAccountedFor,
  };
}

/** Recalculates a day and freezes the result, so later rate changes leave it alone. */
export async function freezeDay(dayId: string): Promise<DayCosting | null> {
  const costing = await computeDay(dayId);
  if (!costing) return null;

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`delete from daily_product_cost where day_id = $1`, [dayId]);
    for (const p of costing.products) {
      await client.query(
        `insert into daily_product_cost
           (day_id, product_id, qty_produced, pack_size, milk_qty_per_unit, milk_rate,
            conversion_rate, material_cost, conversion_cost, packing_cost, other_cost,
            unit_cost, cost_per_kg, market_transport, landed_unit_cost, landed_per_kg, total_cost)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [dayId, p.product_id, p.qty_produced, p.pack_size, p.milk_qty_per_unit, p.milk_rate,
         p.conversion_rate, p.material_cost, p.conversion_cost, p.packing_cost, p.other_cost,
         p.unit_cost, p.cost_per_kg, p.market_transport, p.landed_unit_cost, p.landed_per_kg,
         p.total_cost],
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  return costing;
}
