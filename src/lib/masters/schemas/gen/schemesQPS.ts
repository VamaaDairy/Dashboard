import { Gift } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * QPS Schemes (Recibo route `schemesQPS`).
 *
 * Spec columns: 26; built: 12.
 * Left out (buttons, or no matching data column):
 *   - SKU (productSKU)
 *   - From Amount (fromAmount)
 *   - To Amount (toAmount)
 *   - Type (type)
 *   - Scheme Based On (basedOn)
 *   - From Quantity (fromQuantity)
 *   - To Quantity (toQuantity)
 *   - Primary Unit (primaryUnit)
 *   - Discount Percentage (discountPercentage)
 *   - Discount Value (discountValue)
 *   - Product Name (modelName)
 *   - SKU Code (skuCode)
 *   - Product Description (skuCode)
 *   - Offer Quantity (productQty)
 */
export const schemesQPS: MasterDef = {
  slug: "schemesQPS",
  title: "QPS Schemes",
  subtitle: "Quantity / period schemes by channel, state and product.",
  icon: Gift,
  from: `fp_scheme_qps m
    left join fp_channel j1 on j1.uid = m.channel_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc, m.name)", kind: "num" },
    { key: "schemeName", label: "Scheme Name", expr: "m.name" },
    { key: "state", label: "State", expr: "m.states" },
    { key: "branch", label: "Branch", expr: "nullif(m.branches::text, 'null')" },
    { key: "channel", label: "Channel", expr: "j1.channel" },
    { key: "startDate", label: "Start Date", expr: "m.from_date", kind: "date" },
    { key: "endDate", label: "End Date", expr: "m.to_date", kind: "date" },
    { key: "brand", label: "Brand", expr: "nullif(m.product_brands::text, 'null')" },
    { key: "category", label: "Category", expr: "nullif(m.product_categories::text, 'null')" },
    { key: "subCategory", label: "Sub Category", expr: "nullif(m.product_sub_categories::text, 'null')" },
    { key: "status", label: "Status", expr: "case when m.active = 1 then 'Active' else 'Inactive' end", kind: "status" },
    { key: "schemeInputName", label: "Scheme Input Name", expr: "m.name" },
  ],
  search: ["m.name"],
  filters: [
    { key: "channel", label: "Channel", expr: "j1.channel" },
  ],
  order: "m.created_at desc, m.name",
};
