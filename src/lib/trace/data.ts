import "server-only";
import { plant } from "@/lib/dispatch";
import { one, query } from "@/lib/db";
import { syncProductLabels } from "@/lib/products/names";
import { PUBLIC_URL } from "@/lib/shop/catalog";
import { productInfo } from "@/lib/trace/product-info";
import {
  round, type CollectedData, type DispatchedData, type PackedData, type ProcessedData, type StepData, type StepKind,
} from "@/lib/trace/records";

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

// ---------- the four public steps of a batch ----------

/** Where the plant is, for the public page (the same pin the dispatch map starts from). */
function plantPlace() {
  const p = plant();
  return { name: p.name, area: "Mahasamund, Chhattisgarh, India", lat: round(p.lat, 6) ?? undefined, lng: round(p.lng, 6) ?? undefined };
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Everything the public may see about one production batch, as up to four steps. Deliberately left
 * out everywhere: costs and rates, farmer names and codes, tank names, ingredient quantities (the
 * recipe), labour, customers, and who entered what.
 */
export async function batchSteps(
  bulkBatchId: string,
  product: TraceProduct,
): Promise<{ kind: StepKind; on: string; data: StepData }[] | null> {
  const b = await one<{
    id: string; scenario_id: string; batch_date: string; batch_no: string | null; bulk_product_id: string; code: string;
    name: string; unit: string; output_qty: string | null; milk_litre: string | null; milk_fat_pct: string | null; milk_snf_pct: string | null;
  }>(
    `select b.id, b.scenario_id, to_char(b.batch_date, 'YYYY-MM-DD') as batch_date, b.batch_no, b.bulk_product_id, p.code, p.name, p.unit,
            b.output_qty, b.milk_litre, b.milk_fat_pct, b.milk_snf_pct
       from bulk_batch b join bulk_product p on p.id = b.bulk_product_id
      where b.id = $1`,
    [bulkBatchId],
  );
  if (!b) return null;
  const steps: { kind: StepKind; on: string; data: StepData }[] = [];

  // 1. collected: walk back from what the batch drew to the Vamaa collections that filled those tanks
  const draws = await query<{ tank_id: string; litres: string }>(
    `select tank_id, sum(qty_litre) as litres from tank_movement
      where bulk_batch_id = $1 and direction = 'out' group by tank_id`,
    [bulkBatchId],
  );
  const tanks = draws;
  const collections = await sourceCollections(
    draws.map((d) => ({ tank: d.tank_id, litres: Number(d.litres), until: b.batch_date })),
    addDays(b.batch_date, -7),
  );
  if (collections.length) {
    const byCentre = new Map<string, typeof collections>();
    for (const c of collections) byCentre.set(c.centre, [...(byCentre.get(c.centre) ?? []), c]);
    const names = await query<{ center: string; name: string; kind: string }>(
      `select center, name, kind from vamaa_center where center = any($1)`, [[...byCentre.keys()]]);
    const centres = [...byCentre.entries()].map(([centre, rows]) => {
      const litres = rows.reduce((t, r) => t + r.litres, 0);
      const wavg = (f: (r: (typeof rows)[number]) => number | null) => {
        const w = rows.filter((r) => f(r) !== null);
        const l = w.reduce((t, r) => t + r.litres, 0);
        return l > 0 ? w.reduce((t, r) => t + (f(r) as number) * r.litres, 0) / l : null;
      };
      const n = names.find((x) => x.center === centre);
      return {
        centre,
        name: n?.name ?? `Centre ${centre}`,
        kind: n?.kind ?? "village",
        litres: round(litres, 0) ?? 0,
        fat_pct: round(wavg((r) => r.fat)),
        snf_pct: round(wavg((r) => r.snf)),
        pours: rows.length,
        farmers: new Set(rows.map((r) => r.farmer)).size,
        shifts: [...new Set(rows.map((r) => (r.shift === "M" ? "Morning" : r.shift === "E" ? "Evening" : r.shift)).filter(Boolean))].sort(),
      };
    }).sort((x, y) => y.litres - x.litres);
    const days = collections.map((c) => c.day).sort();
    const data: CollectedData = {
      note: "The most recent collections that filled the tanks this batch was drawn from, enough to cover the milk it used. Milk in a tank is a blend, so these are its sources, not litre-for-litre.",
      from: days[0],
      to: days[days.length - 1],
      total_litres: round(collections.reduce((t, c) => t + c.litres, 0), 0) ?? 0,
      centres,
      farmers: "On file, not published",
    };
    steps.push({ kind: "collected", on: data.to, data });
  }

  // 2. processed at the plant
  const ingredients = await query<{ name: string }>(
    `select name from bulk_batch_ingredient where batch_id = $1 and qty > 0 order by sort_order, name`, [bulkBatchId]);
  const lab = await one<{ fat: string | null; snf: string | null; clr: string | null }>(
    `select sum(x.fat_pct * m.qty_litre) / nullif(sum(case when x.fat_pct is not null then m.qty_litre end), 0) as fat,
            sum(x.snf_pct * m.qty_litre) / nullif(sum(case when x.snf_pct is not null then m.qty_litre end), 0) as snf,
            sum(x.clr * m.qty_litre) / nullif(sum(case when x.clr is not null then m.qty_litre end), 0) as clr
       from tank_movement m join production_milk_test x on x.batch_id = m.bulk_batch_id and x.tank_id = m.tank_id
      where m.bulk_batch_id = $1 and m.direction = 'out'`,
    [bulkBatchId],
  );
  const milkLitres = Number(b.milk_litre ?? 0);
  const processed: ProcessedData = {
    plant: plantPlace(),
    made_on: b.batch_date,
    plant_batch_no: b.batch_no ?? undefined,
    made_as: b.name,
    milk: milkLitres >= 1
      ? { litres: round(milkLitres, 0) ?? 0, fat_pct: round(b.milk_fat_pct), snf_pct: round(b.milk_snf_pct), tanks: tanks.length }
      : undefined,
    lab_test: lab && (lab.fat || lab.snf || lab.clr) ? { fat_pct: round(lab.fat), snf_pct: round(lab.snf), clr: round(lab.clr, 1) } : undefined,
    ingredients: ingredients.length ? [...new Set(ingredients.map((i) => i.name))] : undefined,
    output: Number(b.output_qty ?? 0) > 0 ? { qty: round(b.output_qty, 1) ?? 0, unit: b.unit } : undefined,
    pasteurised: /milk|dahi|curd|paneer|lassi|chaas/i.test(b.name) ? true : undefined,
  };
  steps.push({ kind: "processed", on: b.batch_date, data: processed });

  // 3. packed as the SKU the customer holds
  const master = await one<{ category: string | null; description: string | null }>(
    `select category, description from fp_product where uid = $1`, [product.uid]);
  const sku = await one<{ shelf_life_days: number | null; pieces: string | null }>(
    `select s.shelf_life_days,
            (select d.cases * s.pcs_per_case + d.loose_pcs from sku_pack_day d where d.sku_id = s.id and d.day = $3::date) as pieces
       from sku s where s.scenario_id = $1 and s.code = $2`,
    [b.scenario_id, product.sku, b.batch_date],
  );
  const info = productInfo(master?.category ?? null, product.name, master?.description);
  const life = sku?.shelf_life_days ?? null;
  const packed: PackedData = {
    sku: product.sku,
    name: product.name,
    size: product.size ?? undefined,
    packed_on: b.batch_date,
    shelf_life_days: life ?? undefined,
    use_by: life ? addDays(b.batch_date, life) : undefined,
    pieces: sku?.pieces && Number(sku.pieces) > 0 ? Math.round(Number(sku.pieces)) : undefined,
    storage: info.storage,
    about: info.about,
    highlights: info.highlights,
    nutrition: { per: info.per, typical: true, rows: info.nutrition },
  };
  steps.push({ kind: "packed", on: b.batch_date, data: packed });

  // 4. dispatched: trucks that left the plant with this SKU on the day it was made or the two days after
  const trips = await query<{
    trip: number; route: string; vehicle: string | null; date: string; status: string;
    started_at: Date | null; ended_at: Date | null; stops: number; delivered: number; pieces: string;
  }>(
    `select t.id as trip, t.route_name as route, t.vehicle_no as vehicle, to_char(t.trip_date, 'YYYY-MM-DD') as date, t.status,
            t.started_at, t.ended_at,
            (select count(*)::int from dist_trip_stop s2 where s2.trip_id = t.id) as stops,
            (select count(*)::int from dist_trip_stop s2 where s2.trip_id = t.id and s2.status = 'delivered') as delivered,
            sum(i.quantity) as pieces
       from dist_trip t
       join dist_trip_stop s on s.trip_id = t.id and s.status <> 'not_delivered'
       join fp_booking_order_item i on i.booking_order_uid = s.order_uid and i.product_uid = $1
      where t.trip_date between $2::date and $3::date and t.status <> 'cancelled'
      group by t.id
      having sum(i.quantity) > 0
      order by t.trip_date, t.started_at nulls last, t.id
      limit 20`,
    [product.uid, b.batch_date, addDays(b.batch_date, 2)],
  );
  if (trips.length) {
    const data: DispatchedData = {
      from: plantPlace(),
      trips: trips.map((t) => ({
        trip: t.trip,
        route: t.route,
        vehicle: t.vehicle ?? undefined,
        date: t.date,
        status: t.status,
        departed_at: t.started_at ? new Date(t.started_at).toISOString() : undefined,
        arrived_at: t.ended_at ? new Date(t.ended_at).toISOString() : undefined,
        stops: t.stops,
        delivered: t.delivered,
        pieces: Math.round(Number(t.pieces)),
      })),
    };
    steps.push({ kind: "dispatched", on: trips[trips.length - 1].date, data });
  }

  return steps;
}

type Collection = { centre: string; farmer: string; shift: string; day: string; litres: number; fat: number | null; snf: number | null };

/**
 * The Vamaa collections behind milk drawn from tanks: each tank's latest inflows (on or before the draw,
 * not before `since`), newest first, until they cover the litres drawn. A transfer from another tank is
 * followed back to that tank (two hops at most: raw tank -> process tank -> batch).
 */
async function sourceCollections(
  needs: { tank: string; litres: number; until: string }[],
  since: string,
  depth = 0,
): Promise<Collection[]> {
  const found: Collection[] = [];
  for (const need of needs) {
    if (!(need.litres > 0)) continue;
    const inflows = await query<{
      source: string; source_ref: string | null; transfer_of: string | null; qty_litre: string;
      fat_pct: string | null; snf_pct: string | null; day: string;
    }>(
      `select source, source_ref, transfer_of, qty_litre, fat_pct, snf_pct, to_char(movement_date, 'YYYY-MM-DD') as day
         from tank_movement
        where tank_id = $1 and direction = 'in' and source in ('vamaa', 'transfer')
          and movement_date between $2::date and $3::date
        order by movement_date desc, created_at desc
        limit 400`,
      [need.tank, since, need.until],
    );
    let left = need.litres;
    for (const m of inflows) {
      if (left <= 0.5) break;
      const litres = Number(m.qty_litre);
      if (m.source === "vamaa" && m.source_ref) {
        // vamaa|<centre>|<day>|<farmer>|<shift>|...
        const [, centre, , farmer, shift] = m.source_ref.split("|");
        found.push({ centre, farmer, shift, day: m.day, litres, fat: m.fat_pct === null ? null : Number(m.fat_pct), snf: m.snf_pct === null ? null : Number(m.snf_pct) });
      } else if (m.source === "transfer" && m.transfer_of && depth < 2) {
        const from = await one<{ tank_id: string; day: string }>(
          `select tank_id, to_char(movement_date, 'YYYY-MM-DD') as day from tank_movement where id = $1`, [m.transfer_of]);
        if (from) found.push(...(await sourceCollections([{ tank: from.tank_id, litres: Math.min(litres, left), until: from.day }], since, depth + 1)));
      }
      left -= litres;
    }
  }
  return found;
}
