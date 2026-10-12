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
 *
 * Milk moved on to another tank carries this tank's blend: each transfer
 * 'in' is updated to what its 'out' left at and the receiving tank is
 * recomputed in turn (`seen` stops a loop of tanks feeding each other).
 */
export async function recomputeTank(client: PoolClient, tankId: string, seen: Set<string> = new Set()): Promise<void> {
  seen.add(tankId);
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

  // milk moved on to other tanks carries the blend it left this one at
  const moved = await client.query<{ tank_id: string; changed: boolean }>(
    `update tank_movement i
        set fat_pct = o.fat_pct, snf_pct = o.snf_pct, cost_per_litre = o.cost_per_litre, qty_litre = o.qty_litre
       from tank_movement o
      where i.transfer_of = o.id and o.tank_id = $1
        and (i.fat_pct is distinct from o.fat_pct or i.snf_pct is distinct from o.snf_pct
             or i.cost_per_litre is distinct from o.cost_per_litre or i.qty_litre is distinct from o.qty_litre)
      returning i.tank_id, true as changed`,
    [tankId],
  );
  for (const t of new Set(moved.rows.map((r) => r.tank_id))) {
    if (!seen.has(t)) await recomputeTank(client, t, seen);
  }

  // a backdated change shifts the blend later draws left at, so batches fed from this tank follow
  const fed = await client.query<{ id: string }>(
    `select distinct bulk_batch_id as id from tank_movement where tank_id = $1 and bulk_batch_id is not null`, [tankId]);
  const batchIds = fed.rows.map((r) => r.id);
  await syncBatchReturns(client, batchIds, seen);
  await syncBatchMilk(client, batchIds);
}

/**
 * Milk a batch gave back to a tank goes back at the blend it was drawn at:
 * the weighted fat, SNF and ₹/L of the batch's draws. Updates each return
 * 'in' to that and replays the tank it went to (a tank already being
 * replayed is replayed again, once - the second pass finds nothing to change).
 */
async function syncBatchReturns(client: PoolClient, batchIds: string[], seen: Set<string>): Promise<void> {
  if (!batchIds.length) return;
  const changed = await client.query<{ tank_id: string }>(
    `update tank_movement i
        set fat_pct = x.fat, snf_pct = x.snf, cost_per_litre = x.cost
       from (select o.bulk_batch_id as id,
                    sum(o.qty_litre * o.fat_pct) / nullif(sum(o.qty_litre), 0) as fat,
                    sum(o.qty_litre * o.snf_pct) / nullif(sum(o.qty_litre), 0) as snf,
                    sum(o.qty_litre * o.cost_per_litre) / nullif(sum(o.qty_litre), 0) as cost
               from tank_movement o
              where o.bulk_batch_id = any($1) and o.direction = 'out'
              group by o.bulk_batch_id) x
      where i.bulk_batch_id = x.id and i.direction = 'in' and i.source = 'production_return'
        and (abs(coalesce(i.fat_pct, -1) - coalesce(x.fat, 0)) > 0.0001
             or abs(coalesce(i.snf_pct, -1) - coalesce(x.snf, 0)) > 0.0001
             or abs(coalesce(i.cost_per_litre, -1) - coalesce(x.cost, 0)) > 0.0001)
      returning i.tank_id`,
    [batchIds],
  );
  for (const t of new Set(changed.rows.map((r) => r.tank_id))) {
    await recomputeTank(client, t, seen.has(t) ? new Set() : seen);
  }
}

/**
 * Copies onto each batch the milk it drew from the tanks: total litres, the
 * weighted-average fat and SNF, and what it cost - net of any milk it gave
 * back to a tank (returned at the draws' own blend, so fat and SNF hold).
 * A batch with no draws is left with none.
 */
export async function syncBatchMilk(client: PoolClient, batchIds: string[]): Promise<void> {
  if (!batchIds.length) return;
  await client.query(
    `update bulk_batch b
        set milk_litre = x.litres,
            milk_fat_pct = x.fat, milk_snf_pct = x.snf, milk_cost = x.cost
       from (select b2.id,
                    sum(case when m.direction = 'out' then m.qty_litre else -m.qty_litre end) as litres,
                    sum(case when m.direction = 'out' then m.qty_litre * m.fat_pct else -m.qty_litre * m.fat_pct end)
                      / nullif(sum(case when m.direction = 'out' then m.qty_litre else -m.qty_litre end), 0) as fat,
                    sum(case when m.direction = 'out' then m.qty_litre * m.snf_pct else -m.qty_litre * m.snf_pct end)
                      / nullif(sum(case when m.direction = 'out' then m.qty_litre else -m.qty_litre end), 0) as snf,
                    round(sum(case when m.direction = 'out' then m.qty_litre * m.cost_per_litre else -m.qty_litre * m.cost_per_litre end), 2) as cost
               from bulk_batch b2
               left join tank_movement m on m.bulk_batch_id = b2.id
              where b2.id = any($1)
              group by b2.id) x
      where x.id = b.id`,
    [batchIds],
  );
}
