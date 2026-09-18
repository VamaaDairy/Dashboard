"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { getPricingContext, kgPerLitre } from "@/lib/procurement/data";
import { priceBatch, type CommissionMode, type RateBasis } from "@/lib/procurement/pricing";

export type Result = { ok: true } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

const optionalText = (form: FormData, key: string) => text(form, key) || null;

function numberOrNull(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (t === "") return null;
  const percent = t.endsWith("%");
  const v = Number(percent ? t.slice(0, -1) : t);
  if (!Number.isFinite(v)) throw new Error(`"${raw}" is not a number`);
  return v;
}

const numberField = (form: FormData, key: string) => numberOrNull(text(form, key));

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function refresh() {
  revalidatePath("/procurement", "layout");
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

// ---------------------------------------------------------------------
// Module 1 - rate charts
// ---------------------------------------------------------------------

export async function saveRateChart(form: FormData): Promise<Result> {
  return guard(async () => {
    const id = text(form, "id");
    const name = text(form, "name");
    if (!name) throw new Error("Give the rate chart a name");

    const basis = text(form, "basis") as RateBasis;
    const fields = [
      name,
      (text(form, "milk_type") || "mixed") as string,
      basis,
      numberField(form, "rate_solid"),
      numberField(form, "rate_fat"),
      numberField(form, "rate_snf"),
      numberField(form, "flat_rate"),
      text(form, "effective_from") || new Date().toISOString().slice(0, 10),
      form.get("is_active") !== null,
      optionalText(form, "notes"),
    ];

    if (id) {
      await query(
        `update milk_rate_chart
            set name = $2, milk_type = $3, basis = $4, rate_solid = $5, rate_fat = $6,
                rate_snf = $7, flat_rate = $8, effective_from = $9, is_active = $10, notes = $11
          where id = $1`,
        [id, ...fields],
      );
      await repriceBatches({ rateChartId: id });
      return;
    }

    const code = slug(text(form, "code") || name);
    if (!/^[a-z][a-z0-9_]*$/.test(code)) throw new Error("Use a name that starts with a letter");
    await query(
      `insert into milk_rate_chart
         (scenario_id, code, name, milk_type, basis, rate_solid, rate_fat, rate_snf,
          flat_rate, effective_from, is_active, notes, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               (select coalesce(max(sort_order), 0) + 1 from milk_rate_chart where scenario_id = $1))`,
      [await activeScenarioId(), code, ...fields],
    );
  });
}

export async function deleteRateChart(id: string): Promise<Result> {
  return guard(async () => {
    const used = await one<{ n: number }>(
      `select count(*)::int as n from procurement_batch where rate_chart_id = $1`, [id]);
    if (Number(used?.n)) {
      throw new Error(`${used?.n} collection(s) were paid on this chart - deactivate it instead`);
    }
    await query(`delete from milk_rate_chart where id = $1`, [id]);
  });
}

// ---------------------------------------------------------------------
// Module 3 - collection centres and their sachiv commission
// ---------------------------------------------------------------------

export async function saveCenter(form: FormData): Promise<Result> {
  return guard(async () => {
    const id = text(form, "id");
    const name = text(form, "name");
    if (!name) throw new Error("Give the collection centre a name");

    const fields = [
      name,
      optionalText(form, "sachiv_name"),
      optionalText(form, "village"),
      optionalText(form, "route"),
      numberField(form, "distance_km"),
      optionalText(form, "rate_chart_id"),
      (text(form, "commission_mode") || "per_kg") as CommissionMode,
      numberField(form, "commission_rate"),
      form.get("is_active") !== null,
      optionalText(form, "notes"),
    ];

    if (id) {
      await query(
        `update procurement_center
            set name = $2, sachiv_name = $3, village = $4, route = $5, distance_km = $6,
                rate_chart_id = $7, commission_mode = $8, commission_rate = $9,
                is_active = $10, notes = $11
          where id = $1`,
        [id, ...fields],
      );
      await repriceBatches({ centerId: id });
      return;
    }

    const code = slug(text(form, "code") || name);
    if (!/^[a-z][a-z0-9_]*$/.test(code)) throw new Error("Use a name that starts with a letter");
    await query(
      `insert into procurement_center
         (scenario_id, code, name, sachiv_name, village, route, distance_km, rate_chart_id,
          commission_mode, commission_rate, is_active, notes, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               (select coalesce(max(sort_order), 0) + 1 from procurement_center where scenario_id = $1))`,
      [await activeScenarioId(), code, ...fields],
    );
  });
}

export async function deleteCenter(id: string): Promise<Result> {
  return guard(async () => {
    await query(`delete from procurement_center where id = $1`, [id]);
  });
}

// ---------------------------------------------------------------------
// Module 2 - tanker trips
// ---------------------------------------------------------------------

export async function saveTrip(form: FormData): Promise<Result> {
  return guard(async () => {
    const id = text(form, "id");
    const tanker = text(form, "tanker_code");
    if (!tanker) throw new Error("Give the tanker a name or number");

    const fields = [
      text(form, "trip_date") || new Date().toISOString().slice(0, 10),
      tanker,
      optionalText(form, "vehicle_no"),
      optionalText(form, "route"),
      numberField(form, "distance_km"),
      text(form, "cost_mode") || "per_trip",
      numberField(form, "rate"),
      numberField(form, "other_cost") ?? 0,
      numberField(form, "cost_override"),
      numberField(form, "received_qty_kg"),
      optionalText(form, "notes"),
    ];

    if (id) {
      await query(
        `update tanker_trip
            set trip_date = $2, tanker_code = $3, vehicle_no = $4, route = $5, distance_km = $6,
                cost_mode = $7, rate = $8, other_cost = $9, cost_override = $10,
                received_qty_kg = $11, notes = $12
          where id = $1`,
        [id, ...fields],
      );
      return;
    }

    await query(
      `insert into tanker_trip
         (scenario_id, trip_date, tanker_code, vehicle_no, route, distance_km, cost_mode,
          rate, other_cost, cost_override, received_qty_kg, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [await activeScenarioId(), ...fields],
    );
  });
}

export async function deleteTrip(id: string): Promise<Result> {
  return guard(async () => {
    await query(`delete from tanker_trip where id = $1`, [id]);
  });
}

/** Put a collection on a tanker, or take it off again (empty tripId). */
export async function assignBatchToTrip(batchId: string, tripId: string): Promise<Result> {
  return guard(async () => {
    await query(`update procurement_batch set trip_id = $2 where id = $1`,
      [batchId, tripId || null]);
  });
}

// ---------------------------------------------------------------------
// Collections - the weighed, tested milk itself
// ---------------------------------------------------------------------

export async function saveBatch(form: FormData): Promise<Result> {
  return guard(async () => {
    const id = text(form, "id");
    const centerId = text(form, "center_id");
    if (!centerId) throw new Error("Pick the collection centre");

    const qtyKg = numberField(form, "qty_kg");
    if (qtyKg === null || qtyKg <= 0) throw new Error("Enter the weight taken, in kilograms");

    const { center, chart, kgPerLitre: k } = await getPricingContext(
      centerId, text(form, "rate_chart_id") || null);

    const input = {
      qty_kg: qtyKg,
      fat_pct: numberField(form, "fat_pct"),
      snf_pct: numberField(form, "snf_pct"),
    };
    const priced = priceBatch(input, chart, center, k);

    const fields = [
      centerId,
      chart.id,
      optionalText(form, "trip_id"),
      text(form, "collected_on") || new Date().toISOString().slice(0, 10),
      text(form, "shift") || "morning",
      priced.qty_kg,
      input.fat_pct,
      input.snf_pct,
      priced.qty_litre,
      priced.kg_fat,
      priced.kg_snf,
      priced.kg_solids,
      priced.farmer_amount,
      priced.commission_amount,
      priced.farmer_rate_per_kg,
      optionalText(form, "notes"),
    ];

    if (id) {
      await query(
        `update procurement_batch
            set center_id = $2, rate_chart_id = $3, trip_id = $4, collected_on = $5, shift = $6,
                qty_kg = $7, fat_pct = $8, snf_pct = $9, qty_litre = $10, kg_fat = $11,
                kg_snf = $12, kg_solids = $13, farmer_amount = $14, commission_amount = $15,
                farmer_rate_per_kg = $16, notes = $17
          where id = $1`,
        [id, ...fields],
      );
      return;
    }

    await query(
      `insert into procurement_batch
         (scenario_id, center_id, rate_chart_id, trip_id, collected_on, shift, qty_kg,
          fat_pct, snf_pct, qty_litre, kg_fat, kg_snf, kg_solids, farmer_amount,
          commission_amount, farmer_rate_per_kg, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       on conflict (scenario_id, center_id, collected_on, shift) do update
          set rate_chart_id = excluded.rate_chart_id, trip_id = excluded.trip_id,
              qty_kg = excluded.qty_kg, fat_pct = excluded.fat_pct, snf_pct = excluded.snf_pct,
              qty_litre = excluded.qty_litre, kg_fat = excluded.kg_fat, kg_snf = excluded.kg_snf,
              kg_solids = excluded.kg_solids, farmer_amount = excluded.farmer_amount,
              commission_amount = excluded.commission_amount,
              farmer_rate_per_kg = excluded.farmer_rate_per_kg, notes = excluded.notes`,
      [await activeScenarioId(), ...fields],
    );
  });
}

export async function deleteBatch(id: string): Promise<Result> {
  return guard(async () => {
    await query(`delete from procurement_batch where id = $1`, [id]);
  });
}

/**
 * Re-run the pricing rules over stored collections. Called when a rate chart or
 * a centre's commission terms change, since those are the only inputs a batch
 * row does not hold itself.
 */
export async function repriceBatches(
  scope: { rateChartId?: string; centerId?: string } = {},
): Promise<Result> {
  return guard(async () => {
    const scenarioId = await activeScenarioId();
    const k = await kgPerLitre(scenarioId);

    const rows = await query<{
      id: string;
      qty_kg: number;
      fat_pct: number | null;
      snf_pct: number | null;
      basis: RateBasis;
      rate_solid: number | null;
      rate_fat: number | null;
      rate_snf: number | null;
      flat_rate: number | null;
      commission_mode: CommissionMode;
      commission_rate: number | null;
    }>(
      `select b.id, b.qty_kg, b.fat_pct, b.snf_pct,
              c.basis, c.rate_solid, c.rate_fat, c.rate_snf, c.flat_rate,
              t.commission_mode, t.commission_rate
         from procurement_batch b
         join milk_rate_chart c    on c.id = b.rate_chart_id
         join procurement_center t on t.id = b.center_id
        where b.scenario_id = $1
          and ($2::uuid is null or b.rate_chart_id = $2)
          and ($3::uuid is null or b.center_id = $3)`,
      [scenarioId, scope.rateChartId ?? null, scope.centerId ?? null],
    );

    for (const row of rows) {
      const priced = priceBatch(row, row, row, k);
      await query(
        `update procurement_batch
            set qty_litre = $2, kg_fat = $3, kg_snf = $4, kg_solids = $5,
                farmer_amount = $6, commission_amount = $7, farmer_rate_per_kg = $8
          where id = $1`,
        [row.id, priced.qty_litre, priced.kg_fat, priced.kg_snf, priced.kg_solids,
         priced.farmer_amount, priced.commission_amount, priced.farmer_rate_per_kg],
      );
    }
  });
}
