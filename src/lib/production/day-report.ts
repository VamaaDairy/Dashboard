import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import type { BatchRow, CollectionRow, DayReportData, MoveRow, PackRow, ProcurementRow, TankRow } from "./day-report-model";

/**
 * One day's rows for the daily production report (Production > Daily batches > Day report): the milk collected at the
 * centre, other procurement, every active tank's opening and closing, the tank entries, the batches and the packing.
 */
export async function dayReportData(date: string): Promise<DayReportData> {
  const sc = await activeScenarioId();
  const [collection, procurement, tanks, moves, batches, packing] = await Promise.all([
    query<CollectionRow>(
      `select center, shift, count(distinct farmer_code)::int as farmers, round(sum(qty_litre)::numeric, 1)::float as litre,
              round((sum(qty_litre * fat_pct) / nullif(sum(qty_litre) filter (where fat_pct is not null), 0))::numeric, 2)::float as fat,
              round((sum(qty_litre * snf_pct) / nullif(sum(qty_litre) filter (where snf_pct is not null), 0))::numeric, 2)::float as snf
         from vamaa_collection where day = $1::date
        group by 1, 2 order by 1, 2`,
      [date],
    ),
    query<ProcurementRow>(
      `select pc.name as center, p.shift, round(p.qty_kg::numeric, 1)::float as kg, round(p.qty_litre::numeric, 1)::float as litre,
              p.fat_pct::float as fat, p.snf_pct::float as snf, t.tanker_code as tanker
         from procurement_batch p join procurement_center pc on pc.id = p.center_id
         left join tanker_trip t on t.id = p.trip_id
        where p.scenario_id = $1 and p.collected_on = $2::date
        order by pc.sort_order, pc.name, p.shift`,
      [sc, date],
    ),
    query<TankRow>(
      `select t.name as tank, t.capacity_litre::float as capacity,
              o.balance_litre::float as opening, o.balance_fat_pct::float as opening_fat, o.balance_snf_pct::float as opening_snf,
              c.balance_litre::float as closing, c.balance_fat_pct::float as closing_fat, c.balance_snf_pct::float as closing_snf
         from tank t
         left join lateral (select balance_litre, balance_fat_pct, balance_snf_pct from tank_movement m
                             where m.tank_id = t.id and m.movement_date < $2::date
                             order by m.movement_date desc, m.created_at desc limit 1) o on true
         left join lateral (select balance_litre, balance_fat_pct, balance_snf_pct from tank_movement m
                             where m.tank_id = t.id and m.movement_date <= $2::date
                             order by m.movement_date desc, m.created_at desc limit 1) c on true
        where t.scenario_id = $1 and t.is_active
        order by t.sort_order, t.name`,
      [sc, date],
    ),
    query<MoveRow>(
      `select t.name as tank, m.direction, coalesce(m.source, '') as source, round(m.qty_litre::numeric, 1)::float as litre,
              m.fat_pct::float as fat, m.snf_pct::float as snf, m.cost_per_litre::float as rate, m.notes,
              bp.name as batch_product, tt.name as transfer_tank
         from tank_movement m join tank t on t.id = m.tank_id
         left join bulk_batch b on b.id = m.bulk_batch_id left join bulk_product bp on bp.id = b.bulk_product_id
         left join tank_movement x on x.id = m.transfer_of left join tank tt on tt.id = x.tank_id
        where m.scenario_id = $1 and m.movement_date = $2::date
        order by m.created_at`,
      [sc, date],
    ),
    query<BatchRow>(
      `select bp.name as product, bp.unit, b.batch_no, b.milk_litre::float as milk_l, b.milk_fat_pct::float as fat,
              b.milk_snf_pct::float as snf, b.milk_cost::float as milk_cost, b.output_qty::float as output,
              b.labour_workers::float as workers, b.labour_hours::float as hours, b.labour_cost::float as labour_cost, b.notes,
              coalesce((select json_agg(json_build_object('name', i.name, 'qty', i.qty::float, 'unit', i.unit) order by i.sort_order)
                          from bulk_batch_ingredient i where i.batch_id = b.id), '[]') as ingredients,
              coalesce((select json_agg(json_build_object('tank', t.name, 'litre', m.qty_litre::float, 'fat', m.fat_pct::float,
                                                          'snf', m.snf_pct::float) order by m.created_at)
                          from tank_movement m join tank t on t.id = m.tank_id
                         where m.bulk_batch_id = b.id and m.direction = 'out'), '[]') as draws,
              coalesce((select json_agg(json_build_object('tank', t.name, 'fat', x.fat_pct::float, 'snf', x.snf_pct::float, 'clr', x.clr::float))
                          from production_milk_test x join tank t on t.id = x.tank_id where x.batch_id = b.id), '[]') as tests
         from bulk_batch b join bulk_product bp on bp.id = b.bulk_product_id
        where b.scenario_id = $1 and b.batch_date = $2::date
        order by bp.sort_order, bp.name`,
      [sc, date],
    ),
    query<PackRow>(
      `select s.code, s.name, s.category, s.case_unit, s.pcs_per_case::float as per_case, s.cases_only, s.made_outside,
              d.cases::float as cases, d.loose_pcs::float as loose, (d.cases * s.pcs_per_case + d.loose_pcs)::float as pcs,
              bp.name as bulk_product, bp.unit as bulk_unit,
              ((d.cases * s.pcs_per_case + d.loose_pcs) * coalesce(s.bulk_qty_per_pc, 0))::float as bulk_used,
              bb.batch_date::text as batch_date, bbp.name as batch_product,
              coalesce((select sum(m.qty * m.price) from sku_pack_material m where m.sku_id = s.id and m.day = d.day), 0)::float as material
         from sku_pack_day d join sku s on s.id = d.sku_id
         left join bulk_product bp on bp.id = s.bulk_product_id
         left join bulk_batch bb on bb.id = d.bulk_batch_id left join bulk_product bbp on bbp.id = bb.bulk_product_id
        where d.scenario_id = $1 and d.day = $2::date
        order by s.sort_order, s.name`,
      [sc, date],
    ),
  ]);
  return { date, pulledAt: new Date().toISOString(), collection, procurement, tanks, moves, batches, packing };
}
