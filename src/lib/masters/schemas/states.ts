import { Landmark } from "lucide-react";
import type { MasterDef } from "../types";
import { active } from "./fragments";

/** Route: /orders/stateMaster */
export const states: MasterDef = {
  slug: "stateMaster",
  title: "States",
  subtitle: "States with their GST code and region, and how many cities, customers and employees are in each.",
  icon: Landmark,
  from: `fp_state st`,
  cols: [
    { key: "state", label: "State", expr: "st.state" },
    { key: "code", label: "Code", expr: "st.code", kind: "mono" },
    { key: "gst", label: "GST code", expr: "st.gstin_code", kind: "mono" },
    { key: "region", label: "Region", expr: "st.region" },
    { key: "cities", label: "Cities", expr: "(select count(*) from fp_city c where c.city_state = st.state)::int", kind: "num" },
    { key: "customers", label: "Customers", expr: "(select count(*) from fp_firm f where f.state_state = st.state)::int", kind: "num" },
    { key: "active", label: "Active customers", expr: "(select count(*) from fp_firm f where f.state_state = st.state and f.active = 1)::int", kind: "num" },
    { key: "staff", label: "Employees", expr: "(select count(*) from fp_staff e where e.state_state = st.state and e.active = 1)::int", kind: "num" },
    { key: "status", label: "Status", expr: active("st"), kind: "status" },
  ],
  search: ["st.state", "st.code"],
  filters: [{ key: "region", label: "Region", expr: "st.region" }],
  order: "st.state",

  entity: {
    table: "fp_state", idCol: "id", idExpr: "st.id", onExpr: "st.active = 1", noun: "state",
    defaults: { active: 1, country_name: "India" },
    active: { col: "active", on: 1, off: 0 },
    usage: [
      { label: "cities", sql: "select count(*)::int as n from fp_city c join fp_state s on s.state = c.city_state where s.id = $1" },
      { label: "customers", sql: "select count(*)::int as n from fp_firm f join fp_state s on s.state = f.state_state where s.id = $1" },
      { label: "employees", sql: "select count(*)::int as n from fp_staff f join fp_state s on s.state = f.state_state where s.id = $1" },
    ],
    fields: [
      { name: "state", label: "State", type: "text", required: true, upper: true, lockOnEdit: true, help: "Cities and customers refer to the name, so it cannot be changed later." },
      { name: "code", label: "Short code", type: "text", required: true, upper: true },
      { name: "gstin_code", label: "GST state code", type: "text", required: true, placeholder: "22" },
      { name: "region", label: "Region", type: "select", options: ["EAST", "WEST", "NORTH", "SOUTH", "CENTRAL"], required: true },
    ],
  },
};
