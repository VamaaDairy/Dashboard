"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { freezeDay } from "@/lib/daily/compute";

export type Result = { ok: true; day?: string } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });

const numberOrNull = (raw: string) => {
  const t = raw.trim().replace(/,/g, "");
  if (t === "") return null;
  const percent = t.endsWith("%");
  const v = Number(percent ? t.slice(0, -1) : t);
  if (!Number.isFinite(v)) throw new Error(`"${raw}" is not a number`);
  return percent ? v / 100 : v;
};

async function refresh(dayId?: string) {
  if (dayId) await freezeDay(dayId);
  revalidatePath("/daily", "layout");
  revalidatePath("/");
}

export async function createDay(form: FormData): Promise<Result> {
  try {
    const day = String(form.get("day") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail("Pick a date");
    const milk = numberOrNull(String(form.get("milk_processed_l") ?? ""));
    const rows = await query<{ id: string; day: string }>(
      `insert into production_day (scenario_id, day, milk_processed_l)
       values ($1, $2, $3)
       on conflict (scenario_id, day) do update set milk_processed_l =
         coalesce(excluded.milk_processed_l, production_day.milk_processed_l)
       returning id, to_char(day, 'YYYY-MM-DD') as day`,
      [await activeScenarioId(), day, milk],
    );
    await refresh(rows[0].id);
    return { ok: true, day: rows[0].day };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function setMilkProcessed(dayId: string, raw: string): Promise<Result> {
  try {
    await query(`update production_day set milk_processed_l = $2 where id = $1`,
      [dayId, numberOrNull(raw)]);
    await refresh(dayId);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

/** Amount wins when given; otherwise qty x rate. */
export async function setOverhead(
  dayId: string, headId: string, field: "qty" | "rate" | "amount", raw: string,
): Promise<Result> {
  try {
    const value = numberOrNull(raw);
    const existing = await query<{ qty: number | null; rate: number | null; amount: number | null }>(
      `select qty, rate, amount from daily_overhead where day_id = $1 and head_id = $2`,
      [dayId, headId],
    );
    const row = existing[0] ?? { qty: null, rate: null, amount: null };
    const next = { ...row, [field]: value };
    if (field !== "amount" && next.qty !== null && next.rate !== null) {
      next.amount = Number(next.qty) * Number(next.rate);
    }

    await query(
      `insert into daily_overhead (day_id, head_id, qty, rate, amount)
       values ($1,$2,$3,$4,$5)
       on conflict (day_id, head_id) do update
         set qty = excluded.qty, rate = excluded.rate, amount = excluded.amount`,
      [dayId, headId, next.qty, next.rate, next.amount],
    );
    await refresh(dayId);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function setProduction(
  dayId: string, productId: string, raw: string,
): Promise<Result> {
  try {
    const qty = numberOrNull(raw) ?? 0;
    if (qty === 0) {
      await query(`delete from daily_production where day_id = $1 and product_id = $2`,
        [dayId, productId]);
    } else {
      await query(
        `insert into daily_production (day_id, product_id, qty_produced)
         values ($1,$2,$3)
         on conflict (day_id, product_id) do update set qty_produced = excluded.qty_produced`,
        [dayId, productId, qty],
      );
    }
    await refresh(dayId);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function addOverheadHead(form: FormData): Promise<Result> {
  try {
    const label = String(form.get("label") ?? "").trim();
    if (!label) return fail("Give the cost head a name");
    const code = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!/^[a-z][a-z0-9_]*$/.test(code)) return fail("Use a name that starts with a letter");
    await query(
      `insert into overhead_head (scenario_id, code, label, unit, sort_order)
       values ($1,$2,$3,$4,(select coalesce(max(sort_order),0)+1 from overhead_head where scenario_id = $1))`,
      [await activeScenarioId(), code, label, String(form.get("unit") ?? "").trim() || null],
    );
    await refresh(String(form.get("day_id") ?? "") || undefined);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function deleteOverheadHead(id: string, dayId?: string): Promise<Result> {
  try {
    await query(`delete from overhead_head where id = $1`, [id]);
    await refresh(dayId);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function recalcDay(dayId: string): Promise<Result> {
  try {
    await refresh(dayId);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function deleteDay(dayId: string): Promise<Result> {
  try {
    await query(`delete from production_day where id = $1`, [dayId]);
    revalidatePath("/daily", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
