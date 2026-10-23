"use server";

import { revalidatePath } from "next/cache";
import { tx } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { recomputeTank } from "@/lib/tanks/engine";
import { centers, ensureDays, storedCollections } from "@/lib/vamaa/sync";
import { collectionMilk, collectionRef } from "@/lib/vamaa/keys";
import { collectionPrice, getChart } from "@/lib/procurement/rate-chart";
import type { Result } from "@/app/tanks/actions";

export type TankPart = { tankId: string; litres: number };

/**
 * Puts one Milk in collection into a tank (or takes it back out, when
 * `tankId` is empty). The collection is read from the saved copy rather than trusted
 * from the page, so the tank always gets the app's own litres, fat and SNF.
 * Moving it to another tank takes it out of the first one; both tanks' ledgers
 * are replayed, so a tank that would overfill refuses and nothing changes.
 */
export async function assignCollectionToTank(date: string, ref: string, tankId: string): Promise<Result> {
  return assignCollectionToTanks(date, ref, tankId ? [{ tankId, litres: 0 }] : []);
}

/**
 * Same, but the collection can be split between two tanks. `parts` is empty to take the milk out, one
 * part (litres ignored - it all goes there) or two parts in different tanks whose litres add up to the
 * collection's quantity. The first part keeps the collection's ref; the second is stored as `ref#s2`.
 */
export async function assignCollectionToTanks(date: string, ref: string, parts: TankPart[]): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Bad date");
    if (parts.length > 2) throw new Error("A collection can be split between at most 2 tanks");
    if (parts.length === 2 && parts[0].tankId === parts[1].tankId) throw new Error("Pick two different tanks to split into");
    const scenario = await activeScenarioId();

    let inserts: { tankId: string; ref: string; litres: number; fat: number; snf: number; costPerLitre: number; notes: string }[] = [];
    if (parts.length) {
      // the saved copy, topped up from the app if this day is recent and stale
      await ensureDays(date, date).catch(() => undefined);
      const rows = await storedCollections(date);
      const row = rows.find((r) => collectionRef(r, date) === ref);
      if (!row) throw new Error("That collection is no longer in the Vamaa data for this date - reload the page");
      const milk = collectionMilk(row);
      // the collection's price, by the same rule as the Milk in page: the rate chart, or the app's price
      // before it - except a tanker, whose price isn't set yet (the app only sends a placeholder)
      const centre = (await centers()).find((c) => c.center === row.center_code);
      const tanker = centre?.kind === "tanker";
      milk.costPerLitre = tanker ? 0 : collectionPrice(await getChart({ date }), row).rate ?? 0;
      if (milk.litres <= 0) throw new Error("This collection has no quantity to put in a tank");
      const who = tanker ? `tanker · supplier ${row.farmer_code}` : `farmer ${row.farmer_code} · ${row.shift === "M" ? "morning" : "evening"} shift`;
      const notes = `Milk in · ${centre?.name ?? row.center_code} · ${who}`;

      let litres = parts.map(() => milk.litres);
      if (parts.length === 2) {
        const a = Math.round(Number(parts[0].litres) * 100) / 100;
        const b = Math.round((milk.litres - a) * 100) / 100;
        if (!(a > 0) || !(b > 0)) throw new Error(`Each tank needs some milk - the two amounts must add up to ${milk.litres} L`);
        litres = [a, b];
      }
      inserts = parts.map((p, i) => ({
        ...milk, tankId: p.tankId, litres: litres[i], ref: i === 0 ? ref : `${ref}#s2`,
        notes: parts.length === 2 ? `${notes} · split ${i + 1}/2` : notes,
      }));
    }

    await tx(async (client) => {
      const old = await client.query<{ tank_id: string; created_at: Date }>(
        `delete from tank_movement
          where scenario_id = $1 and (source_ref = $2 or source_ref = $2 || '#s2')
          returning tank_id, created_at`,
        [scenario, ref],
      );
      // A collection moved to another tank keeps its original place in the day's
      // order, so it still lands before any withdrawals entered after it.
      const placed = old.rows.map((r) => r.created_at).sort((x, y) => +x - +y)[0] ?? null;
      for (const ins of inserts) {
        await client.query(
          `insert into tank_movement
             (scenario_id, tank_id, movement_date, direction, qty_litre, fat_pct, snf_pct,
              cost_per_litre, notes, source, source_ref, created_at)
           values ($1, $2, $3, 'in', $4, $5, $6, $7, $8, 'vamaa', $9, coalesce($10, now()))`,
          [scenario, ins.tankId, date, ins.litres, ins.fat, ins.snf, ins.costPerLitre, ins.notes, ins.ref, placed],
        );
      }
      const touched = new Set([...old.rows.map((r) => r.tank_id), ...inserts.map((i) => i.tankId)]);
      for (const id of touched) await recomputeTank(client, id);
    });

    revalidatePath("/procurement/vamaa", "layout");
    revalidatePath("/tanks", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
