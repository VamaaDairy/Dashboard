"use server";

import { revalidatePath } from "next/cache";
import { query, tx } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import type { Result } from "@/app/tanks/actions";

function amount(raw: string | number | null | undefined, label: string): number {
  const t = String(raw ?? "").replace(/,/g, "").trim();
  if (t === "") return 0;
  const v = Number(t);
  if (!Number.isFinite(v) || v < 0) throw new Error(`${label}: "${raw}" is not a valid number`);
  return v;
}

/** A packing-material line as the page sends it. */
export interface MaterialLine {
  packaging_id: string | null;
  name: string;
  qty: string;
  unit: string;
  price: string;
}

/**
 * Saves one day's SKU packing - full cases and loose pieces per SKU, and the
 * packing material that went into it. A SKU left at 0 wasn't packed that day
 * and has no row; its material lines replace whatever it had that day.
 */
export async function saveSkuDay(
  date: string, rows: { sku_id: string; cases: string; loose_pcs: string; materials: MaterialLine[] }[],
): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");
    const scenario = await activeScenarioId();
    await tx(async (client) => {
      for (const r of rows) {
        const sku = await client.query<{ name: string }>(`select name from sku where id = $1 and scenario_id = $2`, [r.sku_id, scenario]);
        const name = sku.rows[0]?.name;
        if (!name) throw new Error("A SKU in the list no longer exists - reload the page");
        const cases = amount(r.cases, `${name}: cases`);
        const loose = amount(r.loose_pcs, `${name}: loose pieces`);

        await client.query(`delete from sku_pack_material where sku_id = $1 and day = $2`, [r.sku_id, date]);
        let order = 0;
        for (const m of r.materials ?? []) {
          const item = String(m.name ?? "").trim();
          const qty = amount(m.qty, `${name}: ${item || "packing material"} quantity`);
          if (!item && qty === 0) continue;
          if (!item) throw new Error(`${name}: give each packing material a name`);
          if (qty === 0) throw new Error(`${name}: enter how much ${item} was used`);
          const unit = m.unit === "kg" ? "kg" : "pcs";
          const price = amount(m.price, `${name}: ${item} price`);
          await client.query(
            `insert into sku_pack_material (scenario_id, sku_id, day, packaging_id, name, qty, unit, price, sort_order)
             select $1, $2, $3, o.id, $5, $6, $7, $8, $9
               from (select 1) x left join cost_object o on o.id = $4::uuid and o.scenario_id = $1`,
            [scenario, r.sku_id, date, m.packaging_id || null, item, qty, unit, price, order++],
          );
        }

        if (cases === 0 && loose === 0) {
          await client.query(`delete from sku_pack_day where sku_id = $1 and day = $2`, [r.sku_id, date]);
          continue;
        }
        await client.query(
          `insert into sku_pack_day (scenario_id, sku_id, day, cases, loose_pcs) values ($1, $2, $3, $4, $5)
           on conflict (sku_id, day) do update set cases = excluded.cases, loose_pcs = excluded.loose_pcs`,
          [scenario, r.sku_id, date, cases, loose],
        );
      }
    });
    revalidatePath("/daily", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** A SKU's setup: pieces per case, which bulk product fills it and how much one piece holds, on the list or not. */
export async function saveSku(
  id: string,
  v: { pcs_per_case: string; bulk_product_id: string; bulk_qty_per_pc: string; is_active: boolean },
): Promise<Result> {
  try {
    const scenario = await activeScenarioId();
    const pcs = amount(v.pcs_per_case, "Pieces per case");
    if (!Number.isInteger(pcs) || pcs < 1) throw new Error("Pieces per case must be a whole number, at least 1");
    const perPc = String(v.bulk_qty_per_pc ?? "").trim() === "" ? null : amount(v.bulk_qty_per_pc, "Quantity per piece");
    const bulk = v.bulk_product_id || null;
    if (bulk) {
      const ok = await query(`select 1 from bulk_product where id = $1 and scenario_id = $2`, [bulk, scenario]);
      if (!ok.length) throw new Error("That bulk product no longer exists - reload the page");
    }
    await query(
      `update sku set pcs_per_case = $2, bulk_product_id = $3, bulk_qty_per_pc = $4, is_active = $5
        where id = $1 and scenario_id = $6`,
      [id, pcs, bulk, perPc, v.is_active, scenario],
    );
    revalidatePath("/daily", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
