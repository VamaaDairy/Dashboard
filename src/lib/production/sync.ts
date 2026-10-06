import "server-only";
import { one } from "@/lib/db";
import { freezeDay } from "@/lib/daily/compute";

/**
 * Sets each date's "milk processed" to the litres its bulk batches drew from
 * the tanks - the base every shared cost of the day (electricity, fuel,
 * labour, transport) is divided over - and re-costs the day.
 */
export async function syncMilkProcessed(scenario: string, dates: string[]) {
  for (const date of new Set(dates)) {
    const sum = await one<{ litres: number | null }>(
      `select sum(milk_litre) as litres from bulk_batch where scenario_id = $1 and batch_date = $2`, [scenario, date]);
    const litres = sum?.litres ? Number(sum.litres) : null;
    const day = litres
      ? await one<{ id: string }>(
          `insert into production_day (scenario_id, day, milk_processed_l) values ($1, $2, $3)
           on conflict (scenario_id, day) do update set milk_processed_l = excluded.milk_processed_l returning id`,
          [scenario, date, litres])
      : await one<{ id: string }>(
          `update production_day set milk_processed_l = null where scenario_id = $1 and day = $2 returning id`, [scenario, date]);
    if (day) await freezeDay(day.id);
  }
}
