import "server-only";
import { query } from "@/lib/db";

/**
 * Ordering in packs: a product sold by the crate or box can be ordered as packs plus loose pieces, e.g. 2 CRT + 5 PCS.
 *
 * The pack comes from the product master (fp_product): primary_unit is the piece ("PCS", "JAR") and secondary_units
 * holds the pack as pieces-per-unit, e.g. { "CRT": 0.041666667, "PCS": 1 } = 24 pieces a crate. The order line's
 * quantity stays the total in pieces (prices, invoices and stock are per piece); the split as ordered is kept in
 * fp_booking_order_item.units, e.g. { "CRT": 2, "PCS": 5 }.
 */

export interface Pack {
  /** the pack's name: CRT, BOX, TRAY ... */
  unit: string;
  /** pieces in one pack */
  per: number;
  /** what a piece is called: PCS, JAR ... */
  base: string;
}

export type Units = Record<string, number>;

const unitName = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : null);

/** The product's pack, or null when it is only sold by the piece. */
export function packOf(primary: unknown, secondary: unknown): Pack | null {
  const base = unitName(primary) ?? "PCS";
  if (!secondary || typeof secondary !== "object") return null;
  for (const [k, v] of Object.entries(secondary as Record<string, unknown>)) {
    const unit = unitName(k);
    const f = Number(v);
    if (!unit || unit === base || !(f > 0 && f < 1)) continue;
    const per = Math.round(1 / f);
    if (per > 1) return { unit, per, base };
  }
  return null;
}

/** sku -> its pack, for the SKUs that have one. */
export async function packsFor(skus: string[]): Promise<Map<string, Pack>> {
  if (!skus.length) return new Map();
  const rows = await query<{ sku: string; primary_unit: unknown; secondary_units: unknown }>(
    `select sku_code as sku, primary_unit, secondary_units from fp_product where sku_code = any($1)`,
    [skus],
  );
  const out = new Map<string, Pack>();
  for (const r of rows) {
    const p = packOf(r.primary_unit, r.secondary_units);
    if (p) out.set(r.sku, p);
  }
  return out;
}

/**
 * The line's split for [qty] pieces: [packs] as ordered when it fits (packs × per ≤ qty), else as many whole packs
 * as fit. null when the product has no pack.
 */
export function splitUnits(qty: number, pack: Pack | undefined, packs?: number | null): Units | null {
  if (!pack) return null;
  const n = packs !== undefined && packs !== null && Number.isInteger(packs) && packs >= 0 && packs * pack.per <= qty
    ? packs
    : Math.floor(qty / pack.per);
  return { [pack.unit]: n, [pack.base]: qty - n * pack.per };
}

/** "2 CRT + 5 PCS" (a zero part left out), or null when there is no split. */
export function unitsText(units: unknown): string | null {
  if (!units || typeof units !== "object") return null;
  const parts = Object.entries(units as Record<string, unknown>)
    .map(([k, v]) => [k, Number(v)] as const)
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .map(([k, v]) => `${v} ${k}`);
  return parts.length ? parts.join(" + ") : null;
}

/** Packs in a stored split, for the pack's unit (0 when none). */
export function packsIn(units: unknown, pack: Pack | undefined): number {
  if (!pack || !units || typeof units !== "object") return 0;
  const v = Number((units as Record<string, unknown>)[pack.unit]);
  return Number.isInteger(v) && v > 0 ? v : 0;
}
