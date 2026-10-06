import "server-only";
import type { PoolClient } from "pg";

export type Direction = "in" | "out";

interface MovementRow {
  id: string;
  direction: Direction;
  qty_litre: number;
  fat_pct: number | null;
  snf_pct: number | null;
  cost_per_litre: number | null;
}

interface Balance {
  qty_litre: number;
  fat_pct: number;
  snf_pct: number;
  cost_per_litre: number;
}

const ZERO: Balance = { qty_litre: 0, fat_pct: 0, snf_pct: 0, cost_per_litre: 0 };

/**
 * One step of the moving average: an addition blends its fat/SNF/cost into
 * the tank in proportion to volume; a withdrawal takes milk out at whatever
 * blend the tank already carries, changing the quantity but not the blend.
 */
function apply(balance: Balance, m: MovementRow): Balance {
  const qty = Number(m.qty_litre);

  if (m.direction === "in") {
    const newQty = balance.qty_litre + qty;
    if (newQty <= 0) return { ...ZERO };
    const blend = (existing: number, incoming: number | null) =>
      (balance.qty_litre * existing + qty * Number(incoming ?? 0)) / newQty;
    return {
      qty_litre: newQty,
      fat_pct: blend(balance.fat_pct, m.fat_pct),
      snf_pct: blend(balance.snf_pct, m.snf_pct),
      cost_per_litre: blend(balance.cost_per_litre, m.cost_per_litre),
    };
  }

  return { ...balance, qty_litre: balance.qty_litre - qty };
}

/**
 * Replays every movement for a tank in date order, freezing the balance onto
 * each row and writing the final balance back onto the tank itself. Called
 * inside a transaction after any insert, edit or delete against the ledger,
 * so a backdated entry is folded in correctly rather than just appended.
 *
 * Throws (the caller should roll back) if any movement would take the tank
 * negative - milk that was never recorded as coming in cannot leave it - or
 * past its capacity, when one is set.
 */
export async function recomputeTank(client: PoolClient, tankId: string): Promise<void> {
  const tank = await client.query<{ capacity_litre: number | null; name: string }>(
    `select capacity_litre, name from tank where id = $1`, [tankId]);
  const capacity = tank.rows[0]?.capacity_litre ?? null;

  const { rows } = await client.query<MovementRow & { movement_date: string }>(
    `select id, to_char(movement_date, 'YYYY-MM-DD') as movement_date,
            direction, qty_litre, fat_pct, snf_pct, cost_per_litre
       from tank_movement
      where tank_id = $1
      order by movement_date, created_at, id`,
    [tankId],
  );

  let balance = { ...ZERO };

  for (const m of rows) {
    const before = balance;
    balance = apply(balance, m);

    if (balance.qty_litre < -0.005) {
      throw new Error(
        `This would take ${tank.rows[0]?.name ?? "the tank"} below zero on ${m.movement_date} ` +
          `(only ${before.qty_litre.toFixed(1)} L was in it at that point).`,
      );
    }
    if (capacity !== null && balance.qty_litre > Number(capacity) + 0.005) {
      throw new Error(
        `This would overfill ${tank.rows[0]?.name ?? "the tank"} on ${m.movement_date}: ` +
          `${balance.qty_litre.toFixed(1)} L in a ${Number(capacity).toFixed(0)} L tank ` +
          `(${before.qty_litre.toFixed(1)} L was already in it).`,
      );
    }

    // What left the tank carries the tank's own blend, not a value of its own.
    const rowFat = m.direction === "out" ? before.fat_pct : m.fat_pct;
    const rowSnf = m.direction === "out" ? before.snf_pct : m.snf_pct;
    const rowCost = m.direction === "out" ? before.cost_per_litre : m.cost_per_litre;

    await client.query(
      `update tank_movement
          set fat_pct = $2, snf_pct = $3, cost_per_litre = $4,
              balance_litre = $5, balance_fat_pct = $6, balance_snf_pct = $7,
              balance_cost_per_litre = $8
        where id = $1`,
      [m.id, rowFat, rowSnf, rowCost, balance.qty_litre, balance.fat_pct, balance.snf_pct, balance.cost_per_litre],
    );
  }

  await client.query(
    `update tank set qty_litre = $2, fat_pct = $3, snf_pct = $4, cost_per_litre = $5 where id = $1`,
    [tankId, balance.qty_litre, balance.fat_pct, balance.snf_pct, balance.cost_per_litre],
  );

  // a backdated change shifts the blend later draws left at, so batches fed from this tank follow
  const fed = await client.query<{ id: string }>(
    `select distinct bulk_batch_id as id from tank_movement where tank_id = $1 and bulk_batch_id is not null`, [tankId]);
  await syncBatchMilk(client, fed.rows.map((r) => r.id));
}

/**
 * Copies onto each batch the milk it drew from the tanks: total litres, the
 * weighted-average fat and SNF, and what it cost. A batch with no draws is
 * left with none.
 */
export async function syncBatchMilk(client: PoolClient, batchIds: string[]): Promise<void> {
  if (!batchIds.length) return;
  await client.query(
    `update bulk_batch b
        set milk_litre = x.litres,
            milk_fat_pct = x.fat, milk_snf_pct = x.snf, milk_cost = x.cost
       from (select b2.id,
                    sum(m.qty_litre) as litres,
                    sum(m.qty_litre * m.fat_pct) / nullif(sum(m.qty_litre), 0) as fat,
                    sum(m.qty_litre * m.snf_pct) / nullif(sum(m.qty_litre), 0) as snf,
                    round(sum(m.qty_litre * m.cost_per_litre), 2) as cost
               from bulk_batch b2
               left join tank_movement m on m.bulk_batch_id = b2.id
              where b2.id = any($1)
              group by b2.id) x
      where x.id = b.id`,
    [batchIds],
  );
}
