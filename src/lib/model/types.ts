export type Id = string;

export interface ParameterRow {
  id: Id;
  key: string;
  label: string;
  group_name: string;
  value_num: number | null;
  formula: string | null;
  uom_id: Id | null;
  decimals: number;
  description: string | null;
  is_locked: boolean;
  sort_order: number;
}

export interface ClassRow {
  id: Id;
  code: string;
  name: string;
  plural_name: string | null;
  description: string | null;
  allows_bom: boolean;
  cost_field: string | null;
  is_locked: boolean;
  sort_order: number;
}

export interface FieldRow {
  id: Id;
  class_id: Id;
  key: string;
  label: string;
  data_type: "number" | "text" | "boolean" | "date" | "reference";
  group_id: Id | null;
  uom_id: Id | null;
  default_value: number | null;
  default_text: string | null;
  default_formula: string | null;
  rollup_group: string | null;
  is_total: boolean;
  is_locked: boolean;
  is_active: boolean;
  decimals: number;
  prefix: string | null;
  suffix: string | null;
  description: string | null;
  sort_order: number;
}

export interface RollupTagRow {
  field_def_id: Id;
  tag: string;
  sign: number;
}

export interface ObjectRow {
  id: Id;
  class_id: Id;
  code: string;
  name: string;
  parent_id: Id | null;
  uom_id: Id | null;
  is_active: boolean;
  notes: string | null;
  sort_order: number;
}

export interface ValueRow {
  object_id: Id;
  field_def_id: Id;
  formula: string | null;
  value_num: number | null;
  value_text: string | null;
}

export interface BomLineRow {
  id: Id;
  parent_object_id: Id;
  component_object_id: Id | null;
  line_type: string;
  label: string | null;
  qty: number | null;
  qty_formula: string | null;
  rate: number | null;
  rate_formula: string | null;
  divisor: number;
  divisor_formula: string | null;
  loss_pct: number;
  amount_formula: string | null;
  include_in_total: boolean;
  notes: string | null;
  sort_order: number;
}

export interface Snapshot {
  scenarioId: Id;
  parameters: ParameterRow[];
  classes: ClassRow[];
  fields: FieldRow[];
  rollupTags: RollupTagRow[];
  objects: ObjectRow[];
  values: ValueRow[];
  bomLines: BomLineRow[];
}

export type NodeKey = string; // param:<key> | field:<objCode>.<fieldKey> | bom:<lineId>

export interface NodeResult {
  value: number | string | null;
  error: string | null;
}

export interface LineParts {
  qty: number;
  rate: number;
  divisor: number;
  amount: number;
}

export interface CalcResult {
  nodes: Map<NodeKey, NodeResult>;
  edges: Array<{ src: NodeKey; dst: NodeKey }>;
  /** resolved qty / rate / divisor per BOM line, so daily costing can reuse them */
  lines: Map<Id, LineParts>;
  errorCount: number;
}
