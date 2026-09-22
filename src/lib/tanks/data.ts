import "server-only";
import { one, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";

export interface TankRow {
  id: string;
  code: string;
  name: string;
  capacity_litre: number | null;
  is_active: boolean;
  notes: string | null;
  qty_litre: number;
  fat_pct: number;
  snf_pct: number;
  cost_per_litre: number;
}

export interface MovementRow {
  id: string;
  movement_date: string;
  direction: "in" | "out";
  qty_litre: number;
  fat_pct: number | null;
  snf_pct: number | null;
  cost_per_litre: number | null;
  balance_litre: number;
  balance_fat_pct: number;
  balance_snf_pct: number;
  balance_cost_per_litre: number;
  notes: string | null;
}

export async function getTanks(): Promise<TankRow[]> {
  return query<TankRow>(
    `select id, code, name, capacity_litre, is_active, notes,
            qty_litre, fat_pct, snf_pct, cost_per_litre
       from tank
      where scenario_id = $1
      order by sort_order, name`,
    [await activeScenarioId()],
  );
}

export async function getTank(code: string): Promise<TankRow | null> {
  return one<TankRow>(
    `select id, code, name, capacity_litre, is_active, notes,
            qty_litre, fat_pct, snf_pct, cost_per_litre
       from tank
      where scenario_id = $1 and code = $2`,
    [await activeScenarioId(), code],
  );
}

export async function getMovements(tankId: string, limit = 300): Promise<MovementRow[]> {
  return query<MovementRow>(
    `select id, to_char(movement_date, 'YYYY-MM-DD') as movement_date, direction, qty_litre,
            fat_pct, snf_pct, cost_per_litre,
            balance_litre, balance_fat_pct, balance_snf_pct, balance_cost_per_litre, notes
       from tank_movement
      where tank_id = $1
      order by movement_date desc, created_at desc
      limit $2`,
    [tankId, limit],
  );
}
