import "server-only";
import { createHash } from "node:crypto";
import { one, query } from "@/lib/db";
import { syncProductLabels } from "@/lib/products/names";
import { PUBLIC_URL } from "@/lib/shop/catalog";
import { STELLAR } from "@/lib/trace/stellar";

/** Where anchored records are fetched from. It goes on chain for good, so it must be the live public address. */
export const TRACE_URL = (process.env.TRACE_PUBLIC_URL ?? PUBLIC_URL).replace(/\/+$/, "");

export const traceLink = (traceId: string) => `${TRACE_URL}/trace/${encodeURIComponent(traceId)}`;
export const recordLink = (hash: string) => `${TRACE_URL}/api/trace/records/${hash}`;

/** A SKU a production batch can be shown to customers as. */
export interface TraceProduct {
  uid: string;
  sku: string;
  name: string;
  size: string | null;
  image: string | null;
}

/** What the Production page needs to show for a batch already on chain. */
export interface TraceState {
  bulk_batch_id: string;
  trace_id: string;
  product_uid: string | null;
  title: string;
  records: number;
  last_at: string;
  /** the public page (the QR target) */
  link: string;
}

export async function traceProducts(): Promise<TraceProduct[]> {
  await syncProductLabels();
  return query<TraceProduct>(
    `select l.product_uid as uid, l.sku_code as sku, l.name, nullif(concat_ws(' ', l.qty, l.unit), '') as size, l.image
       from product_label l
      order by (l.image is null), l.name, l.sku_no`,
  );
}

export async function traceStates(bulkBatchIds: string[]): Promise<TraceState[]> {
  if (!bulkBatchIds.length) return [];
  const rows = await query<Omit<TraceState, "link">>(
    `select t.bulk_batch_id, t.trace_id, t.product_uid, t.title,
            count(r.id)::int as records, coalesce(max(r.created_at), t.created_at)::text as last_at
       from trace_batch t left join trace_record r on r.trace_id = t.trace_id
      where t.bulk_batch_id = any($1)
      group by t.trace_id`,
    [bulkBatchIds],
  );
  return rows.map((r) => ({ ...r, link: traceLink(r.trace_id) }));
}

/** The SKU last used for a bulk product, to pre-select it next time. */
export async function lastProductFor(bulkProductIds: string[]): Promise<Record<string, string>> {
  if (!bulkProductIds.length) return {};
  const rows = await query<{ bulk_product_id: string; product_uid: string }>(
    `select distinct on (b.bulk_product_id) b.bulk_product_id, t.product_uid
       from trace_batch t join bulk_batch b on b.id = t.bulk_batch_id
      where b.bulk_product_id = any($1) and t.product_uid is not null
      order by b.bulk_product_id, t.created_at desc`,
    [bulkProductIds],
  );
  return Object.fromEntries(rows.map((r) => [r.bulk_product_id, r.product_uid]));
}

// ---------- the public record ----------

/** RFC 8785-style canonical JSON: keys sorted at every level, no spaces. The same data always gives the same bytes. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const entries = Object.entries(v as Record<string, unknown>)
    .filter(([, x]) => x !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`;
}

export const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

const n = (v: unknown, places = 2) => (v === null || v === undefined ? null : Math.round(Number(v) * 10 ** places) / 10 ** places);

/**
 * What the public sees about one production batch. Deliberately left out: every cost, tank names,
 * ingredient quantities (the recipe), labour, and who entered what.
 */
export async function batchFacts(bulkBatchId: string) {
  const b = await one<{
    id: string; batch_date: string; batch_no: string | null; code: string; name: string; unit: string;
    output_qty: string | null; milk_litre: string | null; milk_fat_pct: string | null; milk_snf_pct: string | null;
  }>(
    `select b.id, to_char(b.batch_date, 'YYYY-MM-DD') as batch_date, b.batch_no, p.code, p.name, p.unit,
            b.output_qty, b.milk_litre, b.milk_fat_pct, b.milk_snf_pct
       from bulk_batch b join bulk_product p on p.id = b.bulk_product_id
      where b.id = $1`,
    [bulkBatchId],
  );
  if (!b) return null;

  const ingredients = await query<{ name: string }>(
    `select name from bulk_batch_ingredient where batch_id = $1 and qty > 0 order by sort_order, name`,
    [bulkBatchId],
  );
  // the lab test of the milk taken out, weighted by litres, across the tanks that were tested
  const lab = await one<{ fat: string | null; snf: string | null; clr: string | null; litres: string | null }>(
    `select sum(x.fat_pct * m.qty_litre) / nullif(sum(case when x.fat_pct is not null then m.qty_litre end), 0) as fat,
            sum(x.snf_pct * m.qty_litre) / nullif(sum(case when x.snf_pct is not null then m.qty_litre end), 0) as snf,
            sum(x.clr * m.qty_litre) / nullif(sum(case when x.clr is not null then m.qty_litre end), 0) as clr,
            sum(m.qty_litre) as litres
       from tank_movement m join production_milk_test x on x.batch_id = m.bulk_batch_id and x.tank_id = m.tank_id
      where m.bulk_batch_id = $1 and m.direction = 'out'`,
    [bulkBatchId],
  );

  return {
    made_on: b.batch_date,
    plant_batch_no: b.batch_no ?? undefined,
    made_as: b.name,
    output: b.output_qty !== null && Number(b.output_qty) > 0 ? { qty: n(b.output_qty, 1), unit: b.unit } : undefined,
    milk: Number(b.milk_litre ?? 0) > 0
      ? { litres: n(b.milk_litre, 0), fat_pct: n(b.milk_fat_pct), snf_pct: n(b.milk_snf_pct) }
      : undefined,
    lab_test: lab && (lab.fat || lab.snf || lab.clr)
      ? { fat_pct: n(lab.fat), snf_pct: n(lab.snf), clr: n(lab.clr, 1) }
      : undefined,
    ingredients: ingredients.length ? [...new Set(ingredients.map((i) => i.name))] : undefined,
  };
}

export function buildRecord(traceId: string, kind: string, product: TraceProduct, facts: NonNullable<Awaited<ReturnType<typeof batchFacts>>>) {
  const record = {
    schema: "gaia-trace/1",
    contract: STELLAR.contractId,
    batch_id: traceId,
    kind,
    occurred_at: `${facts.made_on}T00:00:00+05:30`,
    product: { sku: product.sku, name: product.name, size: product.size ?? undefined },
    data: facts,
  };
  const bytes = Buffer.from(canonical(record), "utf8");
  return { record, bytes, hash: sha256(bytes) };
}
