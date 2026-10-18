import { RefreshCw } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Product Inventory Status (Recibo route `productInventoryStatus`).
 *
 * Spec columns: 5; built: 4.
 * Left out (buttons, or no matching data column):
 *   - Action (button)
 */
export const productInventoryStatus: MasterDef = {
  slug: "productInventoryStatus",
  title: "Product Inventory Status",
  subtitle: "Stock received from the ERP and whether each batch synced.",
  icon: RefreshCw,
  from: `fp_crons_jobs_product_inventory m`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "stock", label: "Stock", expr: "m.stock", kind: "num" },
    { key: "batchDate", label: "Batch Date", expr: "m.batch_date" },
    { key: "syncRemarks", label: "Sync Remarks", expr: "m.remark" },
  ],
  search: ["m.batch_number", "m.requisition_number"],
  filters: [
    { key: "synced", label: "Synced", expr: "m.synced" },
  ],
  order: "m.created_at desc",
};
