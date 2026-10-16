import type { LucideIcon } from "lucide-react";

export type Kind = "text" | "num" | "money" | "date" | "status" | "mono";

export interface Col {
  key: string;
  label: string;
  /** SQL expression for the column */
  expr: string;
  kind?: Kind;
  /** wider, wrapping column (addresses, notes) */
  wide?: boolean;
}

export interface Filter {
  key: string;
  label: string;
  /** the dropdown lists the distinct values of this expression */
  expr: string;
}

export interface Stat {
  label: string;
  where: string;
}

// ---- editing

export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "ref" | "bool" | "suggest";

/** One input of the add / edit form; `name` is also the column it is stored in unless `virtual`. */
export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** `select`: the allowed values */
  options?: string[];
  /** `ref`: SQL returning `value, label` rows to pick from */
  ref?: string;
  /** `suggest`: SQL returning `value` rows offered as hints (any text is still accepted) */
  suggest?: string;
  help?: string;
  placeholder?: string;
  /** can be typed when adding but not changed afterwards (codes other records point at) */
  lockOnEdit?: boolean;
  upper?: boolean;
  min?: number;
  max?: number;
  /** what an empty box means, for columns that cannot be null */
  whenEmpty?: string | number;
  /** a date stored as timestamptz (instead of text / date) */
  tz?: boolean;
  /** text that the column keeps as a JSON string (jsonb) */
  jsonString?: boolean;
  /** not a column: read by the save hook in entity/hooks.ts */
  virtual?: boolean;
  /** full-width in the form */
  wide?: boolean;
}

/** How a master's rows are added, changed, switched off and removed. */
export interface EntityDef {
  table: string;
  idCol: "uid" | "id";
  /** SQL for the id / "is on" flag in the list query (uses the list's alias) */
  idExpr: string;
  onExpr?: string;
  /** what one row is called: "customer", "route" */
  noun: string;
  fields: Field[];
  /** columns that are required by the table but not asked for, set when a row is added */
  defaults?: Record<string, unknown>;
  /** the flag that "deactivate" flips, plus any extra assignments */
  active?: { col: string; on: number; off: number; setOff?: string; setOn?: string };
  /** Deleting is refused while any of these (SQL with $1 = id, returning n) is above zero */
  usage?: Array<{ label: string; sql: string }>;
  /** run just before a delete (SQL with $1 = id): rows that only exist for this one */
  cleanup?: string[];
  /** keep jsonb created_by / updated_by columns */
  actorCols?: boolean;
}

/** One master screen: where the rows come from, how they are shown, and (if allowed) how they are edited. */
export interface MasterDef {
  slug: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  from: string;
  groupBy?: string;
  cols: Col[];
  /** SQL expressions the search box matches against (case-insensitive contains) */
  search: string[];
  filters?: Filter[];
  /** Counts shown above the table, over the whole list (not the search) */
  stats?: Stat[];
  order: string;
  entity?: EntityDef;
}

export type SearchParams = Record<string, string | string[] | undefined>;

/** The search / filter / page part of a URL, already validated against a screen. */
export interface ListRequest {
  q: string;
  page: number;
  filters: Record<string, string>;
}

export interface Listing {
  rows: Array<Record<string, unknown>>;
  total: number;
  pages: number;
  stats: Array<{ label: string; value: number }>;
  options: Record<string, string[]>;
}
