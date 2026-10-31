import "server-only";
import { salesByArea, salesByCategory, salesByCustomer, salesByDay, salesByPayment, salesByProduct } from "./sales";

export type ColKind = "text" | "int" | "money" | "date" | "day" | "mono";
export interface Col { key: string; label: string; kind: ColKind; total?: boolean }
export interface ReportDef {
  key: string;
  label: string;
  description: string;
  cols: Col[];
  load: (from: string, to: string) => Promise<Array<Record<string, unknown>>>;
}

/** The D2C sales reports: each one a table over a period, with totals and a CSV of the same rows. */
export const REPORTS: ReportDef[] = [
  {
    key: "products", label: "Product-wise", description: "Every product sold: quantity, revenue, orders and customers.",
    cols: [
      { key: "name", label: "Product", kind: "text" }, { key: "sku", label: "SKU", kind: "mono" }, { key: "category", label: "Category", kind: "text" },
      { key: "qty", label: "Qty sold", kind: "int", total: true }, { key: "avg_price", label: "Avg price", kind: "money" },
      { key: "revenue", label: "Revenue", kind: "money", total: true }, { key: "orders", label: "Orders", kind: "int" }, { key: "customers", label: "Customers", kind: "int" },
    ],
    load: async (f, t) => (await salesByProduct(f, t)) as unknown as Array<Record<string, unknown>>,
  },
  {
    key: "categories", label: "Category-wise", description: "Sales by product category.",
    cols: [
      { key: "category", label: "Category", kind: "text" }, { key: "products", label: "Products sold", kind: "int" },
      { key: "qty", label: "Qty sold", kind: "int", total: true }, { key: "revenue", label: "Revenue", kind: "money", total: true },
    ],
    load: async (f, t) => (await salesByCategory(f, t)) as unknown as Array<Record<string, unknown>>,
  },
  {
    key: "daily", label: "Date-wise", description: "Every day in the period: orders, items, revenue, cash and online.",
    cols: [
      { key: "day", label: "Date", kind: "day" }, { key: "orders", label: "Orders", kind: "int", total: true }, { key: "items", label: "Items", kind: "int", total: true },
      { key: "customers", label: "Customers", kind: "int" }, { key: "cod", label: "Cash", kind: "money", total: true }, { key: "online", label: "Online", kind: "money", total: true },
      { key: "revenue", label: "Revenue", kind: "money", total: true }, { key: "cancelled", label: "Cancelled", kind: "int", total: true },
    ],
    load: async (f, t) => (await salesByDay(f, t)) as unknown as Array<Record<string, unknown>>,
  },
  {
    key: "customers", label: "Customer-wise", description: "Who bought, how often and how much.",
    cols: [
      { key: "name", label: "Customer", kind: "text" }, { key: "phone", label: "Mobile", kind: "mono" }, { key: "orders", label: "Orders", kind: "int", total: true },
      { key: "items", label: "Items", kind: "int", total: true }, { key: "revenue", label: "Revenue", kind: "money", total: true }, { key: "last_order", label: "Last order", kind: "date" },
    ],
    load: async (f, t) => (await salesByCustomer(f, t)) as unknown as Array<Record<string, unknown>>,
  },
  {
    key: "payments", label: "Payment-wise", description: "Cash on delivery or online, one-time or subscription.",
    cols: [
      { key: "method", label: "Payment", kind: "text" }, { key: "kind", label: "Order type", kind: "text" },
      { key: "orders", label: "Orders", kind: "int", total: true }, { key: "revenue", label: "Revenue", kind: "money", total: true },
    ],
    load: async (f, t) => (await salesByPayment(f, t)).map((r) => ({ ...r, method: r.method === "online" ? "Online" : "Cash on delivery" })),
  },
  {
    key: "areas", label: "Area-wise", description: "Sales by delivery pincode.",
    cols: [
      { key: "pincode", label: "Pincode", kind: "mono" }, { key: "orders", label: "Orders", kind: "int", total: true },
      { key: "customers", label: "Customers", kind: "int" }, { key: "revenue", label: "Revenue", kind: "money", total: true },
    ],
    load: async (f, t) => (await salesByArea(f, t)) as unknown as Array<Record<string, unknown>>,
  },
];

export const reportOf = (key: string) => REPORTS.find((r) => r.key === key);

const fmtDate = (v: unknown) =>
  v ? new Date(v as string).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "";

/** A cell as text, for the page and the CSV alike. */
export function cell(kind: ColKind, v: unknown, csv = false): string {
  if (v == null || v === "") return csv ? "" : "—";
  switch (kind) {
    case "int":
      return csv ? String(Math.round(Number(v))) : Math.round(Number(v)).toLocaleString("en-IN");
    case "money":
      return csv ? Number(v).toFixed(2) : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    case "date":
      return fmtDate(v);
    case "day":
      return csv ? String(v) : fmtDate(`${v}T00:00:00+05:30`);
    default:
      return String(v);
  }
}

// a leading = + @ (or a minus before a non-digit) would be run as a formula by Excel
const esc = (v: string) => {
  const s = /^[=+@]|^-(?!\d)/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV (with a BOM so Excel reads UTF-8) of rows under the given columns. */
export function csvOf(cols: Col[], rows: Array<Record<string, unknown>>): string {
  return "﻿" + [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(cell(c.kind, r[c.key], true))).join(","))].join("\r\n");
}
