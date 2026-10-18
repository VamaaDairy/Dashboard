import { Users } from "lucide-react";
import type { MasterDef } from "../types";
import { person, active } from "./fragments";

/** Route: /orders/employeecustomermaster */
export const employeeCoverage: MasterDef = {
  slug: "employeecustomermaster",
  title: "Employee Master",
  subtitle: "Each employee with the customers assigned to them, split by channel.",
  icon: Users,
  from: `fp_staff s
    left join fp_designation d on d.uid = s.designation_uid
    left join fp_firm f on f.sales_contact_uid = s.uid
    left join fp_channel ch on ch.uid = f.channel_uid`,
  groupBy: "s.uid, d.designation",
  cols: [
    { key: "code", label: "Code", expr: "s.employee_code", kind: "mono" },
    { key: "name", label: "Name", expr: person("s") },
    { key: "designation", label: "Designation", expr: "d.designation" },
    { key: "status", label: "Status", expr: active("s"), kind: "status" },
    { key: "customers", label: "Customers", expr: "count(f.uid)::int", kind: "num" },
    { key: "active", label: "Active customers", expr: "(count(f.uid) filter (where f.active = 1))::int", kind: "num" },
    { key: "dist", label: "Distributors", expr: "(count(f.uid) filter (where ch.channel_code = 'DB'))::int", kind: "num" },
    { key: "ret", label: "Retailers", expr: "(count(f.uid) filter (where ch.channel_code = 'RT'))::int", kind: "num" },
    { key: "other", label: "Other", expr: "(count(f.uid) filter (where ch.channel_code not in ('DB','RT')))::int", kind: "num" },
  ],
  search: ["s.employee_code", "s.first_name", "s.last_name"],
  filters: [
    { key: "designation", label: "Designation", expr: "d.designation" },
    { key: "status", label: "Status", expr: active("s") },
  ],
  order: "count(f.uid) desc, s.first_name",
};
