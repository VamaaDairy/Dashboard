import { MapPin } from "lucide-react";
import type { MasterDef } from "../types";
import { REF_STAFF, REF_STATES } from "../refs";

/** Route: /orders/beat */
export const routes: MasterDef = {
  slug: "beat",
  title: "Route Management",
  subtitle: "Routes (beats) and how many customers sit on each.",
  icon: MapPin,
  from: `fp_beat b left join fp_firm f on f.beat_uid = b.uid left join fp_channel ch on ch.uid = f.channel_uid`,
  groupBy: "b.uid",
  cols: [
    { key: "name", label: "Route", expr: "b.beat_name" },
    { key: "code", label: "Code", expr: "b.beat_code", kind: "mono" },
    { key: "state", label: "State", expr: "b.state" },
    { key: "city", label: "City", expr: "b.city" },
    { key: "customers", label: "Customers", expr: "count(f.uid)::int", kind: "num" },
    { key: "dist", label: "Distributors", expr: "(count(f.uid) filter (where ch.channel_code = 'DB'))::int", kind: "num" },
    { key: "ret", label: "Retailers", expr: "(count(f.uid) filter (where ch.channel_code = 'RT'))::int", kind: "num" },
    { key: "status", label: "Status", expr: "case when b.status = 1 then 'Active' else 'Inactive' end", kind: "status" },
  ],
  search: ["b.beat_name", "b.beat_code", "b.city"],
  filters: [
    { key: "state", label: "State", expr: "b.state" },
    { key: "city", label: "City", expr: "b.city" },
  ],
  order: "b.beat_name",

  entity: {
    table: "fp_beat", idCol: "uid", idExpr: "b.uid", onExpr: "b.status = 1", noun: "route",
    defaults: { status: 1 },
    active: { col: "status", on: 1, off: 0 },
    usage: [{ label: "customers on it", sql: "select count(*)::int as n from fp_firm where beat_uid = $1" }],
    fields: [
      { name: "beat_name", label: "Route name", type: "text", required: true },
      { name: "beat_code", label: "Route code", type: "text", required: true, help: "Codes may repeat across routes in the Footprints export." },
      { name: "staff_uid", label: "Owner", type: "ref", ref: REF_STAFF },
      { name: "state", label: "State", type: "ref", ref: REF_STATES },
      { name: "city", label: "City", type: "text" },
    ],
  },
};
