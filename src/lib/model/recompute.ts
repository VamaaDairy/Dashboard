import { pool } from "@/lib/db";
import { calculate } from "./engine";
import { loadSnapshot } from "./load";
import type { CalcResult, Snapshot } from "./types";

/**
 * Recalculates the whole scenario and writes the results back: cached numbers on
 * every parameter / cell / BOM line, plus the freshly discovered dependency graph.
 * Cheap enough (thousands of nodes) to run on every edit, which keeps the sheet
 * honest - there is no such thing as a stale number.
 */
export async function recompute(
  scenarioId: string,
  triggeredBy = "manual",
): Promise<{ result: CalcResult; snapshot: Snapshot; durationMs: number }> {
  const started = Date.now();
  const snapshot = await loadSnapshot(scenarioId);
  const result = calculate(snapshot);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const run = await client.query<{ id: string }>(
      `insert into calc_run (scenario_id, triggered_by) values ($1, $2) returning id`,
      [scenarioId, triggeredBy],
    );

    // --- parameters
    for (const p of snapshot.parameters) {
      const r = result.nodes.get(`param:${p.key}`);
      await client.query(
        `update parameter set computed_num = $2, error = $3, computed_at = now() where id = $1`,
        [p.id, typeof r?.value === "number" ? r.value : null, r?.error ?? null],
      );
    }

    // --- field values (upsert so computed-only cells get a cache row)
    const objectById = new Map(snapshot.objects.map((o) => [o.id, o]));
    const fieldsByClass = new Map<string, typeof snapshot.fields>();
    for (const f of snapshot.fields) {
      if (!f.is_active) continue;
      const list = fieldsByClass.get(f.class_id) ?? [];
      list.push(f);
      fieldsByClass.set(f.class_id, list);
    }

    for (const object of objectById.values()) {
      for (const field of fieldsByClass.get(object.class_id) ?? []) {
        const r = result.nodes.get(`field:${object.code}.${field.key}`);
        if (!r) continue;
        await client.query(
          `insert into field_value (object_id, field_def_id, computed_num, computed_text, error, computed_at)
           values ($1, $2, $3, $4, $5, now())
           on conflict (object_id, field_def_id) do update
             set computed_num = excluded.computed_num,
                 computed_text = excluded.computed_text,
                 error = excluded.error,
                 computed_at = now()`,
          [
            object.id,
            field.id,
            typeof r.value === "number" ? r.value : null,
            typeof r.value === "string" ? r.value : null,
            r.error,
          ],
        );
      }
    }

    // --- bom lines
    for (const line of snapshot.bomLines) {
      const r = result.nodes.get(`bom:${line.id}`);
      const parts = result.lines.get(line.id);
      await client.query(
        `update bom_line
            set computed_qty = $2, computed_rate = $3, computed_divisor = $4,
                computed_amount = $5, error = $6, computed_at = now()
          where id = $1`,
        [line.id, parts?.qty ?? null, parts?.rate ?? null, parts?.divisor ?? null,
         typeof r?.value === "number" ? r.value : null, r?.error ?? null],
      );
    }

    // --- dependency graph
    await client.query(`delete from dependency_edge where scenario_id = $1`, [scenarioId]);
    if (result.edges.length) {
      const values: string[] = [];
      const params: unknown[] = [scenarioId];
      for (const e of result.edges) {
        params.push(e.src, e.dst);
        values.push(`($1, $${params.length - 1}, $${params.length})`);
      }
      await client.query(
        `insert into dependency_edge (scenario_id, src_ref, dst_ref) values ${values.join(",")}
         on conflict do nothing`,
        params,
      );
    }

    const durationMs = Date.now() - started;
    await client.query(
      `update calc_run set status = $2, node_count = $3, error_count = $4,
              duration_ms = $5, finished_at = now() where id = $1`,
      [run.rows[0].id, result.errorCount ? "error" : "ok", result.nodes.size, result.errorCount, durationMs],
    );
    await client.query("commit");
    return { result, snapshot, durationMs };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
