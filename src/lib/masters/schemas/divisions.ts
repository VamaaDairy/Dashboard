import { Building2 } from "lucide-react";
import type { MasterDef } from "../types";
import { active } from "./fragments";

/** Route: /orders/divisionMaster */
export const divisions: MasterDef = {
  slug: "divisionMaster",
  title: "Divisions",
  subtitle: "Sales divisions customers are placed in, with how many customers each holds.",
  icon: Building2,
  from: `fp_division d`,
  cols: [
    { key: "name", label: "Division", expr: "d.name" },
    {
      key: "customers", label: "Customers", kind: "num",
      expr: "(select count(*) from fp_firm f where exists (select 1 from jsonb_array_elements_text(f.division) e where upper(e) = d.name))::int",
    },
    {
      key: "active", label: "Active customers", kind: "num",
      expr: "(select count(*) from fp_firm f where f.active = 1 and exists (select 1 from jsonb_array_elements_text(f.division) e where upper(e) = d.name))::int",
    },
    { key: "status", label: "Status", expr: active("d"), kind: "status" },
  ],
  search: ["d.name"],
  order: "d.name",

  entity: {
    table: "fp_division", idCol: "id", idExpr: "d.id", onExpr: "d.active = 1", noun: "division",
    defaults: { active: 1 },
    active: { col: "active", on: 1, off: 0 },
    fields: [{ name: "name", label: "Division", type: "text", required: true, upper: true }],
  },
};
