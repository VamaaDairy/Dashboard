"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { centerCode } from "@/lib/vamaa/sync";
import type { Result } from "@/app/tanks/actions";

/**
 * Sets the milk-to-plant transporter that brings a farmer's milk in, or clears
 * it when `transporterId` is empty. Their share of that transporter's fuel
 * cost follows from it, for every day.
 */
export async function setFarmerTransporter(code: string, transporterId: string): Promise<Result> {
  try {
    const scenario = await activeScenarioId();
    const center = centerCode();
    if (!code) throw new Error("No farmer");

    if (!transporterId) {
      await query(
        `delete from farmer_transporter where scenario_id = $1 and center = $2 and farmer_code = $3`,
        [scenario, center, code],
      );
    } else {
      const ok = await query(
        `select 1 from transporter where id = $1 and scenario_id = $2 and section = 'milk_to_plant'`,
        [transporterId, scenario],
      );
      if (!ok.length) throw new Error("Pick a milk-to-plant transporter");
      await query(
        `insert into farmer_transporter (scenario_id, center, farmer_code, transporter_id)
         values ($1, $2, $3, $4)
         on conflict (scenario_id, center, farmer_code) do update
           set transporter_id = excluded.transporter_id, updated_at = now()`,
        [scenario, center, code, transporterId],
      );
    }

    revalidatePath("/farmers", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
