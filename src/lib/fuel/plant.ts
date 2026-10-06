import "server-only";
import { one, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { freezeDay } from "@/lib/daily/compute";

/** A fuel's first price is dated this, meaning "from the start". */
export const FROM_START = "2000-01-01";

export interface PlantFuel {
  id: string;
  code: string;
  name: string;
  unit: string;
  is_active: boolean;
}

export interface PlantFuelRate {
  id: string;
  fuel_id: string;
  effective_from: string;
  rate: number;
}

/** One fuel's line in the day entry. */
export interface PlantFuelEntry {
  fuel_id: string;
  name: string;
  unit: string;
  saved: boolean;            // a quantity is recorded for this day
  qty: number;               // saved quantity, else 0
  rate: number | null;       // the price in force on this day (null = no price yet)
  rate_from: string | null;  // when that price started
}

export interface PlantFuelHistoryDay {
  day: string;
  total: number;
  milk_processed_l: number | null;
  by_fuel: Record<string, { qty: number; rate: number | null; cost: number | null }>;
}

/** Every plant fuel, coal first. */
export async function getPlantFuels(): Promise<PlantFuel[]> {
  return query<PlantFuel>(
    `select id, code, name, unit, is_active from plant_fuel where scenario_id = $1 order by sort_order, name`,
    [await activeScenarioId()],
  );
}

/** Every price every fuel has had, newest first. */
export async function getPlantFuelRates(): Promise<PlantFuelRate[]> {
  return query<PlantFuelRate>(
    `select r.id, r.fuel_id, to_char(r.effective_from, 'YYYY-MM-DD') as effective_from, r.rate
       from plant_fuel_rate r join plant_fuel f on f.id = r.fuel_id
      where f.scenario_id = $1
      order by r.effective_from desc`,
    [await activeScenarioId()],
  );
}

/**
 * The day entry for `date`: every active fuel (and any inactive one already
 * recorded that day) with its saved quantity and the price in force that day.
 */
export async function getPlantFuelDay(date: string): Promise<PlantFuelEntry[]> {
  return query<PlantFuelEntry>(
    `select f.id as fuel_id, f.name, f.unit,
            (d.id is not null) as saved,
            coalesce(d.qty, 0) as qty,
            r.rate, to_char(r.effective_from, 'YYYY-MM-DD') as rate_from
       from plant_fuel f
       left join plant_fuel_day d on d.fuel_id = f.id and d.day = $2
       left join lateral (
         select x.rate, x.effective_from from plant_fuel_rate x
          where x.fuel_id = f.id and x.effective_from <= $2
          order by x.effective_from desc limit 1
       ) r on true
      where f.scenario_id = $1 and (f.is_active or d.id is not null)
      order by f.sort_order, f.name`,
    [await activeScenarioId(), date],
  );
}

/** Day by day, newest first: each fuel's quantity, the price that day and its cost, the total, and the day's milk. */
export async function getPlantFuelHistory(limit = 60): Promise<PlantFuelHistoryDay[]> {
  const scenario = await activeScenarioId();
  const rows = await query<{ day: string; fuel_id: string; qty: number; rate: number | null; cost: number | null; milk_processed_l: number | null }>(
    `with days as (
       select distinct day from plant_fuel_day where scenario_id = $1 order by day desc limit $2
     )
     select to_char(v.day, 'YYYY-MM-DD') as day, v.fuel_id, v.qty, v.rate, v.cost, p.milk_processed_l
       from v_plant_fuel_day v
       join days using (day)
       left join production_day p on p.scenario_id = v.scenario_id and p.day = v.day
      where v.scenario_id = $1
      order by v.day desc`,
    [scenario, limit],
  );
  const byDay = new Map<string, PlantFuelHistoryDay>();
  for (const r of rows) {
    let day = byDay.get(r.day);
    if (!day) {
      day = { day: r.day, total: 0, milk_processed_l: r.milk_processed_l, by_fuel: {} };
      byDay.set(r.day, day);
    }
    day.by_fuel[r.fuel_id] = { qty: Number(r.qty), rate: r.rate === null ? null : Number(r.rate), cost: r.cost === null ? null : Number(r.cost) };
    day.total += Number(r.cost ?? 0);
  }
  return [...byDay.values()];
}

/**
 * Writes each date's plant fuel total (at the prices in force those days)
 * into that production day's "Fuel - Production in plant" cost
 * (fuel_production), creating the production day if needed.
 */
export async function syncPlantFuelDays(scenario: string, dates: string[]) {
  const head = await one<{ id: string }>(
    `select id from overhead_head where scenario_id = $1 and code = 'fuel_production'`, [scenario]);
  if (!head) return;

  for (const date of new Set(dates)) {
    const sum = await one<{ n: number; total: number | null }>(
      `select count(*)::int as n, sum(cost) as total from v_plant_fuel_day where scenario_id = $1 and day = $2`,
      [scenario, date],
    );
    let dayId: string | undefined;
    if (sum?.n) {
      dayId = (await one<{ id: string }>(
        `insert into production_day (scenario_id, day) values ($1, $2)
         on conflict (scenario_id, day) do update set day = excluded.day returning id`,
        [scenario, date],
      ))?.id;
    } else {
      dayId = (await one<{ id: string }>(
        `select id from production_day where scenario_id = $1 and day = $2`, [scenario, date]))?.id;
    }
    if (!dayId) continue;

    await query(
      `insert into daily_overhead (day_id, head_id, qty, rate, amount) values ($1, $2, null, null, $3)
       on conflict (day_id, head_id) do update set qty = null, rate = null, amount = excluded.amount`,
      [dayId, head.id, sum?.n ? (sum.total ?? 0) : null],
    );
    await freezeDay(dayId);
  }
}
