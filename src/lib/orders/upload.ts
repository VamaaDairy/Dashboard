import { entityOf, type Col } from "./entities";
import { refOptions, saveRow } from "./crud";
import { adjustStock } from "./trade";
import { query } from "@/lib/db";

/** What can be bulk-loaded from a CSV, and the access key each needs. */
export const UPLOADS: Array<{ key: string; label: string; hint?: string }> = [
  { key: "customer", label: "Customers", hint: "Distributor, Salesman, Beat and Channel are matched by name." },
  { key: "product", label: "Products", hint: "Category and Brand are matched by name." },
  { key: "staff", label: "Employees" },
  { key: "beat", label: "Routes / beats" },
  { key: "channel_rate", label: "Channel rates" },
  { key: "slab", label: "Slab pricing" },
  { key: "holiday", label: "Holidays" },
  { key: "kpi_target", label: "KPI targets", hint: "Month as YYYY-MM." },
  { key: "customer_target", label: "Customer targets", hint: "Month as YYYY-MM." },
  { key: "opening_stock", label: "Opening stock", hint: "Columns: SKU, Quantity." },
];

const formCols = (entity: string): Col[] => entityOf(entity).cols.filter((c) => !c.hideInForm && !c.sql);

export function templateHeaders(entity: string): string[] {
  return entity === "opening_stock" ? ["SKU", "Quantity"] : formCols(entity).map((c) => c.label);
}

/** RFC-4180-ish CSV: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export interface ImportResult { created: number; errors: Array<{ line: number; message: string }> }

export async function importCsv(entity: string, text: string): Promise<ImportResult> {
  if (!UPLOADS.some((u) => u.key === entity)) throw new Error("That cannot be uploaded");
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("The file needs a header row and at least one data row");
  if (rows.length > 5001) throw new Error("Upload at most 5000 rows at a time");
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const out: ImportResult = { created: 0, errors: [] };

  if (entity === "opening_stock") {
    const si = head.indexOf("sku"), qi = head.findIndex((h) => h === "quantity" || h === "qty");
    if (si < 0 || qi < 0) throw new Error("Columns needed: SKU, Quantity");
    const skus = new Map((await query<{ id: string; sku: string }>(`select id, sku from ord_product`)).map((p) => [p.sku.toLowerCase(), p.id]));
    for (const [i, r] of rows.slice(1).entries()) {
      try {
        const id = skus.get((r[si] ?? "").trim().toLowerCase());
        if (!id) throw new Error(`Unknown SKU "${r[si]}"`);
        const q = Number((r[qi] ?? "").replace(/,/g, ""));
        if (!(q > 0)) throw new Error(`Quantity "${r[qi]}" must be more than zero`);
        await adjustStock(id, q, "opening", "Bulk upload");
        out.created++;
      } catch (e) { out.errors.push({ line: i + 2, message: e instanceof Error ? e.message : "Failed" }); }
    }
    return out;
  }

  const cols = formCols(entity);
  const pos = new Map<string, number>();
  for (const c of cols) {
    const i = head.findIndex((h) => h === c.label.toLowerCase() || h === c.key);
    if (i >= 0) pos.set(c.key, i);
  }
  const missing = cols.filter((c) => c.required && !pos.has(c.key)).map((c) => c.label);
  if (missing.length) throw new Error(`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);

  const refs: Record<string, Map<string, string>> = {};
  for (const c of cols) {
    if (c.type === "ref" && c.ref && pos.has(c.key)) {
      refs[c.key] = new Map((await refOptions(c.ref)).map((o) => [o.label.trim().toLowerCase(), o.id]));
    }
  }

  for (const [i, r] of rows.slice(1).entries()) {
    try {
      const values: Record<string, unknown> = {};
      for (const c of cols) {
        const raw = (r[pos.get(c.key) ?? -1] ?? "").trim();
        if (c.type === "ref") {
          if (!raw) { values[c.key] = ""; continue; }
          const id = refs[c.key]?.get(raw.toLowerCase());
          if (!id) throw new Error(`${c.label}: "${raw}" not found`);
          values[c.key] = id;
        } else if (c.type === "bool") values[c.key] = /^(yes|y|true|1)$/i.test(raw);
        else if (c.type === "select") values[c.key] = raw === "" ? (c.initial ?? "") : raw.toLowerCase().replace(/ /g, "_");
        else values[c.key] = raw === "" && c.initial && c.initial !== "today" && c.initial !== "thismonth" ? c.initial : raw;
      }
      await saveRow(entity, null, values);
      out.created++;
    } catch (e) { out.errors.push({ line: i + 2, message: e instanceof Error ? e.message : "Failed" }); }
  }
  return out;
}
