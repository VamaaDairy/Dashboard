import type { PoolClient } from "pg";
import { one, query, tx } from "@/lib/db";
import { MAX_LINES, priceDistLines, withUnits, type DistLogin } from "./index";
import type { Units } from "./packs";

/**
 * Retailer requirements (db/100_retailer_demands.sql). A retailer does not order from Gaia: it sends what it needs to
 * its distributor, who sees every retailer's requirement, puts them in its own order and is billed for it.
 */

export type DemandStatus = "open" | "ordered" | "declined" | "cancelled";

export interface DemandRow {
  id: number;
  date: string;
  status: DemandStatus;
  notes: string | null;
  retailer: { uid: string; name: string; code: string | null; phone: string | null; area: string | null };
  /** the distributor's order it went into, once ordered */
  orderId: number | null;
  total: number;
  lines: Array<{ sku: string; name: string; qty: number; units: Units | null; rate: number | null }>;
}

/** The distributor a retailer sends its requirement to (its parent in Customer Masters), or null when none is set. */
async function distributorOf(retailerUid: string): Promise<string | null> {
  const r = await one<{ uid: string | null }>(
    `select p.uid from fp_firm f join fp_firm p on p.uid = f.parent_firm_uid and p.active = 1 where f.uid = $1`,
    [retailerUid],
  );
  return r?.uid ?? null;
}

/** A retailer sends its requirement. Quantities are pieces; packs (optional) how many were entered as whole crates / boxes. */
export async function sendDemand(
  login: DistLogin,
  input: { lines: Array<{ sku: string; qty: number; packs?: number | null }>; notes?: string | null },
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  if (login.kind !== "retailer" || !login.firmUid) return { ok: false, error: "Only retailers send requirements." };
  const distributor = await distributorOf(login.firmUid);
  if (!distributor) return { ok: false, error: "Your distributor is not set yet. Please call Gaia." };

  const merged = new Map<string, number>();
  const packsOrdered = new Map<string, number>();
  for (const l of input.lines) {
    merged.set(l.sku, (merged.get(l.sku) ?? 0) + l.qty);
    if (l.packs !== undefined && l.packs !== null) packsOrdered.set(l.sku, (packsOrdered.get(l.sku) ?? 0) + l.packs);
  }
  if (!merged.size) return { ok: false, error: "The list is empty." };
  if (merged.size > MAX_LINES) return { ok: false, error: `At most ${MAX_LINES} products at a time.` };

  // the same checks as an order: on the Retail list and priced for this retailer
  const priced = await priceDistLines("retail", login.firmUid, merged);
  if (!priced.ok) return priced;
  const lines = await withUnits(priced.lines, packsOrdered);
  const names = new Map(
    (await query<{ sku: string; name: string }>(`select sku_code as sku, sku_name as name from fp_product where sku_code = any($1)`, [lines.map((l) => l.sku)]))
      .map((r) => [r.sku, r.name]),
  );
  const notes = (input.notes ?? "").trim().slice(0, 300) || null;

  return tx(async (c) => {
    const { rows } = await c.query<{ id: number }>(
      `insert into dist_demand (retailer_firm_uid, distributor_firm_uid, login_id, notes) values ($1, $2, $3, $4) returning id`,
      [login.firmUid, distributor, login.id || null, notes],
    );
    const id = rows[0].id;
    let i = 0;
    for (const l of lines) {
      await c.query(
        `insert into dist_demand_line (demand_id, line_no, sku, name, qty, units, rate) values ($1, $2, $3, $4, $5, $6, $7)`,
        [id, ++i, l.sku, names.get(l.sku) ?? l.sku, l.qty, l.units ? JSON.stringify(l.units) : null, l.dp],
      );
    }
    return { ok: true as const, id };
  });
}

/**
 * A retailer: its own requirements. A distributor: the requirements of all its retailers - every open one, and the
 * last 30 days of the rest.
 */
export async function listDemands(login: DistLogin): Promise<DemandRow[]> {
  if (!login.firmUid || login.kind === "salesman") return [];
  const mine = login.kind === "retailer";
  const rows = await query<Omit<DemandRow, "lines" | "retailer" | "total"> & { ruid: string; rname: string; rcode: string | null; rphone: string | null; rarea: string | null }>(
    `select d.id, d.created_at as date, d.status, d.notes, b.order_id as "orderId",
            r.uid as ruid, r.name as rname, r.firm_code as rcode, r.phone as rphone, coalesce(nullif(r.place, ''), r.city) as rarea
       from dist_demand d
       join fp_firm r on r.uid = d.retailer_firm_uid
       left join fp_booking_order b on b.uid = d.order_uid
      where ${mine ? "d.retailer_firm_uid = $1" : "d.distributor_firm_uid = $1"}
        and (d.status = 'open' or d.created_at > now() - interval '30 days')
      order by (d.status = 'open') desc, d.created_at desc
      limit 200`,
    [login.firmUid],
  );
  if (!rows.length) return [];
  const lines = await query<{ d: number; sku: string; name: string; qty: number; units: Units | null; rate: string | null }>(
    `select demand_id as d, sku, name, qty, units, rate from dist_demand_line where demand_id = any($1) order by demand_id, line_no`,
    [rows.map((r) => r.id)],
  );
  return rows.map(({ ruid, rname, rcode, rphone, rarea, ...r }) => {
    const own = lines.filter((l) => l.d === r.id).map(({ d: _d, rate, ...l }) => ({ ...l, rate: rate === null ? null : Number(rate) }));
    return {
      ...r,
      date: new Date(r.date).toISOString(),
      retailer: { uid: ruid, name: rname, code: rcode, phone: rphone, area: rarea },
      total: Math.round(own.reduce((s, l) => s + l.qty * (l.rate ?? 0), 0) * 100) / 100,
      lines: own,
    };
  });
}

/** The retailer withdraws its own open requirement, or the distributor declines one of its retailers'. */
export async function closeDemand(login: DistLogin, id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!login.firmUid || login.kind === "salesman") return { ok: false, error: "Not allowed." };
  const retailer = login.kind === "retailer";
  const r = await one<{ id: number }>(
    `update dist_demand set status = $3, closed_at = now(), closed_by = $4
      where id = $1 and ${retailer ? "retailer_firm_uid" : "distributor_firm_uid"} = $2 and status = 'open'
      returning id`,
    [id, login.firmUid, retailer ? "cancelled" : "declined", `${login.name} (${login.kind})`],
  );
  return r ? { ok: true } : { ok: false, error: "This requirement is no longer open." };
}

/** Inside the distributor's order transaction: the open requirements it covered are marked as ordered on it. */
export async function markDemandsOrdered(c: PoolClient, distributorUid: string, ids: number[], orderUid: string, who: string): Promise<void> {
  if (!ids.length) return;
  await c.query(
    `update dist_demand set status = 'ordered', order_uid = $3, closed_at = now(), closed_by = $4
      where id = any($1) and distributor_firm_uid = $2 and status = 'open'`,
    [ids, distributorUid, orderUid, who],
  );
}
