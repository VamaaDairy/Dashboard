import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import type { CostBasis } from "@/lib/transport/sections";

export type TransportSection = "milk_to_plant" | "delivery";

export interface TransporterRow {
  id: string;
  code: string;
  name: string;
  distance_km: number | null;           // the usual day, for pre-filling
  trips_per_day: number | null;
  diesel_litre_per_day: number | null;
  is_active: boolean;
  notes: string | null;
}

export interface RateRow {
  id: string;
  transporter_id: string;
  effective_from: string;
  cost_basis: CostBasis;
  rate: number | null;                  // null for diesel - charged at the diesel price
  notes: string | null;
}

export interface DieselPriceRow {
  id: string;
  effective_from: string;
  price_per_litre: number;
  notes: string | null;
}

/** One transporter's line in the day entry for a given date. */
export interface DayEntryRow {
  transporter_id: string;
  name: string;
  cost_basis: CostBasis | null;   // from the rate in force that day; null = no rate yet
  rate: number | null;            // ₹ per km / trip, or the diesel price that day
  saved: boolean;                 // a run is already recorded for this date
  distance_km: number | null;     // saved value, else the last run before, else the usual
  trips: number | null;
  diesel_litre: number | null;
}

export interface HistoryRun {
  distance_km: number | null;
  trips: number | null;
  diesel_litre: number | null;
  cost: number | null;
}

export interface HistoryDay {
  run_date: string;
  milk_processed_l: number | null;
  total: number;
  missing: number;                // runs that could not be costed (no rate, or nothing entered)
  by_transporter: Record<string, HistoryRun>;
}

export { today } from "@/lib/dates";

/** One section's transporters, for its Transport and Fuel pages. */
export async function getTransporters(section: TransportSection): Promise<TransporterRow[]> {
  return query<TransporterRow>(
    `select id, code, name, distance_km, trips_per_day, diesel_litre_per_day, is_active, notes
       from transporter
      where scenario_id = $1 and section = $2
      order by sort_order, name`,
    [await activeScenarioId(), section],
  );
}

/** Every rate ever set for a section's transporters, newest first. */
export async function getRates(section: TransportSection): Promise<RateRow[]> {
  return query<RateRow>(
    `select r.id, r.transporter_id, to_char(r.effective_from, 'YYYY-MM-DD') as effective_from,
            r.cost_basis, r.rate, r.notes
       from transporter_rate r
       join transporter t on t.id = r.transporter_id
      where r.scenario_id = $1 and t.section = $2
      order by r.effective_from desc`,
    [await activeScenarioId(), section],
  );
}

/** Every diesel price ever set, newest first. */
export async function getDieselPrices(): Promise<DieselPriceRow[]> {
  return query<DieselPriceRow>(
    `select id, to_char(effective_from, 'YYYY-MM-DD') as effective_from, price_per_litre, notes
       from diesel_price
      where scenario_id = $1
      order by effective_from desc`,
    [await activeScenarioId()],
  );
}

/**
 * The day entry for `date`: every active transporter with the rate in force
 * that day and its km / trips / litres. A day already saved shows what was
 * saved; a new day starts from each transporter's last run, or its usual day
 * if it has none.
 */
export async function getDayEntry(section: TransportSection, date: string): Promise<DayEntryRow[]> {
  return query<DayEntryRow>(
    `select t.id as transporter_id, t.name, rt.cost_basis,
            case when rt.cost_basis = 'diesel' then dp.price_per_litre else rt.rate end as rate,
            (saved.id is not null) as saved,
            case when saved.id is not null then saved.distance_km
                 else coalesce(last.distance_km, t.distance_km) end as distance_km,
            case when saved.id is not null then saved.trips
                 else coalesce(last.trips, t.trips_per_day) end as trips,
            case when saved.id is not null then saved.diesel_litre
                 else coalesce(last.diesel_litre, t.diesel_litre_per_day) end as diesel_litre
       from transporter t
       left join transport_run saved on saved.transporter_id = t.id and saved.run_date = $3
       left join lateral (
         select r.distance_km, r.trips, r.diesel_litre from transport_run r
          where r.transporter_id = t.id and r.run_date < $3
          order by r.run_date desc limit 1
       ) last on true
       left join lateral (
         select x.cost_basis, x.rate from transporter_rate x
          where x.transporter_id = t.id and x.effective_from <= $3
          order by x.effective_from desc limit 1
       ) rt on true
       left join lateral (
         select p.price_per_litre from diesel_price p
          where p.scenario_id = t.scenario_id and p.effective_from <= $3
          order by p.effective_from desc limit 1
       ) dp on true
      where t.scenario_id = $1 and t.section = $2 and (t.is_active or saved.id is not null)
      order by t.sort_order, t.name`,
    [await activeScenarioId(), section, date],
  );
}

/** Day-by-day cost for a section, newest first, with that day's milk for the per-litre figure. */
export async function getHistory(section: TransportSection, limit = 60): Promise<HistoryDay[]> {
  const scenario = await activeScenarioId();
  const rows = await query<HistoryRun & {
    run_date: string; transporter_id: string; milk_processed_l: number | null;
  }>(
    `with days as (
       select distinct run_date from v_transport_run
        where scenario_id = $1 and section = $2
        order by run_date desc limit $3
     )
     select to_char(v.run_date, 'YYYY-MM-DD') as run_date, v.transporter_id,
            v.distance_km, v.trips, v.diesel_litre, v.cost, d.milk_processed_l
       from v_transport_run v
       join days using (run_date)
       left join production_day d on d.scenario_id = v.scenario_id and d.day = v.run_date
      where v.scenario_id = $1 and v.section = $2
      order by v.run_date desc`,
    [scenario, section, limit],
  );

  const byDay = new Map<string, HistoryDay>();
  for (const r of rows) {
    let day = byDay.get(r.run_date);
    if (!day) {
      day = { run_date: r.run_date, milk_processed_l: r.milk_processed_l, total: 0, missing: 0, by_transporter: {} };
      byDay.set(r.run_date, day);
    }
    day.by_transporter[r.transporter_id] = {
      distance_km: r.distance_km, trips: r.trips, diesel_litre: r.diesel_litre, cost: r.cost,
    };
    if (r.cost === null) day.missing += 1;
    else day.total += r.cost;
  }
  return [...byDay.values()];
}
