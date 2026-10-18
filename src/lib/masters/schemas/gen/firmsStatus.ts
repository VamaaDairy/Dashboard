import { RefreshCw } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Customers Status (Recibo route `firmsStatus`).
 *
 * Spec columns: 6; built: 5.
 * Left out (buttons, or no matching data column):
 *   - Action (button)
 */
export const firmsStatus: MasterDef = {
  slug: "firmsStatus",
  title: "Customers Status",
  subtitle: "Customers and whether each one is synced with the ERP.",
  icon: RefreshCw,
  from: `fp_firm m`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "customerName", label: "Customer Name", expr: "m.name" },
    { key: "customerCode", label: "Customer Code", expr: "m.firm_code", kind: "mono" },
    { key: "customerEmail", label: "Customer Email", expr: "m.email" },
    { key: "syncRemarks", label: "Sync Remarks", expr: "m.remark" },
  ],
  search: ["m.name", "m.firm_code", "m.email"],
  order: "m.created_at desc",
};
