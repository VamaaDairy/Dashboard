"use server";

import { revalidatePath } from "next/cache";
import { query, tx } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { recompute } from "@/lib/model/recompute";
import type { Result } from "@/app/tanks/actions";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function ingredientClass(scenario: string): Promise<string> {
  const k = await query<{ id: string }>(
    `select id from object_class where scenario_id = $1 and code = 'ingredient'`, [scenario]);
  if (!k.length) throw new Error("There is no Ingredient class in the model");
  return k[0].id;
}

/** Writes one of an ingredient's cells (rate or unit) - the same cells the cost model reads. */
async function writeCell(
  client: { query: (sql: string, params: unknown[]) => Promise<unknown> },
  objectId: string, classId: string, key: string, num: number | null, txt: string | null,
) {
  await client.query(
    `insert into field_value (object_id, field_def_id, formula, value_num, value_text)
     select $1, f.id, null, $3, $4 from field_def f where f.class_id = $2 and f.key = $5
     on conflict (object_id, field_def_id) do update
       set formula = null, value_num = excluded.value_num, value_text = excluded.value_text`,
    [objectId, classId, num, txt, key],
  );
}

async function done(scenario: string): Promise<Result> {
  await recompute(scenario, "ui");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Adds an ingredient, or renames one / changes its unit. New ones start at a rate of 0. */
export async function saveIngredient(form: FormData): Promise<Result> {
  try {
    const scenario = await activeScenarioId();
    const classId = await ingredientClass(scenario);
    const id = text(form, "id");
    const name = text(form, "name");
    if (!name) throw new Error("Give the ingredient a name");
    const unit = text(form, "unit") || "kg";

    await tx(async (client) => {
      let objectId = id;
      if (id) {
        await client.query(`update cost_object set name = $2 where id = $1 and class_id = $3`, [id, name, classId]);
      } else {
        const code = slug(name);
        if (!/^[a-z][a-z0-9_]*$/.test(code)) throw new Error("Use a name that starts with a letter");
        const taken = await client.query(`select 1 from cost_object where class_id = $1 and code = $2`, [classId, code]);
        if (taken.rowCount) throw new Error(`"${name}" is already an ingredient`);
        const r = await client.query<{ id: string }>(
          `insert into cost_object (scenario_id, class_id, code, name, sort_order)
           values ($1, $2, $3, $4, (select coalesce(max(sort_order), 0) + 1 from cost_object where class_id = $2))
           returning id`,
          [scenario, classId, code, name],
        );
        objectId = r.rows[0].id;
        await writeCell(client, objectId, classId, "rate", 0, null);
      }
      await writeCell(client, objectId, classId, "unit", null, unit);
    });
    return await done(scenario);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Sets an ingredient's rate per unit. Blank counts as 0. */
export async function setIngredientRate(id: string, raw: string): Promise<Result> {
  try {
    const scenario = await activeScenarioId();
    const classId = await ingredientClass(scenario);
    const t = raw.trim().replace(/,/g, "");
    const rate = t === "" ? 0 : Number(t);
    if (!Number.isFinite(rate) || rate < 0) throw new Error(`"${raw}" is not a valid rate`);
    await tx((client) => writeCell(client, id, classId, "rate", rate, null));
    return await done(scenario);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
