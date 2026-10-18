import ExcelJS from "exceljs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { EMPLOYEE_SHEETS, REPORT_FILES } from "../constants";
import type { Rec, Reports, Sheet } from "../types";

type ReportKey = keyof typeof REPORT_FILES;

function unwrap(v: unknown): unknown {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return o.richText.map((t: { text: string }) => t.text).join("");
    if ("result" in o) return unwrap(o.result);
    if ("text" in o) return unwrap(o.text);
    if ("error" in o) return null;
  }
  return v;
}

/** Every sheet of a workbook as rows keyed by the header text. Fully empty rows are dropped. */
async function readWorkbook(file: string): Promise<Map<string, Sheet>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const out = new Map<string, Sheet>();
  for (const ws of wb.worksheets) {
    const header: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { header[i] = String(unwrap(c.value) ?? "").trim(); });
    const rows: Sheet = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const rec: Rec = {};
      let any = false;
      for (let i = 1; i < header.length; i++) {
        if (!header[i]) continue;
        const v = unwrap(row.getCell(i).value);
        if (v !== null && v !== undefined && v !== "") any = true;
        if (!(header[i] in rec)) rec[header[i]] = v ?? null;
      }
      if (any) rows.push(rec);
    });
    out.set(ws.name, rows);
  }
  return out;
}

/** Report prefix -> file, searching the folder recursively. */
function findReports(dir: string): Partial<Record<ReportKey, string>> {
  const out: Partial<Record<ReportKey, string>> = {};
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.xlsx$/i.test(f) && !f.startsWith("~$")) {
        const key = (Object.keys(REPORT_FILES) as ReportKey[]).find((k) => f.toUpperCase().startsWith(k));
        if (key) out[key] = p;
      }
    }
  };
  walk(dir);
  return out;
}

export async function loadReports(dir: string): Promise<{ reports: Reports; found: string[] }> {
  const files = findReports(dir);
  const read = async (k: ReportKey) => (files[k] ? readWorkbook(files[k]!) : null);
  const first = (wb: Map<string, Sheet> | null, name?: string): Sheet =>
    wb ? (name ? wb.get(name) : [...wb.values()][0]) ?? [] : [];

  const [cities, products, customers, employees, routes, rates, slabs] = await Promise.all([
    read("CITY_MASTER"), read("PRODUCT_MASTER"), read("CUSTOMER_MASTER"), read("EMPLOYEE_MASTER"),
    read("CUSTOMER_WISE_ROUTE_MAPPING"), read("CHANNEL_PRICE_REPORT"), read("SLAB_RATE_MASTER_REPORT"),
  ]);
  return {
    found: Object.keys(files),
    reports: {
      cities: first(cities), products: first(products), customers: first(customers),
      empActive: first(employees, EMPLOYEE_SHEETS.active), empGone: first(employees, EMPLOYEE_SHEETS.gone),
      routes: first(routes), rates: first(rates), slabs: first(slabs),
    },
  };
}
