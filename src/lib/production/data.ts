import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";

export interface BulkProduct {
  id: string;
  code: string;
  name: string;
  unit: "kg" | "L";
  is_active: boolean;
  notes: string | null;
  /** Its standing ingredient list, from the product master, in order. */
  ingredients: { ingredient_id: string; name: string; unit: string }[];
}

export interface IngredientOption {
  id: string;
  name: string;
  unit: string | null;   // from the ingredient's Unit field
}

export interface BatchIngredient {
  id: string;
  ingredient_id: string | null;
  name: string;
  qty: number;
  unit: string;
}

export interface Batch {
  id: string;
  batch_date: string;
  bulk_product_id: string;
  product_name: string;
  product_unit: "kg" | "L";
  batch_no: string | null;
  output_qty: number | null;
  milk_litre: number | null;
  milk_fat_pct: number | null;
  milk_snf_pct: number | null;
  labour_workers: number | null;
  labour_hours: number | null;
  labour_cost: number | null;
  notes: string | null;
  ingredients: BatchIngredient[];
}

export interface ProductionDaySummary {
  day: string;
  batches: number;
  milk_litre: number;
  labour_hours: number;   // worker-hours
  labour_cost: number;
  output: { name: string; unit: string; qty: number }[];
}

export async function getBulkProducts(): Promise<BulkProduct[]> {
  return query<BulkProduct>(
    `select p.id, p.code, p.name, p.unit, p.is_active, p.notes,
            coalesce(
              (select json_agg(json_build_object('ingredient_id', o.id, 'name', o.name, 'unit', bpi.unit)
                               order by bpi.sort_order, o.name)
                 from bulk_product_ingredient bpi join cost_object o on o.id = bpi.ingredient_id
                where bpi.bulk_product_id = p.id),
              '[]'::json) as ingredients
       from bulk_product p
      where p.scenario_id = $1
      order by p.sort_order, p.name`,
    [await activeScenarioId()],
  );
}

/** The active Ingredients from the cost model, with their unit, for the batch form. */
export async function getIngredientOptions(): Promise<IngredientOption[]> {
  return query<IngredientOption>(
    `select o.id, o.name, coalesce(fv.value_text, fv.computed_text) as unit
       from cost_object o
       join object_class c on c.id = o.class_id and c.code = 'ingredient'
       left join field_def fd on fd.class_id = c.id and fd.key = 'unit'
       left join field_value fv on fv.object_id = o.id and fv.field_def_id = fd.id
      where o.scenario_id = $1 and o.is_active
      order by o.sort_order, o.name`,
    [await activeScenarioId()],
  );
}

/** Every batch on one date, in the order entered, with its ingredients. */
export async function getBatches(date: string): Promise<Batch[]> {
  const scenario = await activeScenarioId();
  const batches = await query<Omit<Batch, "ingredients">>(
    `select b.id, to_char(b.batch_date, 'YYYY-MM-DD') as batch_date, b.bulk_product_id,
            p.name as product_name, p.unit as product_unit, b.batch_no, b.output_qty,
            b.milk_litre, b.milk_fat_pct, b.milk_snf_pct,
            b.labour_workers, b.labour_hours, b.labour_cost, b.notes
       from bulk_batch b join bulk_product p on p.id = b.bulk_product_id
      where b.scenario_id = $1 and b.batch_date = $2::date
      order by b.created_at, b.id`,
    [scenario, date],
  );
  if (!batches.length) return [];
  const lines = await query<BatchIngredient & { batch_id: string }>(
    `select id, batch_id, ingredient_id, name, qty, unit from bulk_batch_ingredient
      where batch_id = any($1) order by sort_order, name`,
    [batches.map((b) => b.id)],
  );
  return batches.map((b) => ({ ...b, ingredients: lines.filter((l) => l.batch_id === b.id) }));
}

/** The most recent production days, newest first, for the history list. */
export async function getProductionDays(limit = 30): Promise<ProductionDaySummary[]> {
  const rows = await query<{
    day: string; batches: number; milk_litre: number; labour_hours: number; labour_cost: number;
    name: string; unit: string; qty: number;
  }>(
    `with days as (
       select distinct batch_date from bulk_batch where scenario_id = $1
        order by batch_date desc limit $2
     )
     select to_char(b.batch_date, 'YYYY-MM-DD') as day,
            count(*) over (partition by b.batch_date)::int as batches,
            sum(coalesce(b.milk_litre, 0)) over (partition by b.batch_date) as milk_litre,
            sum(coalesce(b.labour_workers, 1) * coalesce(b.labour_hours, 0)) over (partition by b.batch_date) as labour_hours,
            sum(coalesce(b.labour_cost, 0)) over (partition by b.batch_date) as labour_cost,
            p.name, p.unit, coalesce(b.output_qty, 0) as qty
       from bulk_batch b
       join days d on d.batch_date = b.batch_date
       join bulk_product p on p.id = b.bulk_product_id
      where b.scenario_id = $1
      order by b.batch_date desc, p.sort_order, p.name`,
    [await activeScenarioId(), limit],
  );

  const byDay = new Map<string, ProductionDaySummary>();
  for (const r of rows) {
    let d = byDay.get(r.day);
    if (!d) {
      d = { day: r.day, batches: r.batches, milk_litre: r.milk_litre, labour_hours: r.labour_hours, labour_cost: r.labour_cost, output: [] };
      byDay.set(r.day, d);
    }
    const o = d.output.find((x) => x.name === r.name);
    if (o) o.qty += r.qty;
    else d.output.push({ name: r.name, unit: r.unit, qty: r.qty });
  }
  return [...byDay.values()];
}
