import "server-only";
import { one, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { DEFAULT_KG_PER_LITRE } from "@/lib/units";
import type { CommissionMode, RateBasis } from "./pricing";

export interface RateChartRow {
  id: string;
  code: string;
  name: string;
  milk_type: "cow" | "buffalo" | "mixed";
  basis: RateBasis;
  rate_solid: number | null;
  rate_fat: number | null;
  rate_snf: number | null;
  flat_rate: number | null;
  effective_from: string;
  is_active: boolean;
  notes: string | null;
  center_count: number;
  batch_count: number;
}

export interface CenterRow {
  id: string;
  code: string;
  name: string;
  sachiv_name: string | null;
  village: string | null;
  route: string | null;
  distance_km: number | null;
  rate_chart_id: string | null;
  chart_name: string | null;
  commission_mode: CommissionMode;
  commission_rate: number | null;
  is_active: boolean;
  notes: string | null;
}

export interface BatchRow {
  batch_id: string;
  collected_on: string;
  shift: "morning" | "evening";
  center_id: string;
  center_code: string;
  center_name: string;
  sachiv_name: string | null;
  rate_chart_id: string;
  chart_name: string;
  chart_basis: RateBasis;
  trip_id: string | null;
  tanker_code: string | null;
  qty_kg: number;
  qty_litre: number;
  fat_pct: number | null;
  snf_pct: number | null;
  kg_fat: number;
  kg_snf: number;
  kg_solids: number;
  farmer_amount: number;
  farmer_rate_per_kg: number;
  commission_amount: number;
  transport_amount: number;
  landed_kg: number;
  landed_litre: number;
  total_cost: number;
  landed_per_kg: number | null;
  landed_per_litre: number | null;
}

export interface TripRow {
  trip_id: string;
  trip_date: string;
  tanker_code: string;
  vehicle_no: string | null;
  route: string | null;
  distance_km: number | null;
  cost_mode: "per_trip" | "per_km" | "per_kg" | "per_litre";
  rate: number | null;
  other_cost: number;
  cost_override: number | null;
  batch_count: number;
  dispatched_kg: number;
  dispatched_litre: number;
  landed_kg: number;
  landed_litre: number;
  shortage_kg: number;
  trip_cost: number | null;
  cost_per_kg: number | null;
  cost_per_litre: number | null;
}

export interface DayRow {
  collected_on: string;
  batch_count: number;
  center_count: number;
  qty_kg: number;
  qty_litre: number;
  landed_kg: number;
  landed_litre: number;
  kg_solids: number;
  fat_pct: number | null;
  snf_pct: number | null;
  farmer_amount: number;
  commission_amount: number;
  transport_amount: number;
  total_cost: number;
  landed_per_kg: number | null;
  landed_per_litre: number | null;
  landed_per_kg_solids: number | null;
}

export interface SachivRow {
  center_id: string;
  center_code: string;
  center_name: string;
  sachiv_name: string | null;
  first_collection: string | null;
  last_collection: string | null;
  batch_count: number;
  qty_kg: number;
  qty_litre: number;
  farmer_amount: number;
  commission_amount: number;
  commission_per_kg: number | null;
  commission_per_litre: number | null;
  commission_pct_of_value: number | null;
}

/** The live litre <-> kg factor for the active scenario. */
export async function kgPerLitre(scenarioId?: string): Promise<number> {
  const id = scenarioId ?? (await activeScenarioId());
  const row = await one<{ k: number }>(`select milk_kg_per_litre($1) as k`, [id]);
  return Number(row?.k) || DEFAULT_KG_PER_LITRE;
}

export async function getRateCharts(): Promise<RateChartRow[]> {
  return query<RateChartRow>(
    `select c.id, c.code, c.name, c.milk_type, c.basis, c.rate_solid, c.rate_fat,
            c.rate_snf, c.flat_rate, to_char(c.effective_from, 'YYYY-MM-DD') as effective_from,
            c.is_active, c.notes,
            (select count(*) from procurement_center t where t.rate_chart_id = c.id)::int as center_count,
            (select count(*) from procurement_batch b where b.rate_chart_id = c.id)::int as batch_count
       from milk_rate_chart c
      where c.scenario_id = $1
      order by c.sort_order, c.name`,
    [await activeScenarioId()],
  );
}

export async function getCenters(): Promise<CenterRow[]> {
  return query<CenterRow>(
    `select t.id, t.code, t.name, t.sachiv_name, t.village, t.route, t.distance_km,
            t.rate_chart_id, c.name as chart_name, t.commission_mode, t.commission_rate,
            t.is_active, t.notes
       from procurement_center t
       left join milk_rate_chart c on c.id = t.rate_chart_id
      where t.scenario_id = $1
      order by t.sort_order, t.name`,
    [await activeScenarioId()],
  );
}

export async function getBatches(limit = 200): Promise<BatchRow[]> {
  return query<BatchRow>(
    `select batch_id, to_char(collected_on, 'YYYY-MM-DD') as collected_on, shift,
            center_id, center_code, center_name, sachiv_name, rate_chart_id, chart_name,
            chart_basis, trip_id, tanker_code, qty_kg, qty_litre, fat_pct, snf_pct,
            kg_fat, kg_snf, kg_solids, farmer_amount, farmer_rate_per_kg,
            commission_amount, transport_amount, landed_kg, landed_litre,
            total_cost, landed_per_kg, landed_per_litre
       from v_procurement_batch
      where scenario_id = $1
      order by collected_on desc, center_name, shift
      limit $2`,
    [await activeScenarioId(), limit],
  );
}

export async function getTrips(limit = 120): Promise<TripRow[]> {
  return query<TripRow>(
    `select trip_id, to_char(trip_date, 'YYYY-MM-DD') as trip_date, tanker_code, vehicle_no,
            route, distance_km, cost_mode, rate, other_cost, cost_override,
            batch_count::int, dispatched_kg, dispatched_litre, landed_kg, landed_litre,
            shortage_kg, trip_cost, cost_per_kg, cost_per_litre
       from v_tanker_trip
      where scenario_id = $1
      order by trip_date desc, tanker_code
      limit $2`,
    [await activeScenarioId(), limit],
  );
}

export async function getDays(limit = 60): Promise<DayRow[]> {
  return query<DayRow>(
    `select to_char(collected_on, 'YYYY-MM-DD') as collected_on, batch_count::int,
            center_count::int, qty_kg, qty_litre, landed_kg, landed_litre, kg_solids,
            fat_pct, snf_pct, farmer_amount, commission_amount, transport_amount,
            total_cost, landed_per_kg, landed_per_litre, landed_per_kg_solids
       from v_procurement_day
      where scenario_id = $1
      order by collected_on desc
      limit $2`,
    [await activeScenarioId(), limit],
  );
}

export async function getSachivEarnings(): Promise<SachivRow[]> {
  return query<SachivRow>(
    `select center_id, center_code, center_name, sachiv_name,
            to_char(first_collection, 'YYYY-MM-DD') as first_collection,
            to_char(last_collection, 'YYYY-MM-DD') as last_collection,
            batch_count::int, qty_kg, qty_litre, farmer_amount, commission_amount,
            commission_per_kg, commission_per_litre, commission_pct_of_value
       from v_sachiv_commission
      where scenario_id = $1
      order by commission_amount desc nulls last`,
    [await activeScenarioId()],
  );
}

/** Headline numbers for the procurement landing page. */
export async function getProcurementTotals() {
  const row = await one<{
    batch_count: number;
    center_count: number;
    qty_kg: number | null;
    qty_litre: number | null;
    landed_kg: number | null;
    landed_litre: number | null;
    kg_solids: number | null;
    fat_pct: number | null;
    snf_pct: number | null;
    farmer_amount: number | null;
    commission_amount: number | null;
    transport_amount: number | null;
    total_cost: number | null;
    landed_per_kg: number | null;
    landed_per_litre: number | null;
    landed_per_kg_solids: number | null;
  }>(
    `select count(*)::int                     as batch_count,
            count(distinct center_id)::int    as center_count,
            sum(qty_kg)                       as qty_kg,
            sum(qty_litre)                    as qty_litre,
            sum(landed_kg)                    as landed_kg,
            sum(landed_litre)                 as landed_litre,
            sum(kg_solids)                    as kg_solids,
            sum(kg_fat) / nullif(sum(qty_kg), 0) * 100 as fat_pct,
            sum(kg_snf) / nullif(sum(qty_kg), 0) * 100 as snf_pct,
            sum(farmer_amount)                as farmer_amount,
            sum(commission_amount)            as commission_amount,
            sum(transport_amount)             as transport_amount,
            sum(total_cost)                   as total_cost,
            sum(total_cost) / nullif(sum(landed_kg), 0)    as landed_per_kg,
            sum(total_cost) / nullif(sum(landed_litre), 0) as landed_per_litre,
            sum(total_cost) / nullif(sum(kg_solids), 0)    as landed_per_kg_solids
       from v_procurement_batch where scenario_id = $1`,
    [await activeScenarioId()],
  );
  return row;
}

/** Chart + commission terms for one centre, as the pricing engine wants them. */
export async function getPricingContext(centerId: string, rateChartId?: string | null) {
  const center = await one<{
    id: string;
    scenario_id: string;
    rate_chart_id: string | null;
    commission_mode: CommissionMode;
    commission_rate: number | null;
  }>(
    `select id, scenario_id, rate_chart_id, commission_mode, commission_rate
       from procurement_center where id = $1`,
    [centerId],
  );
  if (!center) throw new Error("Collection centre not found");

  const chartId = rateChartId ?? center.rate_chart_id;
  if (!chartId) throw new Error("Pick a rate chart - this centre has no default one");

  const chart = await one<{
    id: string;
    basis: RateBasis;
    rate_solid: number | null;
    rate_fat: number | null;
    rate_snf: number | null;
    flat_rate: number | null;
  }>(
    `select id, basis, rate_solid, rate_fat, rate_snf, flat_rate
       from milk_rate_chart where id = $1`,
    [chartId],
  );
  if (!chart) throw new Error("Rate chart not found");

  return { center, chart, kgPerLitre: await kgPerLitre(center.scenario_id) };
}
