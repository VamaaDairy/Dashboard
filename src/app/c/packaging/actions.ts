"use server";

import { revalidatePath } from "next/cache";
import { query, tx } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { recompute } from "@/lib/model/recompute";
import type { Result } from "@/app/tanks/actions";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const num = (form: FormData, key: string, label: string): number | null => {
  const t = text(form, key).replace(/,/g, "");
  if (t === "") return null;
  const v = Number(t);
  if (!Number.isFinite(v) || v < 0) throw new Error(`${label}: "${text(form, key)}" is not a valid number`);
  return v;
};

/**
 * Saves a packaging item's particulars. With a base rate the item's rate is
 * worked out from it (base x (1 + GST %) + freight); without one the rate typed in is kept as it is.
 */
export async function savePackagingDetail(form: FormData): Promise<Result> {
  try {
    const scenario = await activeScenarioId();
    const id = text(form, "id");
    const found = await query<{ class_id: string }>(
      `select o.class_id from cost_object o join object_class k on k.id = o.class_id and k.code = 'packaging'
        where o.id = $1 and o.scenario_id = $2`, [id, scenario]);
    if (!found.length) throw new Error("That item no longer exists - reload the page");
    const classId = found[0].class_id;
    const name = text(form, "name");
    if (!name) throw new Error("Give the item a name");
    const unit = text(form, "unit") === "kg" ? "kg" : "pc";
    const base = num(form, "base_rate", "Base rate");
    const gst = num(form, "gst_pct", "GST %") ?? 0;
    const freight = num(form, "freight", "Freight") ?? 0;
    const typed = num(form, "rate", "Rate");
    const rate = base !== null ? Math.round((base * (1 + gst / 100) + freight) * 1e6) / 1e6 : typed ?? 0;

    await tx(async (client) => {
      await client.query(`update cost_object set name = $2 where id = $1`, [id, name]);
      const cell = (key: string, n: number | null, t: string | null) => client.query(
        `insert into field_value (object_id, field_def_id, formula, value_num, value_text)
         select $1, f.id, null, $3, $4 from field_def f where f.class_id = $2 and f.key = $5
         on conflict (object_id, field_def_id) do update set formula = null, value_num = excluded.value_num, value_text = excluded.value_text`,
        [id, classId, n, t, key]);
      await cell("unit", null, unit);
      await cell("rate", rate, null);
      await client.query(
        `insert into packaging_detail (packaging_id, category, spec, supplier, base_rate, gst_pct, freight, note)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (packaging_id) do update set category = excluded.category, spec = excluded.spec, supplier = excluded.supplier,
           base_rate = excluded.base_rate, gst_pct = excluded.gst_pct, freight = excluded.freight, note = excluded.note`,
        [id, text(form, "category") || null, text(form, "spec") || null, text(form, "supplier") || null, base, gst, freight, text(form, "note") || null]);
    });
    await recompute(scenario, "ui");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
