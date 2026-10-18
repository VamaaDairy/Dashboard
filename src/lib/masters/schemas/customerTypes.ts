import { Layers } from "lucide-react";
import type { MasterDef } from "../types";

/** Route: /orders/customerTypeMaster */
export const customerTypes: MasterDef = {
  slug: "customerTypeMaster",
  title: "Customer Types & Classes",
  subtitle: "How customers are grouped: by channel, then by the type and class they were created with.",
  icon: Layers,
  from: `fp_firm f left join fp_channel ch on ch.uid = f.channel_uid`,
  groupBy: "ch.channel, f.firm_type, f.firm_class",
  cols: [
    { key: "channel", label: "Channel", expr: "ch.channel" },
    { key: "type", label: "Customer type", expr: "f.firm_type" },
    { key: "class", label: "Customer class", expr: "f.firm_class" },
    { key: "customers", label: "Customers", expr: "count(*)::int", kind: "num" },
    { key: "active", label: "Active", expr: "(count(*) filter (where f.active = 1))::int", kind: "num" },
  ],
  search: ["ch.channel", "f.firm_type", "f.firm_class"],
  filters: [{ key: "channel", label: "Channel", expr: "ch.channel" }],
  order: "ch.channel, count(*) desc",
};
