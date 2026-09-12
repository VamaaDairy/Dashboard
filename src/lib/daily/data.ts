import "server-only";
import { one, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";

export interface DaySummary {
  day_id: string;
  day: string;
  status: string;
  milk_processed_l: number | null;
  total_overhead: number | null;
  conversion_rate: number | null;
  products_made: number;
  total_production_cost: number | null;
  cost_per_litre: number | null;
}

export async function getDays(limit = 60): Promise<DaySummary[]> {
  const id = await activeScenarioId();
  return query<DaySummary>(
    `select day_id, to_char(day, 'YYYY-MM-DD') as day, status, milk_processed_l,
            total_overhead, conversion_rate, products_made, total_production_cost, cost_per_litre
       from v_daily_summary where scenario_id = $1 order by day desc limit $2`,
    [id, limit],
  );
}

export async function getDay(date: string) {
  const id = await activeScenarioId();
  const day = await one<{ id: string; day: string; milk_processed_l: number | null; status: string; notes: string | null }>(
    `select id, to_char(day, 'YYYY-MM-DD') as day, milk_processed_l, status, notes
       from production_day where scenario_id = $1 and day = $2`,
    [id, date],
  );
  if (!day) return null;

  const [heads, production, products] = await Promise.all([
    query<{
      id: string; code: string; label: string; unit: string | null;
      qty: number | null; rate: number | null; amount: number | null;
    }>(
      `select h.id, h.code, h.label, h.unit, o.qty, o.rate, o.amount
         from overhead_head h
         left join daily_overhead o on o.head_id = h.id and o.day_id = $2
        where h.scenario_id = $1 and h.is_active
        order by h.sort_order, h.label`,
      [id, day.id],
    ),
    query<{ product_id: string; qty_produced: number }>(
      `select product_id, qty_produced from daily_production where day_id = $1`, [day.id]),
    query<{ id: string; code: string; name: string }>(
      `select o.id, o.code, o.name
         from cost_object o join object_class c on c.id = o.class_id
        where o.scenario_id = $1 and c.code = 'product' and o.is_active
        order by o.sort_order, o.name`,
      [id],
    ),
  ]);

  const producedBy = new Map(production.map((p) => [p.product_id, Number(p.qty_produced)]));
  return {
    day,
    heads,
    products: products.map((p) => ({ ...p, qty_produced: producedBy.get(p.id) ?? 0 })),
  };
}

export async function getRecentDayTotals(limit = 14) {
  const id = await activeScenarioId();
  return query<{ day: string; cost_per_litre: number | null; milk_processed_l: number | null; total_production_cost: number | null }>(
    `select to_char(day, 'YYYY-MM-DD') as day, cost_per_litre, milk_processed_l, total_production_cost
       from v_daily_summary
      where scenario_id = $1 and milk_processed_l is not null
      order by day desc limit $2`,
    [id, limit],
  );
}

export interface ProductTotal {
  code: string;
  name: string;
  days: number;
  qty: number;
  milk_used: number;
  total_cost: number;
  avg_unit_cost: number | null;
  min_unit_cost: number | null;
  max_unit_cost: number | null;
  avg_cost_per_kg: number | null;
  product_kg: number | null;
}

/** Production and cost per SKU across a date range. */
export async function getProductTotals(from: string, to: string): Promise<ProductTotal[]> {
  const id = await activeScenarioId();
  return query<ProductTotal>(
    `select o.code, o.name,
            count(distinct d.id)::int                                as days,
            sum(c.qty_produced)                                      as qty,
            sum(c.qty_produced * c.milk_qty_per_unit)                as milk_used,
            sum(c.total_cost)                                        as total_cost,
            case when sum(c.qty_produced) > 0
                 then sum(c.total_cost) / sum(c.qty_produced) end    as avg_unit_cost,
            min(c.unit_cost)                                         as min_unit_cost,
            max(c.unit_cost)                                         as max_unit_cost,
            sum(c.qty_produced * c.pack_size)                        as product_kg,
            case when sum(c.qty_produced * c.pack_size) > 0
                 then sum(c.total_cost) / sum(c.qty_produced * c.pack_size) end as avg_cost_per_kg
       from daily_product_cost c
       join production_day d on d.id = c.day_id
       join cost_object o on o.id = c.product_id
      where d.scenario_id = $1 and d.day between $2 and $3
      group by o.id, o.code, o.name
      order by sum(c.total_cost) desc`,
    [id, from, to],
  );
}

export async function getRangeSummary(from: string, to: string) {
  const id = await activeScenarioId();
  return one<{ days: number; milk: number | null; overhead: number | null; cost: number | null }>(
    `select count(*)::int as days, sum(milk_processed_l) as milk,
            sum(total_overhead) as overhead, sum(total_production_cost) as cost
       from v_daily_summary
      where scenario_id = $1 and day between $2 and $3`,
    [id, from, to],
  );
}
