import { MapPinned } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Target PJP (Recibo route `cityCategory`).
 *
 * Spec columns: 5; built: 5.
 */
export const cityCategory: MasterDef = {
  slug: "cityCategory",
  title: "Target PJP",
  subtitle: "Target visits per day by city category.",
  icon: MapPinned,
  from: `fp_city_category m`,
  cols: [
    { key: "category", label: "Category", expr: "m.category" },
    { key: "targetPerDayVisit", label: "Target Per Day Visit", expr: "m.target_visit", kind: "num" },
    { key: "fromDate", label: "From Date", expr: "m.from_date", kind: "date" },
    { key: "toDate", label: "To Date", expr: "m.to_date", kind: "date" },
    { key: "status", label: "Status", expr: "case when m.status = 1 then 'Active' else 'Inactive' end", kind: "status" },
  ],
  search: ["m.category"],
  order: "m.category, m.from_date desc",
};
