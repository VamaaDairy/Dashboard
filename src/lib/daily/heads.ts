import "server-only";
import { one, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import type { LabourRateRow, LabourShifts } from "@/lib/daily/labour";
import type { MeterReading } from "@/lib/daily/meter";

/** Electricity's first price is dated this, meaning "from the start". */
export const FROM_START = "2000-01-01";

/** One day of a head entered by quantity: electricity units, or labourers. */
export interface HeadDay {
  day: string;
  qty: number | null;      // units, or labourers
  rate: number | null;     // ₹ per unit, or ₹ per labourer
  amount: number | null;   // the day's cost
  milk_processed_l: number | null;
}

export interface ElectricityRate {
  id: string;
  effective_from: string;
  rate: number;
}

/** The days a head was entered, newest first. */
export async function getHeadDays(code: "electricity" | "labour", limit = 60): Promise<HeadDay[]> {
  return query<HeadDay>(
    `select to_char(d.day, 'YYYY-MM-DD') as day, o.qty, o.rate, o.amount, d.milk_processed_l
       from daily_overhead o
       join production_day d on d.id = o.day_id
       join overhead_head h on h.id = o.head_id
      where d.scenario_id = $1 and h.code = $2 and o.amount is not null
      order by d.day desc limit $3`,
    [await activeScenarioId(), code, limit],
  );
}

/** One date's entry for a head, if any. */
export async function getHeadDay(code: "electricity" | "labour", date: string): Promise<HeadDay | null> {
  return one<HeadDay>(
    `select to_char(d.day, 'YYYY-MM-DD') as day, o.qty, o.rate, o.amount, d.milk_processed_l
       from production_day d
       join overhead_head h on h.scenario_id = d.scenario_id and h.code = $2
       left join daily_overhead o on o.day_id = d.id and o.head_id = h.id
      where d.scenario_id = $1 and d.day = $3`,
    [await activeScenarioId(), code, date],
  );
}

/** The day / night / contract split of each labour day that has one, keyed by date. */
export async function getLabourShifts(): Promise<Record<string, LabourShifts>> {
  const rows = await query<{ day: string; day_regular: number; day_special: number; night: number; contract: number }>(
    `select to_char(d.day, 'YYYY-MM-DD') as day, l.day_regular, l.day_special, l.night, l.contract
       from labour_day l join production_day d on d.id = l.day_id where d.scenario_id = $1`,
    [await activeScenarioId()],
  );
  return Object.fromEntries(rows.map((r) => [r.day, {
    dayRegular: r.day_regular, daySpecial: r.day_special, night: r.night, contract: r.contract,
  }]));
}

/** Every set of labour rates, newest first. */
export async function getLabourRates(): Promise<LabourRateRow[]> {
  const rows = await query<{ id: string; effective_from: string; day_regular: string; day_special: string; night: string; contract: string }>(
    `select id, to_char(effective_from, 'YYYY-MM-DD') as effective_from, day_regular, day_special, night, contract
       from labour_rate where scenario_id = $1 order by effective_from desc`,
    [await activeScenarioId()],
  );
  return rows.map((r) => ({
    id: r.id, effective_from: r.effective_from,
    dayRegular: Number(r.day_regular), daySpecial: Number(r.day_special), night: Number(r.night), contract: Number(r.contract),
  }));
}

/** Every electricity price, newest first. */
export async function getElectricityRates(): Promise<ElectricityRate[]> {
  return query<ElectricityRate>(
    `select id, to_char(effective_from, 'YYYY-MM-DD') as effective_from, rate
       from electricity_rate where scenario_id = $1 order by effective_from desc`,
    [await activeScenarioId()],
  );
}

/** The most recent meter readings, newest first. */
export async function getMeterReadings(limit = 60): Promise<MeterReading[]> {
  return query<MeterReading>(
    `select to_char(day, 'YYYY-MM-DD') as day, kwh, kvarh, kva, kvah, pf
       from electricity_reading where scenario_id = $1 order by day desc limit $2`,
    [await activeScenarioId(), limit],
  );
}
