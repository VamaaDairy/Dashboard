import { RefreshCw } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Products Status (Recibo route `productsStatus`).
 *
 * Spec columns: 6; built: 5.
 * Left out (buttons, or no matching data column):
 *   - Action (button)
 */
export const productsStatus: MasterDef = {
  slug: "productsStatus",
  title: "Products Status",
  subtitle: "Products received from the ERP and whether each one synced.",
  icon: RefreshCw,
  from: `fp_crons_jobs_product m`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "productName", label: "Product Name", expr: "m.sku_name" },
    { key: "productCode", label: "Product Code", expr: "m.sku_code", kind: "mono" },
    { key: "mrp", label: "Mrp", expr: "m.mrp", kind: "money" },
    { key: "syncRemarks", label: "Sync Remarks", expr: "m.remark" },
  ],
  search: ["m.sku_code", "m.sku_name"],
  filters: [
    { key: "synced", label: "Synced", expr: "m.synced" },
  ],
  order: "m.created_at desc",
};
