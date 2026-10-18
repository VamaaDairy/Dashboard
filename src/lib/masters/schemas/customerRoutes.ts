import { Route } from "lucide-react";
import type { MasterDef } from "../types";
import { person, active } from "./fragments";

/** Route: /orders/customerRouteMapping */
export const customerRoutes: MasterDef = {
  slug: "customerRouteMapping",
  title: "Customer Wise Route Mapping",
  subtitle: "Which route each active customer is mapped to, and who the customer belongs to.",
  icon: Route,
  from: `fp_firm f
    join fp_beat b on b.uid = f.beat_uid
    left join fp_channel ch on ch.uid = f.channel_uid
    left join fp_staff s on s.uid = f.sales_contact_uid`,
  cols: [
    { key: "code", label: "Customer code", expr: "f.firm_code", kind: "mono" },
    { key: "name", label: "Customer", expr: "f.name" },
    { key: "route", label: "Route", expr: "b.beat_name" },
    { key: "rcode", label: "Route code", expr: "b.beat_code", kind: "mono" },
    { key: "channel", label: "Channel", expr: "ch.channel" },
    { key: "type", label: "Type", expr: "f.firm_type" },
    { key: "city", label: "City", expr: "f.city" },
    { key: "pincode", label: "Pincode", expr: "f.pincode", kind: "mono" },
    { key: "salesman", label: "Sales contact", expr: person("s") },
    { key: "status", label: "Status", expr: active("f"), kind: "status" },
  ],
  search: ["f.firm_code", "f.name", "b.beat_name", "f.city"],
  filters: [
    { key: "route", label: "Route", expr: "b.beat_name" },
    { key: "channel", label: "Channel", expr: "ch.channel" },
    { key: "salesman", label: "Sales contact", expr: person("s") },
  ],
  order: "b.beat_name, f.firm_code",
};
