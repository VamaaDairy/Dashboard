"use server";

import { revalidatePath } from "next/cache";
import { one, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { freezeDay } from "@/lib/daily/compute";
import { DEFAULT_LABOUR_RATES, labourAmount, labourCount, type LabourRates, type LabourShifts } from "@/lib/daily/labour";
import { meterUnits } from "@/lib/daily/meter";
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

/** A reading field: blank means not entered. */
function optional(raw: string, label: string): number | null {
  return String(raw ?? "").trim() === "" ? null : amount(raw, label);
}

/**
 * Saves a morning meter reading, then re-works every day's units from the readings
 * either side of it and stores them with the readings.
 */
export async function saveMeterReading(
  date: string,
  f: { kwh: string; kvarh: string; kva: string; kvah: string; pf: string },
): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");
    const scenario = await activeScenarioId();
    if (String(f.kwh ?? "").trim() === "") throw new Error("Enter the kWh reading");
    const kwh = amount(f.kwh, "kWh");
    await query(
      `insert into electricity_reading (scenario_id, day, kwh, kvarh, kva, kvah, pf) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (scenario_id, day) do update
         set kwh = excluded.kwh, kvarh = excluded.kvarh, kva = excluded.kva, kvah = excluded.kvah, pf = excluded.pf`,
      [scenario, date, kwh, optional(f.kvarh, "kVArh"), optional(f.kva, "kVA"), optional(f.kvah, "kVAh"), optional(f.pf, "PF")],
    );
    // Every pair is re-worked, so days saved under an older formula are corrected too.
    const pairs = await query<{ day: string; kwh: number; next_kwh: number; kvah: number | null; next_kvah: number | null }>(
      `select to_char(r.day, 'YYYY-MM-DD') as day, r.kwh, n.kwh as next_kwh, r.kvah, n.kvah as next_kvah
         from electricity_reading r
         join electricity_reading n on n.scenario_id = r.scenario_id and n.day = r.day + 1
        where r.scenario_id = $1`,
      [scenario],
    );
    for (const p of pairs) {
      const kwhUnits = meterUnits(Number(p.kwh), Number(p.next_kwh));
      const hasKvah = p.kvah !== null && p.next_kvah !== null;
      // Billed on kVAh; a day with no kVAh reading falls back to its kWh units.
      const units = hasKvah ? meterUnits(Number(p.kvah), Number(p.next_kvah)) : kwhUnits;
      await query(
        `update electricity_reading set kwh_diff = $3, kwh_units = $4, kvah_diff = $5, kvah_units = $6 where scenario_id = $1 and day = $2`,
        [
          scenario, p.day,
          Math.round((Number(p.next_kwh) - Number(p.kwh)) * 100) / 100, kwhUnits,
          hasKvah ? Math.round((Number(p.next_kvah) - Number(p.kvah)) * 100) / 100 : null,
          hasKvah ? units : null,
        ],
      );
      const rate = await electricityRateOn(scenario, p.day);
      if (rate === null) throw new Error(`No electricity price for ${p.day} yet - set one first`);
      await writeHead(scenario, "electricity", p.day, { qty: units, rate, amount: Math.round(units * rate * 100) / 100 });
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

async function labourRatesOn(scenario: string, date: string): Promise<LabourRates> {
  const r = await one<{ day_regular: string; day_special: string; night: string; contract: string }>(
    `select day_regular, day_special, night, contract from labour_rate
      where scenario_id = $1 and effective_from <= $2 order by effective_from desc limit 1`,
    [scenario, date],
  );
  if (!r) return DEFAULT_LABOUR_RATES;
  return { dayRegular: Number(r.day_regular), daySpecial: Number(r.day_special), night: Number(r.night), contract: Number(r.contract) };
}

/** Stores a day's split and writes its cost at the rates in force that date. All 0 clears the day. */
async function writeLabour(scenario: string, date: string, shifts: LabourShifts) {
  const workers = labourCount(shifts);
  if (workers === 0) {
    await writeHead(scenario, "labour", date, null);
  } else {
    const total = Math.round(labourAmount(shifts, await labourRatesOn(scenario, date)) * 100) / 100;
    await writeHead(scenario, "labour", date, { qty: workers, rate: Math.round((total / workers) * 100) / 100, amount: total });
  }
  const dayId = (await one<{ id: string }>(`select id from production_day where scenario_id = $1 and day = $2`, [scenario, date]))?.id;
  if (!dayId) return;
  if (workers === 0) await query(`delete from labour_day where day_id = $1`, [dayId]);
  else await query(
    `insert into labour_day (day_id, day_regular, day_special, night, contract) values ($1, $2, $3, $4, $5)
     on conflict (day_id) do update set day_regular = excluded.day_regular, day_special = excluded.day_special,
       night = excluded.night, contract = excluded.contract`,
    [dayId, shifts.dayRegular, shifts.daySpecial, shifts.night, shifts.contract],
  );
}

/** A day's labour by section (day, special day, night, contract), costed at that day's rates. */
export async function saveLabourDay(date: string, raw: Record<keyof LabourShifts, string>): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");
    const scenario = await activeScenarioId();
    const count = (k: keyof LabourShifts, name: string) => {
      const v = amount(raw[k], name);
      if (!Number.isInteger(v)) throw new Error(`${name} must be a whole number`);
      return v;
    };
    await writeLabour(scenario, date, {
      dayRegular: count("dayRegular", "Day"), daySpecial: count("daySpecial", "Special day"),
      night: count("night", "Night"), contract: count("contract", "Contract"),
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * New labour rates from `effectiveFrom` until the next change. Days before keep
 * their rates; days already entered from that date on are re-costed.
 */
export async function setLabourRates(effectiveFrom: string, raw: Record<keyof LabourRates, string>): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new Error("Pick the date the new rates start");
    const rate = (k: keyof LabourRates, name: string) => {
      if (String(raw[k] ?? "").trim() === "") throw new Error(`Enter the ${name} rate`);
      return amount(raw[k], `${name} rate`);
    };
    const r = {
      dayRegular: rate("dayRegular", "day"), daySpecial: rate("daySpecial", "special day"),
      night: rate("night", "night"), contract: rate("contract", "contract"),
    };
    const scenario = await activeScenarioId();
    await query(
      `insert into labour_rate (scenario_id, effective_from, day_regular, day_special, night, contract)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (scenario_id, effective_from) do update set day_regular = excluded.day_regular,
         day_special = excluded.day_special, night = excluded.night, contract = excluded.contract`,
      [scenario, effectiveFrom, r.dayRegular, r.daySpecial, r.night, r.contract],
    );
    const days = await query<{ day: string; day_regular: number; day_special: number; night: number; contract: number }>(
      `select to_char(d.day, 'YYYY-MM-DD') as day, l.day_regular, l.day_special, l.night, l.contract
         from labour_day l join production_day d on d.id = l.day_id
        where d.scenario_id = $1 and d.day >= $2`,
      [scenario, effectiveFrom],
    );
    for (const d of days) {
      await writeLabour(scenario, d.day, { dayRegular: d.day_regular, daySpecial: d.day_special, night: d.night, contract: d.contract });
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
