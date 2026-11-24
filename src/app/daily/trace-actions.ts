"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { one, query } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { batchSteps, traceLink, type TraceProduct } from "@/lib/trace/data";
import { buildRecord, sameContent } from "@/lib/trace/records";
import { ChainError, STELLAR, createBatch, isConfigured, recordFull } from "@/lib/trace/stellar";

export type TraceResult =
  | { ok: true; traceId: string; link: string; sent: string[]; unchanged: string[] }
  | { ok: false; error: string };

/** "toned_milk" + 2026-11-25 -> "GAIA-TONED-MILK-20261125": one per product per day, like the batch itself. */
function traceIdFor(code: string, date: string) {
  return `GAIA-${code.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${date.replaceAll("-", "")}`;
}

/**
 * Puts a saved production batch on the Stellar blockchain, in full: up to four records (milk collected,
 * processed, packed, dispatched), each stored whole on chain. The first time it also creates the batch
 * twin. Recording again sends only the steps whose content changed (e.g. dispatch added later).
 */
export async function recordBatchOnChain(bulkBatchId: string, productUid: string): Promise<TraceResult> {
  try {
    if (!isConfigured()) throw new ChainError("Stellar is not set up on this server yet");
    const me = await userFromToken((await cookies()).get("session")?.value);
    const who = me ? me.name || me.email : null;

    const batch = await one<{ code: string; batch_date: string }>(
      `select p.code, to_char(b.batch_date, 'YYYY-MM-DD') as batch_date
         from bulk_batch b join bulk_product p on p.id = b.bulk_product_id where b.id = $1`,
      [bulkBatchId],
    );
    if (!batch) throw new Error("Save the day first - this batch isn't saved yet");

    const product = await one<TraceProduct>(
      `select product_uid as uid, sku_code as sku, name, nullif(concat_ws(' ', qty, unit), '') as size, image
         from product_label where product_uid = $1`,
      [productUid],
    );
    if (!product) throw new Error("Pick the product this batch is sold as");

    const steps = await batchSteps(bulkBatchId, product);
    const processed = steps?.find((s) => s.kind === "processed")?.data as { milk?: unknown; output?: unknown; ingredients?: unknown } | undefined;
    if (!steps || !processed || (!processed.milk && !processed.output && !processed.ingredients)) {
      throw new Error("Enter the milk or the yield before recording the batch");
    }

    let trace = await one<{ trace_id: string }>(`select trace_id from trace_batch where bulk_batch_id = $1`, [bulkBatchId]);
    const title = [product.name, product.size].filter(Boolean).join(" ");
    if (!trace) {
      const traceId = traceIdFor(batch.code, batch.batch_date);
      const existing = await one<{ trace_id: string }>(`select trace_id from trace_batch where trace_id = $1`, [traceId]);
      if (!existing) {
        const created = await createBatch(traceId, title).catch((e) => {
          // already on chain from an earlier try whose database write failed: carry on
          if (e instanceof ChainError && e.code === 2) return { txHash: null };
          throw e;
        });
        await query(
          `insert into trace_batch (trace_id, bulk_batch_id, product_uid, title, network, contract_id, tx_hash, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [traceId, bulkBatchId, product.uid, title, STELLAR.network, STELLAR.contractId, created.txHash, who],
        );
      } else {
        await query(`update trace_batch set bulk_batch_id = $2 where trace_id = $1`, [traceId, bulkBatchId]);
      }
      trace = { trace_id: traceId };
    } else {
      await query(`update trace_batch set product_uid = $2, title = $3 where trace_id = $1`, [trace.trace_id, product.uid, title]);
    }

    const sent: string[] = [];
    const unchanged: string[] = [];
    for (const step of steps) {
      const { bytes, hash } = buildRecord(trace.trace_id, STELLAR.contractId, step.kind, product, step.on, step.data);
      const last = await one<{ body: Buffer }>(
        `select body from trace_record where trace_id = $1 and kind = $2 order by created_at desc limit 1`,
        [trace.trace_id, step.kind],
      );
      if (last && sameContent(last.body, bytes)) {
        unchanged.push(step.kind);
        continue;
      }
      // a copy for the Dashboard; the public page reads the record from Stellar itself
      await query(
        `insert into trace_record (trace_id, kind, hash, body, created_by) values ($1, $2, $3, $4, $5)
         on conflict (hash) do nothing`,
        [trace.trace_id, step.kind, hash, bytes, who],
      );
      try {
        const res = await recordFull(trace.trace_id, step.kind, bytes);
        await query(`update trace_record set anchor_no = $2, tx_hash = $3, ledger = $4 where hash = $1`,
          [hash, res.index, res.txHash, res.ledger]);
        sent.push(step.kind);
      } catch (e) {
        if (e instanceof ChainError && e.code === 5) { unchanged.push(step.kind); continue; }
        await query(`delete from trace_record where hash = $1 and tx_hash is null`, [hash]);
        throw e;
      }
    }

    revalidatePath("/daily");
    return { ok: true, traceId: trace.trace_id, link: traceLink(trace.trace_id), sent, unchanged };
  } catch (e) {
    console.error("[trace] record failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
