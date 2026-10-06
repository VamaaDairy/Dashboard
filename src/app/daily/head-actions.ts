"use server";

import { revalidatePath } from "next/cache";
import { one, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { freezeDay } from "@/lib/daily/compute";
import type { Result } from "@/app/tanks/actions";

function amount(raw: string, label: string): number {
  const t = String(raw ?? "").replace(/,/g, "").trim();
  if (t === "") return 0;
  const v = Number(t);
  if (!Number.isFinite(v) || v < 0) throw new Error(`${label}: "${raw}" is not a valid number`);
  return v;
}

function refresh() {
  revalidatePath("/electricity");
  revalidatePath("/labour");
  revalidatePath("/daily", "layout");
}

/**
 * Writes one head's figures onto a date's production day (creating the day if
 * needed), or clears them when `values` is null, then re-costs the day.
 */
async function writeHead(scenario: string, code: string, date: string,
  values: { qty: number; rate: number | null; amount: number } | null) {
  const head = await one<{ id: string }>(`select id from overhead_head where scenario_id = $1 and code = $2`, [scenario, code]);
  if (!head) throw new Error(`The ${code} cost head is missing - run the overhead-heads seed`);

  let dayId: string | undefined;
  if (values) {
    dayId = (await one<{ id: string }>(
      `insert into production_day (scenario_id, day) values ($1, $2)
       on conflict (scenario_id, day) do update set day = excluded.day returning id`,
      [scenario, date],
    ))?.id;
  } else {
    dayId = (await one<{ id: string }>(`select id from production_day where scenario_id = $1 and day = $2`, [scenario, date]))?.id;
  }
  if (!dayId) return;

  if (values) {
    await query(
      `insert into daily_overhead (day_id, head_id, qty, rate, amount) values ($1, $2, $3, $4, $5)
       on conflict (day_id, head_id) do update set qty = excluded.qty, rate = excluded.rate, amount = excluded.amount`,
      [dayId, head.id, values.qty, values.rate, values.amount],
    );
  } else {
    await query(`delete from daily_overhead where day_id = $1 and head_id = $2`, [dayId, head.id]);
  }
  await freezeDay(dayId);
}

async function electricityRateOn(scenario: string, date: string): Promise<number | null> {
  const r = await one<{ rate: number }>(
    `select rate from electricity_rate where scenario_id = $1 and effective_from <= $2
      order by effective_from desc limit 1`,
    [scenario, date],
  );
  return r ? Number(r.rate) : null;
}

/** A day's electricity: the units used. The cost is units x the price per unit in force that day. 0 clears the day. */
export async function saveElectricityDay(date: string, rawUnits: string): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");
    const scenario = await activeScenarioId();
    const units = amount(rawUnits, "Units");
    if (units === 0) {
      await writeHead(scenario, "electricity", date, null);
    } else {
      const rate = await electricityRateOn(scenario, date);
      if (rate === null) throw new Error(`No electricity price for ${date} yet - set one first`);
      await writeHead(scenario, "electricity", date, { qty: units, rate, amount: Math.round(units * rate * 100) / 100 });
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * A new price per unit from `effectiveFrom` until the next price. Days before
 * keep their price; days already entered from that date on are re-costed.
 */
export async function setElectricityRate(effectiveFrom: string, raw: string): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new Error("Pick the date the new price starts");
    const t = String(raw ?? "").replace(/,/g, "").trim();
    const rate = Number(t);
    if (t === "" || !Number.isFinite(rate) || rate < 0) throw new Error("Enter a price per unit, e.g. 14");
    const scenario = await activeScenarioId();
    await query(
      `insert into electricity_rate (scenario_id, effective_from, rate) values ($1, $2, $3)
       on conflict (scenario_id, effective_from) do update set rate = excluded.rate`,
      [scenario, effectiveFrom, rate],
    );
    const days = await query<{ day: string; qty: number }>(
      `select to_char(d.day, 'YYYY-MM-DD') as day, o.qty
         from daily_overhead o join production_day d on d.id = o.day_id
         join overhead_head h on h.id = o.head_id
        where d.scenario_id = $1 and h.code = 'electricity' and o.qty is not null and d.day >= $2`,
      [scenario, effectiveFrom],
    );
    for (const d of days) {
      const r = await electricityRateOn(scenario, d.day);
      if (r !== null) await writeHead(scenario, "electricity", d.day, { qty: Number(d.qty), rate: r, amount: Math.round(Number(d.qty) * r * 100) / 100 });
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** A day's labour: how many labourers, and the total paid. Both 0 clears the day. */
export async function saveLabourDay(date: string, rawWorkers: string, rawAmount: string): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");
    const scenario = await activeScenarioId();
    const workers = amount(rawWorkers, "Labourers");
    const total = amount(rawAmount, "Total amount");
    if (!Number.isInteger(workers)) throw new Error("Labourers must be a whole number");
    if (workers === 0 && total === 0) {
      await writeHead(scenario, "labour", date, null);
    } else {
      if (workers === 0) throw new Error("Enter how many labourers worked");
      if (total === 0) throw new Error("Enter the total amount paid");
      await writeHead(scenario, "labour", date, { qty: workers, rate: Math.round((total / workers) * 100) / 100, amount: total });
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
