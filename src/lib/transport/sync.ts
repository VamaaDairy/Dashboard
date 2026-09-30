import "server-only";
import { one, query } from "@/lib/db";
import { freezeDay } from "@/lib/daily/compute";
import { TRANSPORT_SECTIONS } from "@/lib/transport/sections";
import type { TransportSection } from "@/lib/transport/data";

/**
 * Writes each date's transport total into that day's fuel cost head
 * (fuel_procurement / fuel_delivery), so it is spread over the day's
 * production like every other shared cost. The production day is created if
 * it does not exist yet. A date with no runs left has its amount cleared.
 */
export async function syncFuelDays(scenario: string, section: TransportSection, dates: string[]) {
  const head = await one<{ id: string }>(
    `select id from overhead_head where scenario_id = $1 and code = $2`,
    [scenario, TRANSPORT_SECTIONS[section].fuelColumn],
  );
  if (!head) return; // the fuel head has been removed - nothing to write into

  for (const date of new Set(dates)) {
    const sum = await one<{ runs: number; total: number | null }>(
      `select count(*)::int as runs, sum(cost) as total
         from v_transport_run where scenario_id = $1 and section = $2 and run_date = $3`,
      [scenario, section, date],
    );

    let dayId: string | undefined;
    if (sum?.runs) {
      const day = await one<{ id: string }>(
        `insert into production_day (scenario_id, day) values ($1, $2)
         on conflict (scenario_id, day) do update set day = excluded.day
         returning id`,
        [scenario, date],
      );
      dayId = day?.id;
    } else {
      const day = await one<{ id: string }>(
        `select id from production_day where scenario_id = $1 and day = $2`, [scenario, date]);
      dayId = day?.id;
    }
    if (!dayId) continue;

    await query(
      `insert into daily_overhead (day_id, head_id, qty, rate, amount)
       values ($1, $2, null, null, $3)
       on conflict (day_id, head_id) do update
         set qty = null, rate = null, amount = excluded.amount`,
      [dayId, head.id, sum?.runs ? (sum.total ?? 0) : null],
    );
    await freezeDay(dayId);
  }
}
