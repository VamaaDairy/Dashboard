"use server";

import { revalidatePath } from "next/cache";
import { tx } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { recomputeTank } from "@/lib/tanks/engine";
import { ensureDays, storedCollections } from "@/lib/vamaa/sync";
import { collectionMilk, collectionRef } from "@/lib/vamaa/keys";
import type { Result } from "@/app/tanks/actions";

/**
 * Puts one Milk in collection into a tank (or takes it back out, when
 * `tankId` is empty). The collection is read from the saved copy rather than trusted
 * from the page, so the tank always gets the app's own litres, fat and SNF.
 * Moving it to another tank takes it out of the first one; both tanks' ledgers
 * are replayed, so a tank that would overfill refuses and nothing changes.
 */
export async function assignCollectionToTank(date: string, ref: string, tankId: string): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Bad date");
    const shortName = process.env.VAMAA_CENTER_SHORT_NAME;
    if (!shortName) throw new Error("VAMAA_CENTER_SHORT_NAME is not set in .env");
    const scenario = await activeScenarioId();

    let insert: { litres: number; fat: number; snf: number; costPerLitre: number; notes: string } | null = null;
    if (tankId) {
      // the saved copy, topped up from the app if this day is recent and stale
      await ensureDays(date, date).catch(() => undefined);
      const rows = await storedCollections(date);
      const row = rows.find((r) => collectionRef(r, date) === ref);
      if (!row) throw new Error("That collection is no longer in the Vamaa data for this date - reload the page");
      const milk = collectionMilk(row);
      if (milk.litres <= 0) throw new Error("This collection has no quantity to put in a tank");
      insert = { ...milk, notes: `Milk in · farmer ${row.farmer_code} · ${row.shift === "M" ? "morning" : "evening"} shift` };
    }

    await tx(async (client) => {
      const old = await client.query<{ tank_id: string; created_at: Date }>(
        `delete from tank_movement where scenario_id = $1 and source_ref = $2 returning tank_id, created_at`,
        [scenario, ref],
      );
      if (insert) {
        // A collection moved to another tank keeps its original place in the day's
        // order, so it still lands before any withdrawals entered after it.
        await client.query(
          `insert into tank_movement
             (scenario_id, tank_id, movement_date, direction, qty_litre, fat_pct, snf_pct,
              cost_per_litre, notes, source, source_ref, created_at)
           values ($1, $2, $3, 'in', $4, $5, $6, $7, $8, 'vamaa', $9, coalesce($10, now()))`,
          [
            scenario, tankId, date, insert.litres, insert.fat, insert.snf, insert.costPerLitre,
            insert.notes, ref, old.rows[0]?.created_at ?? null,
          ],
        );
      }
      const touched = new Set([...old.rows.map((r) => r.tank_id), ...(tankId ? [tankId] : [])]);
      for (const id of touched) await recomputeTank(client, id);
    });

    revalidatePath("/procurement/vamaa", "layout");
    revalidatePath("/tanks", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
