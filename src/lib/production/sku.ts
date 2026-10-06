import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";

/** One SKU's line on a day: the SKU, and what was packed into it that day. */
export interface SkuDayRow {
  sku_id: string;
  code: string;
  name: string;
  category: string;
  case_unit: string;
  pcs_per_case: number;
  shelf_life_days: number | null;
  bulk_product_id: string | null;
  bulk_qty_per_pc: number | null;
  is_active: boolean;
  saved: boolean;
  cases: number;
  loose_pcs: number;
}

/** A bulk product's yield on a day, from its batch - what the SKUs are packed from. */
export interface BulkYield {
  bulk_product_id: string;
  name: string;
  unit: "kg" | "L";
  output_qty: number | null;   // null = batch saved, yield not entered yet
}

export interface SkuHistoryDay {
  day: string;
  skus: number;
  pcs: number;
  material: number;   // packing material ₹
}

/** Every SKU (inactive ones only if packed that day), in the stock app's order, with that day's packing. */
export async function getSkuDay(date: string): Promise<SkuDayRow[]> {
  return query<SkuDayRow>(
    `select s.id as sku_id, s.code, s.name, s.category, s.case_unit, s.pcs_per_case, s.shelf_life_days,
            s.bulk_product_id, s.bulk_qty_per_pc, s.is_active,
            (d.id is not null) as saved, coalesce(d.cases, 0) as cases, coalesce(d.loose_pcs, 0) as loose_pcs
       from sku s
       left join sku_pack_day d on d.sku_id = s.id and d.day = $2
      where s.scenario_id = $1 and (s.is_active or d.id is not null)
      order by s.sort_order, s.name`,
    [await activeScenarioId(), date],
  );
}

/** Every bulk product with a batch on this date, and its yield. */
export async function getBulkYields(date: string): Promise<BulkYield[]> {
  return query<BulkYield>(
    `select p.id as bulk_product_id, p.name, p.unit, b.output_qty
       from bulk_batch b join bulk_product p on p.id = b.bulk_product_id
      where b.scenario_id = $1 and b.batch_date = $2
      order by p.sort_order, p.name`,
    [await activeScenarioId(), date],
  );
}

/** The most recent packing days, newest first. */
export async function getSkuHistory(limit = 30): Promise<SkuHistoryDay[]> {
  return query<SkuHistoryDay>(
    `with packed as (
       select d.day, count(*)::int as skus, sum(d.cases * s.pcs_per_case + d.loose_pcs) as pcs
         from sku_pack_day d join sku s on s.id = d.sku_id
        where d.scenario_id = $1 group by d.day
     ), material as (
       select day, sum(qty * price) as material from sku_pack_material where scenario_id = $1 group by day
     )
     select to_char(coalesce(p.day, m.day), 'YYYY-MM-DD') as day,
            coalesce(p.skus, 0) as skus, coalesce(p.pcs, 0) as pcs, coalesce(m.material, 0) as material
       from packed p full join material m on m.day = p.day
      order by coalesce(p.day, m.day) desc limit $2`,
    [await activeScenarioId(), limit],
  );
}

/** One packing-material line on a SKU's day. */
export interface PackMaterial {
  packaging_id: string | null;
  name: string;
  qty: number;
  unit: "kg" | "pcs";
  price: number;   // ₹ per kg or per piece
}

/** A Packaging master item, with the price it was last entered at (any SKU), else its master rate. */
export interface PackagingOption {
  id: string;
  name: string;
  unit: "kg" | "pcs";
  last_price: number | null;
}

/** Every SKU's packing material on this date, by SKU id. */
export async function getSkuMaterials(date: string): Promise<Record<string, PackMaterial[]>> {
  const rows = await query<PackMaterial & { sku_id: string }>(
    `select sku_id, packaging_id, name, qty, unit, price from sku_pack_material
      where scenario_id = $1 and day = $2 order by sku_id, sort_order, created_at`,
    [await activeScenarioId(), date],
  );
  return group(rows);
}

