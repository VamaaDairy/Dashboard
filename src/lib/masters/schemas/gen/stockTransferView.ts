import { ArrowLeftRight } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Stock Transfer (Recibo route `stockTransferView`).
 *
 * Spec columns: 13; built: 12.
 * Left out (buttons, or no matching data column):
 *   - Un Billed Quantity (totalUnBilledQuantity)
 */
export const stockTransferView: MasterDef = {
  slug: "stockTransferView",
  title: "Stock Transfer",
  subtitle: "Stock transfers with quantities and status.",
  icon: ArrowLeftRight,
  from: `fp_stock_transfer m
    left join fp_firm j1 on j1.uid = m.from_firm_uid
    left join fp_staff j2 on j2.uid = m.to_staff_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "date", label: "Date", expr: "m.voucher_time" },
    { key: "voucherNo", label: "Voucher No", expr: "m.voucher_number", kind: "mono" },
    { key: "reference", label: "Reference", expr: "m.reference" },
    { key: "from", label: "From", expr: "j1.name" },
    { key: "toStaff", label: "To Staff", expr: "j2.first_name" },
    { key: "items", label: "Items", expr: "m.total_items", kind: "num" },
    { key: "qty", label: "Qty.", expr: "m.total_quantity", kind: "num" },
    { key: "billedQuantity", label: "Billed Quantity", expr: "m.total_billed_quantity", kind: "num" },
    { key: "cancelledQuantity", label: "Cancelled Quantity", expr: "m.total_cancelled_quantity", kind: "num" },
    { key: "cost", label: "Cost", expr: "m.total_cost", kind: "money" },
    { key: "status", label: "Status", expr: "m.status" },
  ],
  search: ["m.voucher_number", "m.reference"],
  filters: [
    { key: "status", label: "Status", expr: "m.status" },
  ],
  order: "m.created_at desc",
};
