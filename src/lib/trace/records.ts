/**
 * The public records of a batch, one per step. Pure (no database, no "server-only"), so the
 * Dashboard, one-off scripts and the trace page all agree on the shape. Every record is stored in
 * full on Stellar (contract `record_full`), which hashes the exact bytes built here.
 */
import { createHash } from "node:crypto";

export type StepKind = "collected" | "processed" | "packed" | "dispatched";
export const STEP_ORDER: StepKind[] = ["collected", "processed", "packed", "dispatched"];

export interface Place {
  name: string;
  area?: string;
  lat?: number;
  lng?: number;
}

/** Milk in the tanks the batch drew from: where it was collected. Farmer names stay private. */
export interface CollectedData {
  note: string;
  from: string;
  to: string;
  total_litres: number;
  centres: {
    centre: string;
    name: string;
    kind: string;
    litres: number;
    fat_pct: number | null;
    snf_pct: number | null;
    pours: number;
    farmers: number;
    shifts: string[];
  }[];
  farmers: "On file, not published";
}

export interface ProcessedData {
  plant: Place;
  made_on: string;
  plant_batch_no?: string;
  made_as: string;
  milk?: { litres: number; fat_pct: number | null; snf_pct: number | null; tanks: number };
  lab_test?: { fat_pct: number | null; snf_pct: number | null; clr: number | null };
  ingredients?: string[];
  output?: { qty: number; unit: string };
  pasteurised?: boolean;
}

export interface PackedData {
  sku: string;
  name: string;
  size?: string;
  packed_on: string;
  use_by?: string;
  shelf_life_days?: number;
  pieces?: number;
  storage: string;
  about: string;
  highlights: string[];
  nutrition: { per: string; typical: true; rows: [string, string][] };
}

export interface DispatchedData {
  from: Place;
  trips: {
    trip: number;
    route: string;
    vehicle?: string;
    date: string;
    status: string;
    departed_at?: string;
    arrived_at?: string;
    stops: number;
    delivered: number;
    pieces: number;
  }[];
}

export type StepData = CollectedData | ProcessedData | PackedData | DispatchedData;

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

export function buildRecord(
  traceId: string,
  contractId: string,
  kind: StepKind,
  product: { sku: string; name: string; size: string | null },
  occurredOn: string,
  data: StepData,
) {
  const record = {
    schema: "gaia-trace/2",
    contract: contractId,
    batch_id: traceId,
    kind,
    occurred_at: occurredOn.length === 10 ? `${occurredOn}T00:00:00+05:30` : occurredOn,
    product: { sku: product.sku, name: product.name, size: product.size ?? undefined },
    data,
  };
  const bytes = Buffer.from(canonical(record), "utf8");
  return { record, bytes, hash: sha256(bytes) };
}

/** True when two records say the same thing (ignoring when they were built). */
export function sameContent(a: Buffer, b: Buffer): boolean {
  const pick = (x: Buffer) => {
    const r = JSON.parse(x.toString("utf8"));
    return canonical({ kind: r.kind, product: r.product, data: r.data, occurred_at: r.occurred_at });
  };
  try {
    return pick(a) === pick(b);
  } catch {
    return false;
  }
}

export const round = (v: unknown, places = 2): number | null =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 10 ** places) / 10 ** places;
