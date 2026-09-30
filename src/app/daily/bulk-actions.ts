"use server";

import { revalidatePath } from "next/cache";
import { query, tx } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import type { Result } from "@/app/tanks/actions";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();



function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function guard(fn: () => Promise<void>): Promise<Result> {
  try {
    await fn();
    revalidatePath("/daily", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Add or rename a product made in bulk. Its unit (kg or L) is fixed once batches exist. */
export async function saveBulkProduct(form: FormData): Promise<Result> {
  return guard(async () => {
    const id = text(form, "id");
    const name = text(form, "name");
    if (!name) throw new Error("Give the product a name");
    const unit = text(form, "unit") === "L" ? "L" : "kg";
    const isActive = form.get("is_active") !== null;
    const scenario = await activeScenarioId();

    if (id) {
      const used = await query(`select 1 from bulk_batch where bulk_product_id = $1 limit 1`, [id]);
      const current = await query<{ unit: string }>(`select unit from bulk_product where id = $1`, [id]);
      if (used.length && current[0]?.unit !== unit) {
        throw new Error("This product already has batches, so its unit can't change");
      }
      await query(
        `update bulk_product set name = $2, unit = $3, is_active = $4 where id = $1`,
        [id, name, unit, isActive],
      );
      return;
    }

    const code = slug(name);
    if (!/^[a-z][a-z0-9_]*$/.test(code)) throw new Error("Use a name that starts with a letter");
    const taken = await query(`select 1 from bulk_product where scenario_id = $1 and code = $2`, [scenario, code]);
    if (taken.length) throw new Error(`"${name}" is already on the list`);
    await query(
      `insert into bulk_product (scenario_id, code, name, unit, is_active, sort_order)
       values ($1, $2, $3, $4, $5, (select coalesce(max(sort_order), 0) + 1 from bulk_product where scenario_id = $1))`,
      [scenario, code, name, unit, isActive],
    );
  });
}

/**
 * Sets a product's standing ingredient list: which ingredients it is made
 * with, in this order, and the unit each is entered in. Quantities stay on
 * the day. Removing one here doesn't touch days already saved.
 */
export async function saveProductIngredients(
  productId: string, lines: { ingredient_id: string; unit: string }[],
): Promise<Result> {
  try {
    const scenario = await activeScenarioId();
    const product = await query(`select 1 from bulk_product where id = $1 and scenario_id = $2`, [productId, scenario]);
    if (!product.length) throw new Error("That product no longer exists - reload the page");
    await tx(async (client) => {
      await client.query(`delete from bulk_product_ingredient where bulk_product_id = $1`, [productId]);
      const seen = new Set<string>();
      for (const [i, l] of lines.entries()) {
        if (!l.ingredient_id || seen.has(l.ingredient_id)) continue;
        seen.add(l.ingredient_id);
        await client.query(
          `insert into bulk_product_ingredient (bulk_product_id, ingredient_id, unit, sort_order)
           select $1, o.id, $3, $4 from cost_object o where o.id = $2 and o.scenario_id = $5`,
          [productId, l.ingredient_id, l.unit || "kg", i, scenario],
        );
      }
    });
    revalidatePath("/daily", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** One product's line in the day's table, as the page sends it. */
export interface DayRow {
  bulk_product_id: string;
  output_qty: number | null;
  milk_litre: number | null;
  milk_fat_pct: number | null;
  milk_snf_pct: number | null;
  labour_workers: number | null;
  labour_hours: number | null;
  labour_cost: number | null;
  notes: string | null;
  ingredients: { ingredient_id: string | null; name: string; qty: number; unit: string }[];
}

function check(v: number | null, label: string, max?: number) {
  if (v === null) return;
  if (!Number.isFinite(v) || v < 0) throw new Error(`${label}: "${v}" is not a valid number`);
  if (max !== undefined && v > max) throw new Error(`${label} ${v} doesn't look right - enter a percentage, e.g. 4.5`);
}

/**
 * Saves the whole day's table at once. A product left at zero everywhere,
 * with no ingredients, wasn't made that day and has no row; anything else is
 * stored, with its ingredient lines replacing whatever it had.
 */
export async function saveProductionDay(date: string, rows: DayRow[]): Promise<Result> {
  return guard(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");
    const scenario = await activeScenarioId();

    await tx(async (client) => {
      for (const r of rows) {
        const products = await client.query<{ name: string }>(
          `select name from bulk_product where id = $1 and scenario_id = $2`, [r.bulk_product_id, scenario]);
        const name = products.rows[0]?.name;
        if (!name) throw new Error("A product in the table no longer exists - reload the page");

        check(r.output_qty, `${name}: output`);
        check(r.milk_litre, `${name}: milk`);
        check(r.milk_fat_pct, `${name}: milk fat %`, 20);
        check(r.milk_snf_pct, `${name}: milk SNF %`, 20);
        check(r.labour_workers, `${name}: workers`);
        check(r.labour_hours, `${name}: hours`);
        check(r.labour_cost, `${name}: labour ₹`);
        const lines = (r.ingredients ?? []).filter((l) => l.name && Number(l.qty) > 0);
        for (const l of lines) check(Number(l.qty), `${name}: ${l.name}`);

        const empty = [r.output_qty, r.milk_litre, r.labour_workers, r.labour_hours, r.labour_cost]
          .every((v) => !v) && lines.length === 0;
        if (empty) {
          await client.query(
            `delete from bulk_batch where scenario_id = $1 and batch_date = $2 and bulk_product_id = $3`,
            [scenario, date, r.bulk_product_id],
          );
          continue;
        }

        const saved = await client.query<{ id: string }>(
          `insert into bulk_batch (scenario_id, batch_date, bulk_product_id, output_qty, milk_litre, milk_fat_pct,
                                   milk_snf_pct, labour_workers, labour_hours, labour_cost, notes)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           on conflict (scenario_id, batch_date, bulk_product_id) do update set
             output_qty = excluded.output_qty, milk_litre = excluded.milk_litre,
             milk_fat_pct = excluded.milk_fat_pct, milk_snf_pct = excluded.milk_snf_pct,
             labour_workers = excluded.labour_workers, labour_hours = excluded.labour_hours,
             labour_cost = excluded.labour_cost, notes = excluded.notes
           returning id`,
          [
            scenario, date, r.bulk_product_id, r.output_qty, r.milk_litre, r.milk_fat_pct, r.milk_snf_pct,
            r.labour_workers, r.labour_hours, r.labour_cost, r.notes,
          ],
        );
        const batchId = saved.rows[0].id;
        await client.query(`delete from bulk_batch_ingredient where batch_id = $1`, [batchId]);
        for (const [i, l] of lines.entries()) {
          await client.query(
            `insert into bulk_batch_ingredient (batch_id, ingredient_id, name, qty, unit, sort_order)
             values ($1, $2, $3, $4, $5, $6)`,
            [batchId, l.ingredient_id || null, l.name, Number(l.qty), l.unit || "kg", i],
          );
        }
      }
    });
  });
}
