import { Map as MapIcon } from "lucide-react";
import type { MasterDef } from "../types";
import { REF_STATES } from "../refs";
import { cityStatus } from "./fragments";

/** Route: /orders/cityMaster */
export const cities: MasterDef = {
  slug: "cityMaster",
  title: "City Master",
  subtitle: "Every city and town by state, and how many customers are in each.",
  icon: MapIcon,
  from: `fp_city c`,
  cols: [
    { key: "state", label: "State", expr: "c.city_state" },
    { key: "city", label: "City", expr: "c.city_name" },
    { key: "customers", label: "Customers", expr: "(select count(*) from fp_firm f where f.state_state = c.city_state and upper(f.city) = upper(c.city_name))::int", kind: "num" },
    { key: "status", label: "Status", expr: cityStatus, kind: "status" },
    { key: "created", label: "Created", expr: "c.created_at", kind: "date" },
    { key: "updated", label: "Updated", expr: "c.updated_at", kind: "date" },
  ],
  search: ["c.city_name", "c.city_state"],
  filters: [
    { key: "state", label: "State", expr: "c.city_state" },
    { key: "status", label: "Status", expr: cityStatus },
  ],
  stats: [{ label: "Active", where: "c.status = 1" }, { label: "Inactive", where: "c.status <> 1" }],
  order: "c.city_state, c.city_name",

  entity: {
    table: "fp_city", idCol: "uid", idExpr: "c.uid", onExpr: "c.status = 1", noun: "city",
    defaults: { status: 1 },
    active: { col: "status", on: 1, off: 0 },
    fields: [
      { name: "city_state", label: "State", type: "ref", ref: REF_STATES, required: true },
      { name: "city_name", label: "City", type: "text", required: true, upper: true },
    ],
  },
};
