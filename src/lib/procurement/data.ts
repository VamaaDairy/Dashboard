import "server-only";
import { one, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { DEFAULT_KG_PER_LITRE } from "@/lib/units";

export interface DayRow {
  collected_on: string;
  batch_count: number;
  center_count: number;
  qty_kg: number;
  qty_litre: number;
  landed_kg: number;
  landed_litre: number;
  kg_solids: number;
  fat_pct: number | null;
  snf_pct: number | null;
  farmer_amount: number;
  commission_amount: number;
  transport_amount: number;
  total_cost: number;
  landed_per_kg: number | null;
  landed_per_litre: number | null;
  landed_per_kg_solids: number | null;
}

/** The Today page's "milk in" card - manual-entry procurement, by day. */
export async function getDays(limit = 60): Promise<DayRow[]> {
  return query<DayRow>(
    `select to_char(collected_on, 'YYYY-MM-DD') as collected_on, batch_count::int,
            center_count::int, qty_kg, qty_litre, landed_kg, landed_litre, kg_solids,
            fat_pct, snf_pct, farmer_amount, commission_amount, transport_amount,
            total_cost, landed_per_kg, landed_per_litre, landed_per_kg_solids
       from v_procurement_day
      where scenario_id = $1
      order by collected_on desc
      limit $2`,
    [await activeScenarioId(), limit],
  );
}

/** The live litre <-> kg factor for the active scenario (`milk_kg_per_litre` parameter). */
export async function kgPerLitre(): Promise<number> {
  const row = await one<{ k: number }>(
    `select milk_kg_per_litre($1) as k`,
    [await activeScenarioId()],
  );
  return Number(row?.k) || DEFAULT_KG_PER_LITRE;
}
