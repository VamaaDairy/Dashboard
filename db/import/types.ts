import type { Client } from "pg";

/** A spreadsheet row, keyed by its header text. */
export type Rec = Record<string, unknown>;
export type Sheet = Rec[];
/** A row on its way into a table, keyed by column name. */
export type Row = Record<string, unknown>;

/** The rows of every report that was found; a missing report is just empty. */
export interface Reports {
  cities: Sheet;
  products: Sheet;
  customers: Sheet;
  empActive: Sheet;
  empGone: Sheet;
  routes: Sheet;
  rates: Sheet;
  slabs: Sheet;
}

export interface Ctx {
  db: Client;
  reports: Reports;
  /** things the user should know about, printed at the end */
  warn: string[];
  /** one line per table loaded */
  summary: string[];
  /** images wait until the employees exist: each belongs to an uploader */
  images: { product: Row[]; firm: Row[] };
}

export type Step = (ctx: Ctx) => Promise<void>;
