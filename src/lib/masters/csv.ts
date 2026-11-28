import type { MasterDef } from "./types";
import { cellText } from "./format";

// a leading = + @ (or a minus before a non-digit) would be run as a formula by Excel
const escape = (v: string) => {
  const s = /^[=+@]|^-(?!\d)/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV text (with a BOM so Excel reads UTF-8) from a header row and rows of plain values. */
export function plainCsv(head: string[], rows: Array<Array<string | number | boolean | Date | null | undefined>>): string {
  const text = (v: string | number | boolean | Date | null | undefined) =>
    v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
  return "\uFEFF" + [head.map(escape).join(","), ...rows.map((r) => r.map((v) => escape(text(v))).join(","))].join("\r\n");
}

/** CSV text (with a BOM so Excel reads UTF-8) for the rows of a screen. */
export function toCsv(def: MasterDef, rows: Array<Record<string, unknown>>): string {
  const lines = [
    def.cols.map((c) => escape(c.label)).join(","),
    ...rows.map((r) => def.cols.map((c) => escape(cellText(c.kind, r[c.key]))).join(",")),
  ];
  return "﻿" + lines.join("\r\n");
}
