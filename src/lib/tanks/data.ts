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
  source: string | null;          // 'vamaa' from Milk in, 'production' drawn for a batch; null when entered here
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
            balance_litre, balance_fat_pct, balance_snf_pct, balance_cost_per_litre, notes, source
       from tank_movement
      where tank_id = $1
      order by movement_date desc, created_at desc, id desc
      limit $2`,
    [tankId, limit],
  );
}

/**
 * One tank's day: what it opened with (the balance after the last movement
 * before the day), what came in and went out during it, and what it closed at.
 * Opening and closing carry the weighted-average blend of what was in the tank
 * at that point; `in_*` is the weighted average of that day's additions alone.
 */
export interface TankDay {
  tank_id: string;
  code: string;
  name: string;
  capacity_litre: number | null;
  is_active: boolean;
  day: string;
  open_litre: number;
  open_fat_pct: number | null;
  open_snf_pct: number | null;
  open_cost_per_litre: number | null;
  in_litre: number;
  in_fat_pct: number | null;
  in_snf_pct: number | null;
  in_cost_per_litre: number | null;
  out_litre: number;
  movements: number;
  close_litre: number;
  close_fat_pct: number | null;
  close_snf_pct: number | null;
  close_cost_per_litre: number | null;
}

export interface DayMovementRow extends MovementRow {
  tank_id: string;
  tank_code: string;
  tank_name: string;
}

// Shared by both daily queries: that day's additions and withdrawals for one tank.
const DAY_FLOWS = `
  select count(*)::int as movements,
         coalesce(sum(qty_litre) filter (where direction = 'in'), 0)  as in_litre,
         coalesce(sum(qty_litre) filter (where direction = 'out'), 0) as out_litre,
         sum(qty_litre * fat_pct) filter (where direction = 'in')
           / nullif(sum(qty_litre) filter (where direction = 'in'), 0) as in_fat_pct,
         sum(qty_litre * snf_pct) filter (where direction = 'in')
           / nullif(sum(qty_litre) filter (where direction = 'in'), 0) as in_snf_pct,
         sum(qty_litre * cost_per_litre) filter (where direction = 'in')
           / nullif(sum(qty_litre) filter (where direction = 'in'), 0) as in_cost_per_litre
    from tank_movement`;

/** Every tank on one date. Inactive tanks appear only if they held or moved milk that day. */
export async function getTanksOnDate(date: string): Promise<TankDay[]> {
  return query<TankDay>(
    `select t.id as tank_id, t.code, t.name, t.capacity_litre, t.is_active, $2::text as day,
            coalesce(o.balance_litre, 0) as open_litre,
            o.balance_fat_pct as open_fat_pct, o.balance_snf_pct as open_snf_pct,
            o.balance_cost_per_litre as open_cost_per_litre,
            f.in_litre, f.in_fat_pct, f.in_snf_pct, f.in_cost_per_litre, f.out_litre, f.movements,
            coalesce(c.balance_litre, 0) as close_litre,
            c.balance_fat_pct as close_fat_pct, c.balance_snf_pct as close_snf_pct,
            c.balance_cost_per_litre as close_cost_per_litre
       from tank t
       left join lateral (
         select balance_litre, balance_fat_pct, balance_snf_pct, balance_cost_per_litre
           from tank_movement where tank_id = t.id and movement_date < $2::date
          order by movement_date desc, created_at desc, id desc limit 1
       ) o on true
       left join lateral (
         select balance_litre, balance_fat_pct, balance_snf_pct, balance_cost_per_litre
           from tank_movement where tank_id = t.id and movement_date <= $2::date
          order by movement_date desc, created_at desc, id desc limit 1
       ) c on true
       cross join lateral (${DAY_FLOWS} where tank_id = t.id and movement_date = $2::date) f
      where t.scenario_id = $1
        and (t.is_active or coalesce(c.balance_litre, 0) > 0 or f.movements > 0)
      order by t.sort_order, t.name`,
    [await activeScenarioId(), date],
  );
}

/** Every addition and withdrawal on one date, across all tanks, in the order they were entered. */
export async function getMovementsOnDate(date: string): Promise<DayMovementRow[]> {
  return query<DayMovementRow>(
    `select m.id, to_char(m.movement_date, 'YYYY-MM-DD') as movement_date, m.direction, m.qty_litre,
            m.fat_pct, m.snf_pct, m.cost_per_litre,
            m.balance_litre, m.balance_fat_pct, m.balance_snf_pct, m.balance_cost_per_litre, m.notes, m.source,
            t.id as tank_id, t.code as tank_code, t.name as tank_name
       from tank_movement m
       join tank t on t.id = m.tank_id
      where m.scenario_id = $1 and m.movement_date = $2::date
      order by t.sort_order, m.created_at, m.id`,
    [await activeScenarioId(), date],
  );
}

/** One tank, one row per day it moved milk, newest first. */
export async function getTankDays(tankId: string, limit = 90): Promise<TankDay[]> {
  return query<TankDay>(
    `with days as (
       select distinct movement_date as d from tank_movement
        where tank_id = $1 order by movement_date desc limit $2
     ),
     closing as (
       select distinct on (movement_date) movement_date as d,
              balance_litre, balance_fat_pct, balance_snf_pct, balance_cost_per_litre
         from tank_movement where tank_id = $1
        order by movement_date, created_at desc, id desc
     ),
     chained as (
       select d, balance_litre, balance_fat_pct, balance_snf_pct, balance_cost_per_litre,
              lag(balance_litre)          over w as open_litre,
              lag(balance_fat_pct)        over w as open_fat_pct,
              lag(balance_snf_pct)        over w as open_snf_pct,
              lag(balance_cost_per_litre) over w as open_cost_per_litre
         from closing window w as (order by d)
     )
     select t.id as tank_id, t.code, t.name, t.capacity_litre, t.is_active,
            to_char(c.d, 'YYYY-MM-DD') as day,
            coalesce(c.open_litre, 0) as open_litre, c.open_fat_pct, c.open_snf_pct, c.open_cost_per_litre,
            f.in_litre, f.in_fat_pct, f.in_snf_pct, f.in_cost_per_litre, f.out_litre, f.movements,
            c.balance_litre as close_litre, c.balance_fat_pct as close_fat_pct,
            c.balance_snf_pct as close_snf_pct, c.balance_cost_per_litre as close_cost_per_litre
       from chained c
       join days using (d)
       join tank t on t.id = $1
       cross join lateral (${DAY_FLOWS} where tank_id = $1 and movement_date = c.d) f
      order by c.d desc`,
    [tankId, limit],
  );
}

/** Which tank each Milk in collection on `date` was put into, keyed by its collection ref. */
export async function getCollectionTanks(date: string): Promise<Record<string, string>> {
  const rows = await query<{ source_ref: string; tank_id: string }>(
    `select source_ref, tank_id from tank_movement
      where scenario_id = $1 and source = 'vamaa' and movement_date = $2::date`,
    [await activeScenarioId(), date],
  );
  return Object.fromEntries(rows.map((r) => [r.source_ref, r.tank_id]));
}
