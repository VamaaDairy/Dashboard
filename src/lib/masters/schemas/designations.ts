import { BadgeCheck } from "lucide-react";
import type { MasterDef } from "../types";
import { active } from "./fragments";

/** Route: /orders/designationMaster */
export const designations: MasterDef = {
  slug: "designationMaster",
  title: "Designations",
  subtitle: "The roles employees hold, and how many people are in each.",
  icon: BadgeCheck,
  from: `fp_designation d left join fp_staff s on s.designation_uid = d.uid`,
  groupBy: "d.uid",
  cols: [
    { key: "name", label: "Designation", expr: "d.designation" },
    { key: "code", label: "Code", expr: "d.designation_code", kind: "mono" },
    { key: "dept", label: "Department", expr: "d.department" },
    { key: "staff", label: "Employees", expr: "count(s.uid)::int", kind: "num" },
    { key: "active", label: "Active", expr: "(count(s.uid) filter (where s.active = 1))::int", kind: "num" },
    { key: "access", label: "Full access", expr: "case when d.full_access = 1 then 'Yes' else 'No' end" },
    { key: "status", label: "Status", expr: active("d"), kind: "status" },
  ],
  search: ["d.designation", "d.designation_code", "d.department"],
  order: "count(s.uid) desc, d.designation",

  entity: {
    table: "fp_designation", idCol: "uid", idExpr: "d.uid", onExpr: "d.active = 1", noun: "designation",
    defaults: { active: 1 },
    active: { col: "active", on: 1, off: 0 },
    usage: [{ label: "employees", sql: "select count(*)::int as n from fp_staff where designation_uid = $1" }],
    fields: [
      { name: "designation", label: "Designation", type: "text", required: true, upper: true },
      { name: "designation_code", label: "Code", type: "text", required: true, upper: true, lockOnEdit: true, help: "Unique. Cannot be changed later." },
      { name: "department", label: "Department", type: "text", required: true, upper: true, placeholder: "SALES" },
      { name: "sales", label: "Field sales role", type: "bool" },
      { name: "full_access", label: "Full access", type: "bool" },
    ],
  },
};
