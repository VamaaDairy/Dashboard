import { LayoutGrid } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Display Planogram (Recibo route `displayPlanogram`).
 *
 * Spec columns: 31; built: 23.
 * Left out (buttons, or no matching data column):
 *   - Store Name (firmName)
 *   - Store Code (firmCode)
 *   - Store Type (firmType)
 *   - Store Class (firmClass)
 *   - Store Branch (teamTeam)
 *   - SKU Name (skuName)
 *   - Captured Date (capturedDate)
 *   - Audit Planned Stock (auditPlannedStock)
 */
export const displayPlanogram: MasterDef = {
  slug: "displayPlanogram",
  title: "Display Planogram",
  subtitle: "Planned shelf stock per product, channel and customer type.",
  icon: LayoutGrid,
  from: `fp_display_planogram m
    left join fp_product j1 on j1.uid = m.product_uid
    left join fp_channel j2 on j2.uid = m.channel_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "skuCode", label: "SKU Code", expr: "m.sku_code", kind: "mono" },
    { key: "skuName", label: "SKU Name", expr: "j1.sku_name", kind: "mono" },
    { key: "brand", label: "Brand", expr: "j1.brand" },
    { key: "category", label: "Category", expr: "j1.category" },
    { key: "subCategory", label: "Sub Category", expr: "j1.sub_category" },
    { key: "channel", label: "Channel", expr: "j2.channel" },
    { key: "customerClass", label: "Customer Class", expr: "m.customer_class" },
    { key: "customerType", label: "Customer Type", expr: "m.customer_type" },
    { key: "startDate", label: "Start Date", expr: "m.start_date" },
    { key: "endDate", label: "End Date", expr: "m.end_date" },
    { key: "customerBranch", label: "Customer Branch", expr: "m.customer_branch" },
    { key: "plannedStock", label: "Planned Stock", expr: "m.planned_stock", kind: "num" },
    { key: "totalOutlets", label: "Total Outlets", expr: "m.store_count", kind: "num" },
    { key: "viewOutlets", label: "View Outlets", expr: "m.store_count", kind: "num" },
    { key: "totalDisplayFacingQtyStock", label: "Total Display Facing Qty Stock", expr: "m.display_facing_qty", kind: "num" },
    { key: "totalDisplayStockQty", label: "Total Display Stock Qty", expr: "m.display_stock_qty", kind: "num" },
    { key: "totalSystemStockQty", label: "Total System Stock Qty", expr: "m.system_stock_qty", kind: "num" },
    { key: "adherenceInPercentage", label: "Adherence In Percentage", expr: "m.sku_wise_percentage", kind: "num" },
    { key: "status", label: "Status", expr: "case when m.status = 1 then 'Active' else 'Inactive' end", kind: "status" },
    { key: "systemStockQty", label: "System Stock Qty", expr: "m.system_stock_qty", kind: "num" },
    { key: "displayStockQty", label: "Display Stock Qty", expr: "m.display_stock_qty", kind: "num" },
    { key: "displayFacingQty", label: "Display Facing Qty", expr: "m.display_facing_qty", kind: "num" },
  ],
  search: ["m.sku_code", "j1.sku_name"],
  filters: [
    { key: "channel", label: "Channel", expr: "j2.channel" },
  ],
  order: "m.created_at desc",
};