/**
 * For each SKU, the material lines from the last day before `date` that it
 * had any - offered as "same as last time" - with that day.
 */
export async function getLastSkuMaterials(date: string): Promise<Record<string, { day: string; lines: PackMaterial[] }>> {
  const rows = await query<PackMaterial & { sku_id: string; day: string }>(
    `select m.sku_id, to_char(m.day, 'YYYY-MM-DD') as day, m.packaging_id, m.name, m.qty, m.unit, m.price
       from sku_pack_material m
       join (select sku_id, max(day) as day from sku_pack_material
              where scenario_id = $1 and day < $2 group by sku_id) l on l.sku_id = m.sku_id and l.day = m.day
      order by m.sku_id, m.sort_order, m.created_at`,
    [await activeScenarioId(), date],
  );
  const out: Record<string, { day: string; lines: PackMaterial[] }> = {};
  for (const r of rows) {
    const { sku_id, day, ...line } = r;
    (out[sku_id] ??= { day, lines: [] }).lines.push(line);
  }
  return out;
}

/** The Packaging master's active items, with the last price each was entered at. */
export async function getPackagingOptions(): Promise<PackagingOption[]> {
  return query<PackagingOption>(
    `select o.id, o.name,
            case when coalesce(u.value_text, u.computed_text) = 'kg' then 'kg' else 'pcs' end as unit,
            coalesce(
              (select m.price from sku_pack_material m where m.packaging_id = o.id
                order by m.day desc, m.created_at desc limit 1),
              r.value_num) as last_price
       from cost_object o
       join object_class c on c.id = o.class_id and c.code = 'packaging'
       left join field_def fu on fu.class_id = c.id and fu.key = 'unit'
       left join field_value u on u.object_id = o.id and u.field_def_id = fu.id
       left join field_def fr on fr.class_id = c.id and fr.key = 'rate'
       left join field_value r on r.object_id = o.id and r.field_def_id = fr.id
      where o.scenario_id = $1 and o.is_active
      order by o.sort_order, o.name`,
    [await activeScenarioId()],
  );
}

function group(rows: (PackMaterial & { sku_id: string })[]): Record<string, PackMaterial[]> {
  const out: Record<string, PackMaterial[]> = {};
  for (const { sku_id, ...line } of rows) (out[sku_id] ??= []).push(line);
  return out;
}

/** One line of a SKU's standing packing list, with the item's unit and current rate (incl. GST). */
export interface PackingListLine {
  packaging_id: string;
  name: string;
  unit: "kg" | "pcs";
  qty: number;           // per piece or per case, in the item's unit
  per: "pc" | "case";
  rate: number | null;
}

/** Every SKU's standing packing list, by SKU id. */
export async function getSkuPackingLists(): Promise<Record<string, PackingListLine[]>> {
  const rows = await query<PackingListLine & { sku_id: string }>(
    `select i.sku_id, i.packaging_id, o.name,
            case when coalesce(u.value_text, u.computed_text) = 'kg' then 'kg' else 'pcs' end as unit,
            i.qty, i.per, r.value_num as rate
       from sku_packing_item i
       join sku s on s.id = i.sku_id
       join cost_object o on o.id = i.packaging_id
       left join field_def fu on fu.class_id = o.class_id and fu.key = 'unit'
       left join field_value u on u.object_id = o.id and u.field_def_id = fu.id
       left join field_def fr on fr.class_id = o.class_id and fr.key = 'rate'
       left join field_value r on r.object_id = o.id and r.field_def_id = fr.id
      where s.scenario_id = $1
      order by i.sku_id, i.sort_order`,
    [await activeScenarioId()],
  );
  const out: Record<string, PackingListLine[]> = {};
  for (const { sku_id, ...l } of rows) (out[sku_id] ??= []).push({ ...l, qty: Number(l.qty), rate: l.rate === null ? null : Number(l.rate) });
  return out;
}
