import { BarChart3 } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Sales Summary (Recibo route `firmPromoterReport`).
 *
 * Spec columns: 13; built: 13.
 * The portal screen also has promoter-level and customer-level total grids; only the stock / sales detail grid is built.
 */
export const firmPromoterReport: MasterDef = {
  slug: "firmPromoterReport",
  title: "Sales Summary",
  subtitle: "Promoter stock and sales by customer and product: opening, purchase, sales, closing, returns and damages.",
  icon: BarChart3,
  from: `fp_firm_promoter_summary m
    left join fp_product j1 on j1.uid = m.product_uid
    left join fp_firm j2 on j2.uid = m.firm_uid
    left join fp_channel j3 on j3.uid = j2.channel_uid
    left join fp_staff j4 on j4.uid = m.staff_uid`,
  dateRange: { expr: "m.date", days: 30 },
  cols: [
    { key: "date", label: "Date", expr: "m.date", kind: "date" },
    { key: "skuCode", label: "SKU Code", expr: "j1.sku_code", kind: "mono" },
    { key: "skuName", label: "SKU Name", expr: "j1.sku_name", kind: "mono" },
    { key: "productName", label: "Product Name", expr: "j1.model_name" },
    { key: "skuSize", label: "SKU Size", expr: "j1.sku_size", kind: "mono" },
    { key: "openingStock", label: "Opening Stock", expr: "m.opening_stock", kind: "num" },
    { key: "purchaseQuantity", label: "Purchase Quantity", expr: "m.purchase_qty", kind: "num" },
    { key: "salesQuantity", label: "Sales Quantity", expr: "m.sales_qty", kind: "num" },
    { key: "closingStock", label: "Closing Stock", expr: "m.closing_stock", kind: "num" },
    { key: "returnedQuantity", label: "Returned Quantity", expr: "m.return_qty", kind: "num" },
    { key: "damagedQuantity", label: "Damaged Quantity", expr: "m.damage_qty", kind: "num" },
    { key: "channel", label: "Channel", expr: "j3.channel" },
    { key: "state", label: "State", expr: "j2.state_state" },
  ],
  search: ["j1.sku_code", "j1.sku_name", "j2.name", "j2.firm_code", "j4.first_name"],
  filters: [
    { key: "channel", label: "Channel", expr: "j3.channel" },
    { key: "state", label: "State", expr: "j2.state_state" },
  ],
  order: "m.date desc, m.created_at desc",
};
