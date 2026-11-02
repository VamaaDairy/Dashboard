"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { query, tx } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { recomputeTank, type Direction } from "@/lib/tanks/engine";
import { today } from "@/lib/dates";

export type Result = { ok: true } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const optionalText = (form: FormData, key: string) => text(form, key) || null;

function numberOrNull(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (t === "") return null;
  const v = Number(t);
  if (!Number.isFinite(v)) throw new Error(`"${raw}" is not a number`);
  return v;
}

const numberField = (form: FormData, key: string) => numberOrNull(text(form, key));

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function refresh() {
  revalidatePath("/tanks", "layout");
  revalidatePath("/");
}

async function guard(fn: () => Promise<void>): Promise<Result> {
  try {
    await fn();
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function saveTank(form: FormData): Promise<Result> {
  return guard(async () => {
    const id = text(form, "id");
    const name = text(form, "name");
    if (!name) throw new Error("Give the tank a name");

    const fields = [
      name,
      numberField(form, "capacity_litre"),
      form.get("is_active") !== null,
      optionalText(form, "notes"),
    ];

    if (id) {
      await tx(async (client) => {
        await client.query(
          `update tank set name = $2, capacity_litre = $3, is_active = $4, notes = $5 where id = $1`,
          [id, ...fields],
        );
        // a smaller capacity must still hold every balance the ledger has reached
        await recomputeTank(client, id);
      });
      return;
    }

    const code = slug(text(form, "code") || name);
    if (!/^[a-z][a-z0-9_]*$/.test(code)) throw new Error("Use a name that starts with a letter");
    await query(
      `insert into tank (scenario_id, code, name, capacity_litre, is_active, notes, sort_order)
       values ($1, $2, $3, $4, $5, $6,
               (select coalesce(max(sort_order), 0) + 1 from tank where scenario_id = $1))`,
      [await activeScenarioId(), code, ...fields],
    );
  });
}

export async function addMovement(form: FormData): Promise<Result> {
  return guard(async () => {
    const tankId = text(form, "tank_id");
    if (!tankId) throw new Error("Pick a tank");

    const direction = text(form, "direction") as Direction;
    if (direction !== "in" && direction !== "out") throw new Error("Pick in or out");

    const qty = numberField(form, "qty_litre");
    if (qty === null || qty <= 0) throw new Error("Enter the quantity in litres");

    const date = text(form, "movement_date") || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");

    if (direction === "in") {
      const fat = numberField(form, "fat_pct");
      const snf = numberField(form, "snf_pct");
      const cost = numberField(form, "cost_per_litre");
      if (fat === null || snf === null) throw new Error("Enter the fat % and SNF % of what's going in");
      if (fat < 0 || fat > 20) throw new Error(`Fat ${fat}% doesn't look right - enter it as a percentage, e.g. 4.5`);
      if (snf < 0 || snf > 20) throw new Error(`SNF ${snf}% doesn't look right - enter it as a percentage, e.g. 8.5`);
      if (cost === null) throw new Error("Enter the cost per litre of what's going in");
      if (cost < 0) throw new Error("Cost per litre can't be negative");

      await tx(async (client) => {
        await client.query(
          `insert into tank_movement
             (scenario_id, tank_id, movement_date, direction, qty_litre, fat_pct, snf_pct,
              cost_per_litre, notes)
           values ($1, $2, $3, 'in', $4, $5, $6, $7, $8)`,
          [await activeScenarioId(), tankId, date, qty, fat, snf, cost, optionalText(form, "notes")],
        );
        await recomputeTank(client, tankId);
      });
      return;
    }

    await tx(async (client) => {
      await client.query(
        `insert into tank_movement (scenario_id, tank_id, movement_date, direction, qty_litre, notes)
         values ($1, $2, $3, 'out', $4, $5)`,
        [await activeScenarioId(), tankId, date, qty, optionalText(form, "notes")],
      );
      await recomputeTank(client, tankId, new Set(), true);
    });
  });
}

export async function deleteMovement(id: string, tankId: string): Promise<Result> {
  return guard(async () => {
    await tx(async (client) => {
      const m = await client.query<{ source: string | null; source_ref: string | null }>(`select source, source_ref from tank_movement where id = $1`, [id]);
      if (m.rows[0]?.source === "adjustment") {
        // a manual edit is stored as a pair: the old balance out and the new one in
        const group = m.rows[0].source_ref?.split(":")[1];
        if (!group) throw new Error("That edit is no longer there - reload the page");
        const gone = await client.query<{ tank_id: string }>(
          `delete from tank_movement where source = 'adjustment' and source_ref like $1 returning tank_id`, [`adj:${group}:%`]);
        for (const t of new Set(gone.rows.map((r) => r.tank_id))) await recomputeTank(client, t);
        return;
      }
      if (m.rows[0]?.source === "transfer") {
        // a transfer goes as a pair: the 'out' on one tank and the 'in' on the other
        const pair = await client.query<{ out_id: string; tanks: string[] }>(
          `select coalesce(x.transfer_of, x.id) as out_id,
                  array[o.tank_id, i.tank_id]::text[] as tanks
             from tank_movement x
             join tank_movement o on o.id = coalesce(x.transfer_of, x.id)
             join tank_movement i on i.transfer_of = o.id
            where x.id = $1`, [id]);
        const p = pair.rows[0];
        if (!p) throw new Error("That transfer is no longer there - reload the page");
        await client.query(`delete from tank_movement where id = $1`, [p.out_id]);   // the 'in' goes with it
        for (const t of p.tanks) await recomputeTank(client, t);
        return;
      }
      if (m.rows[0]?.source === "production" || m.rows[0]?.source === "production_return" || m.rows[0]?.source === "production_output") throw new Error("This milk went into production - change it on the Production page");
      if (m.rows[0]?.source) throw new Error("This came from Milk in - change its tank on the Milk in page");
      await client.query(`delete from tank_movement where id = $1`, [id]);
      await recomputeTank(client, tankId);
    });
  });
}

/**
 * Moves milk from one tank to another on a date: an 'out' on the first tank
 * at its blend, and an 'in' on the second carrying exactly that blend and
 * cost, weighted into whatever the second tank already holds.
 */
export async function transferMilk(date: string, fromTank: string, toTank: string, raw: string, notes?: string): Promise<Result> {
  return guard(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");
    if (!fromTank || !toTank) throw new Error("Pick the tank the milk goes to");
    if (fromTank === toTank) throw new Error("Pick a different tank to move the milk into");
    const qty = Number(String(raw ?? "").replace(/,/g, ""));
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("Enter how many litres to move");
    const scenario = await activeScenarioId();
    const names = await query<{ id: string; name: string }>(`select id, name from tank where id = any($1) and scenario_id = $2`, [[fromTank, toTank], scenario]);
    if (names.length !== 2) throw new Error("A tank picked no longer exists - reload the page");
    const name = (id: string) => names.find((n) => n.id === id)!.name;
    await tx(async (client) => {
      const out = await client.query<{ id: string }>(
        `insert into tank_movement (scenario_id, tank_id, movement_date, direction, qty_litre, notes, source)
         values ($1, $2, $3, 'out', $4, $5, 'transfer') returning id`,
        [scenario, fromTank, date, qty, notes?.trim() || `Moved to ${name(toTank)}`]);
      await client.query(
        `insert into tank_movement (scenario_id, tank_id, movement_date, direction, qty_litre, notes, source, transfer_of)
         values ($1, $2, $3, 'in', $4, $5, 'transfer', $6)`,
        [scenario, toTank, date, qty, notes?.trim() || `From ${name(fromTank)}`, out.rows[0].id]);
      // the source fixes the blend the milk leaves at, then carries it into the other tank
      await recomputeTank(client, fromTank);
    });
  });
}

/**
 * Corrects a tank by hand: sets what it holds at the end of `date` - litres,
 * fat % and SNF %. Stored in the ledger as the old balance taken out and the
 * new one put in (source 'adjustment'), so the history and later days replay
 * correctly. The rate ₹/L is kept. Delete the pair to undo it.
 */
export async function adjustTank(date: string, tankId: string, rawLitres: string, rawFat: string, rawSnf: string): Promise<Result> {
  return guard(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");
    const litres = numberOrNull(rawLitres);
    const fat = numberOrNull(rawFat);
    const snf = numberOrNull(rawSnf);
    if (litres === null || litres < 0) throw new Error("Enter the litres in the tank (0 to empty it)");
    if (litres > 0 && (fat === null || snf === null)) throw new Error("Enter the fat % and SNF %");
    if (fat !== null && (fat < 0 || fat > 20)) throw new Error(`Fat ${fat}% doesn't look right - enter it as a percentage, e.g. 4.5`);
    if (snf !== null && (snf < 0 || snf > 20)) throw new Error(`SNF ${snf}% doesn't look right - enter it as a percentage, e.g. 8.5`);
    const scenario = await activeScenarioId();

    await tx(async (client) => {
      const t = await client.query(`select 1 from tank where id = $1 and scenario_id = $2`, [tankId, scenario]);
      if (!t.rowCount) throw new Error("That tank no longer exists - reload the page");
      const last = await client.query<{ balance_litre: string; balance_cost_per_litre: string }>(
        `select balance_litre, balance_cost_per_litre from tank_movement
          where tank_id = $1 and movement_date <= $2::date
          order by movement_date desc, created_at desc, id desc limit 1`, [tankId, date]);
      const had = Number(last.rows[0]?.balance_litre ?? 0);
      if (had <= 0.005 && litres <= 0) throw new Error("The tank is already empty");
      const cost = had > 0.005 ? Number(last.rows[0]?.balance_cost_per_litre ?? 0) : 0;
      const group = randomUUID();
      if (had > 0.005) {
        await client.query(
          `insert into tank_movement (scenario_id, tank_id, movement_date, direction, qty_litre, notes, source, source_ref, created_at)
           values ($1, $2, $3, 'out', $4, $5, 'adjustment', $6, clock_timestamp())`,
          [scenario, tankId, date, had, "Manual edit · previous balance", `adj:${group}:out`]);
      }
      if (litres > 0) {
        await client.query(
          `insert into tank_movement (scenario_id, tank_id, movement_date, direction, qty_litre, fat_pct, snf_pct, cost_per_litre, notes, source, source_ref, created_at)
           values ($1, $2, $3, 'in', $4, $5, $6, $7, $8, 'adjustment', $9, clock_timestamp())`,
          [scenario, tankId, date, litres, fat, snf, cost, "Manual edit · new balance", `adj:${group}:in`]);
      }
      await recomputeTank(client, tankId);
    });
  });
}
