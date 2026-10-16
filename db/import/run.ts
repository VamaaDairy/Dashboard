import { Client } from "pg";
import { loadReports } from "./lib/excel";
import { loadChannels } from "./steps/channels";
import { linkCustomers, loadCustomers } from "./steps/customers";
import { loadDesignations } from "./steps/designations";
import { loadDivisions } from "./steps/divisions";
import { loadEmployees } from "./steps/employees";
import { loadGeography } from "./steps/geography";
import { loadImages } from "./steps/images";
import { loadChannelRates, loadSlabs } from "./steps/pricing";
import { loadProducts } from "./steps/products";
import { loadRoutes } from "./steps/routes";
import type { Ctx, Step } from "./types";

/**
 * In dependency order: employees need the company customer and designations,
 * images and slabs need an employee, customer links need both customers and
 * employees, prices need products and channels.
 */
const STEPS: Step[] = [
  loadGeography,
  loadChannels,
  loadDesignations,
  loadDivisions,
  loadProducts,
  loadCustomers,
  loadEmployees,
  loadImages,
  linkCustomers,
  loadRoutes,
  loadChannelRates,
  loadSlabs,
];

/** Loads every report found in `dir` in one transaction (rolled back when `dry`). Returns what was loaded and what to look at. */
export async function importMasters(dir: string, dry: boolean): Promise<{ found: string[]; summary: string[]; warn: string[] }> {
  const { reports, found } = await loadReports(dir);
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp" });
  await db.connect();
  const ctx: Ctx = { db, reports, warn: [], summary: [], images: { product: [], firm: [] } };
  try {
    await db.query("begin");
    for (const step of STEPS) await step(ctx);
    await db.query(dry ? "rollback" : "commit");
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
  return { found, summary: ctx.summary, warn: [...new Set(ctx.warn)] };
}
