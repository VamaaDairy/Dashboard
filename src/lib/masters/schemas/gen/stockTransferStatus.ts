import { RefreshCw } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Stock Transfer Status (Recibo route `stockTransferStatus`).
 *
 * Spec columns: 8; built: 7.
 * Left out (buttons, or no matching data column):
 *   - Action (button)
 */
export const stockTransferStatus: MasterDef = {
  slug: "stockTransferStatus",
  title: "Stock Transfer Status",
  subtitle: "Stock transfers sent to the ERP and whether each one synced.",
  icon: RefreshCw,
  from: `fp_crons_jobs_stock_transfer m`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "voucherTime", label: "Voucher Time", expr: "m.voucher_time", kind: "mono" },
    { key: "reqNo", label: "Req.No", expr: "m.requisition_number", kind: "num" },
    { key: "items", label: "Items", expr: "m.total_items", kind: "num" },
    { key: "totalQuantity", label: "Total Quantity", expr: "m.total_quanity", kind: "num" },
    { key: "totalCost", label: "Total Cost", expr: "m.total_cost", kind: "money" },
    { key: "syncRemarks", label: "Sync Remarks", expr: "m.remark" },
  ],
  search: ["m.voucher_number", "m.requisition_number"],
  filters: [
    { key: "synced", label: "Synced", expr: "m.synced" },
  ],
  order: "m.created_at desc",
};
