import { Boxes } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Stock View (Recibo route `stockView`).
 *
 * Spec columns: 19; built: 18.
 * Left out (buttons, or no matching data column):
 *   - Approval Qty. (spec maps it to the wrong field)
 */
export const stockView: MasterDef = {
  slug: "stockView",
  title: "Stock View",
  subtitle: "Items of each stock request, with the quantity asked and approved.",
  icon: Boxes,
  from: `fp_stock_request_item m
    left join fp_stock_request j1 on j1.uid = m.stock_request_uid
    left join fp_firm j2 on j2.uid = j1.from_firm_uid
    left join fp_firm j3 on j3.uid = j1.to_firm_uid
    left join fp_product j4 on j4.uid = m.product_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "reqNo", label: "Req.No", expr: "j1.requisition_number", kind: "mono" },
    { key: "status", label: "Status", expr: "j1.status" },
    { key: "date", label: "Date", expr: "j1.request_time", kind: "datetime" },
    { key: "items", label: "Items", expr: "j1.total_items", kind: "num" },
    { key: "qty", label: "Qty.", expr: "j1.total_quantity", kind: "num" },
    { key: "approvedQty", label: "Approved Qty", expr: "j1.approval_total_quantity", kind: "num" },
    { key: "fromFirm", label: "From Firm", expr: "j2.name" },
    { key: "toFirm", label: "To Firm", expr: "j3.name" },
    { key: "syncRemarks", label: "Sync Remarks", expr: "j1.sync_remarks" },
    { key: "skuCode", label: "SKU Code", expr: "j4.sku_code", kind: "mono" },
    { key: "qty2", label: "Qty.", expr: "m.quantity", kind: "num" },
    { key: "mrp", label: "MRP", expr: "m.mrp", kind: "money" },
    { key: "sp", label: "SP", expr: "m.selling_price", kind: "num" },
    { key: "totalCost", label: "Total Cost", expr: "m.total_cost", kind: "money" },
    { key: "skuName", label: "SKU Name", expr: "j4.sku_name", kind: "mono" },
    { key: "productName", label: "Product Name", expr: "j4.model_name" },
    { key: "unit", label: "Unit", expr: "nullif(m.unit::text, 'null')" },
  ],
  search: ["j4.sku_code", "j4.sku_name", "j1.requisition_number"],
  order: "m.created_at desc",
};
