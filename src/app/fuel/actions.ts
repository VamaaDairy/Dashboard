"use server";

import { revalidatePath } from "next/cache";
import { query, tx } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { FROM_START, syncPlantFuelDays } from "@/lib/fuel/plant";
import type { Result } from "@/app/tanks/actions";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function price(raw: string, label: string): number {
  const t = String(raw ?? "").replace(/,/g, "").trim();
  const v = Number(t);
  if (t === "" || !Number.isFinite(v) || v < 0) throw new Error(`${label}: enter a price, e.g. 6`);
  return v;
}

function refresh() {
  revalidatePath("/fuel", "layout");
  revalidatePath("/daily", "layout");
}

/**
 * Saves one day of plant fuel - only how much of each fuel was burned; the
 * price is whatever was in force that day. A fuel left at 0 wasn't used and
 * has no row. The day's total then goes into the production day's fuel cost.
 */
export async function savePlantFuelDay(date: string, rows: { fuel_id: string; qty: string }[]): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");
    const scenario = await activeScenarioId();

    await tx(async (client) => {
      for (const r of rows) {
        const fuel = await client.query<{ name: string; has_rate: boolean }>(
          `select f.name, exists (select 1 from plant_fuel_rate x where x.fuel_id = f.id and x.effective_from <= $3) as has_rate
             from plant_fuel f where f.id = $1 and f.scenario_id = $2`,
          [r.fuel_id, scenario, date],
        );
        const name = fuel.rows[0]?.name;
        if (!name) throw new Error("A fuel in the list no longer exists - reload the page");
        const t = String(r.qty ?? "").replace(/,/g, "").trim();
        const qty = t === "" ? 0 : Number(t);
        if (!Number.isFinite(qty) || qty < 0) throw new Error(`${name} quantity: "${r.qty}" is not a valid number`);
        if (qty === 0) {
          await client.query(`delete from plant_fuel_day where fuel_id = $1 and day = $2`, [r.fuel_id, date]);
          continue;
        }
        if (!fuel.rows[0].has_rate) throw new Error(`${name} has no price for ${date} yet - set one under Fuels`);
        await client.query(
          `insert into plant_fuel_day (scenario_id, fuel_id, day, qty) values ($1, $2, $3, $4)
           on conflict (fuel_id, day) do update set qty = excluded.qty`,
          [scenario, r.fuel_id, date, qty],
        );
      }
    });

    await syncPlantFuelDays(scenario, [date]);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * A new price for a fuel, in force from `effective_from` until the next one.
 * Days before it keep the price they had; days already entered from that date
 * on are re-costed at the new price. A price on a date that already has one
 * replaces it.
 */
export async function setPlantFuelRate(fuelId: string, effectiveFrom: string, raw: string): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new Error("Pick the date the new price starts");
    const scenario = await activeScenarioId();
    const fuel = await query<{ name: string }>(`select name from plant_fuel where id = $1 and scenario_id = $2`, [fuelId, scenario]);
    if (!fuel.length) throw new Error("That fuel no longer exists - reload the page");
    const rate = price(raw, `${fuel[0].name} price`);

    await query(
      `insert into plant_fuel_rate (fuel_id, effective_from, rate) values ($1, $2, $3)
       on conflict (fuel_id, effective_from) do update set rate = excluded.rate`,
      [fuelId, effectiveFrom, rate],
    );
    const affected = await query<{ d: string }>(
      `select to_char(day, 'YYYY-MM-DD') as d from plant_fuel_day where fuel_id = $1 and day >= $2`, [fuelId, effectiveFrom]);
    await syncPlantFuelDays(scenario, affected.map((a) => a.d));
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Adds a fuel below coal with its price from the start, or renames one / changes its unit / takes it off the list. */
export async function savePlantFuel(form: FormData): Promise<Result> {
  try {
    const scenario = await activeScenarioId();
    const id = text(form, "id");
    const name = text(form, "name");
    if (!name) throw new Error("Give the fuel a name");
    const unit = text(form, "unit") || "kg";
    const active = form.get("is_active") !== null;

    if (id) {
      await query(`update plant_fuel set name = $2, unit = $3, is_active = $4 where id = $1 and scenario_id = $5`,
        [id, name, unit, active, scenario]);
    } else {
      const rate = price(text(form, "rate"), "Price");
      const code = slug(name);
      if (!/^[a-z][a-z0-9_]*$/.test(code)) throw new Error("Use a name that starts with a letter");
      const taken = await query(`select 1 from plant_fuel where scenario_id = $1 and code = $2`, [scenario, code]);
      if (taken.length) throw new Error(`"${name}" is already on the list`);
      await tx(async (client) => {
        const f = await client.query<{ id: string }>(
          `insert into plant_fuel (scenario_id, code, name, unit, is_active, sort_order)
           values ($1, $2, $3, $4, $5, (select coalesce(max(sort_order), 0) + 1 from plant_fuel where scenario_id = $1))
           returning id`,
          [scenario, code, name, unit, active],
        );
        await client.query(`insert into plant_fuel_rate (fuel_id, effective_from, rate) values ($1, $2, $3)`,
          [f.rows[0].id, FROM_START, rate]);
      });
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
