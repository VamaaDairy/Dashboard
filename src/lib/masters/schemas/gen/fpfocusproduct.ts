import { Star } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Focus Products (Recibo route `fpfocusproduct`).
 *
 * Spec columns: 21; built: 20.
 * Left out (buttons, or no matching data column):
 *   - Secondary Unit (product.secondaryUnit.name)
 */
export const fpfocusproduct: MasterDef = {
  slug: "fpfocusproduct",
  title: "Focus Products",
  subtitle: "Products the field force is asked to push, by region, state and channel.",
  icon: Star,
  from: `fp_focus_product m
    left join fp_product j1 on j1.uid = m.product_uid
    left join fp_channel j2 on j2.uid = m.channel_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "skuCode", label: "Sku Code", expr: "j1.sku_code", kind: "mono" },
    { key: "skuName", label: "Sku Name", expr: "j1.sku_name", kind: "mono" },
    { key: "region", label: "Region", expr: "nullif(m.region::text, 'null')" },
    { key: "state", label: "State", expr: "nullif(m.state::text, 'null')" },
    { key: "division", label: "Division", expr: "nullif(m.division::text, 'null')" },
    { key: "channel", label: "Channel", expr: "nullif(m.division::text, 'null')" },
    { key: "productName", label: "Product Name", expr: "j2.channel" },
    { key: "fromDate", label: "From Date", expr: "m.from_date" },
    { key: "toDate", label: "To Date", expr: "m.from_date" },
    { key: "variant", label: "Variant", expr: "m.to_date" },
    { key: "category", label: "Category", expr: "j1.category" },
    { key: "subcategory", label: "Subcategory", expr: "j1.sub_category" },
    { key: "dealerPrice", label: "Dealer Price", expr: "j1.dp", kind: "money" },
    { key: "chain", label: "Chain", expr: "nullif(m.chain::text, 'null')" },
    { key: "branch", label: "Branch", expr: "nullif(m.branch::text, 'null')" },
    { key: "primaryUnit", label: "Primary Unit", expr: "nullif(m.branch::text, 'null')" },
    { key: "customerClass", label: "Customer Class", expr: "nullif(m.customer_class::text, 'null')" },
    { key: "customerTypes", label: "Customer Types", expr: "nullif(m.customer_type::text, 'null')" },
    { key: "createdDate", label: "Created Date", expr: "m.created_at", kind: "date" },
  ],
  search: ["j1.sku_code", "j1.sku_name"],
  filters: [
    { key: "region", label: "Region", expr: "m.region" },
    { key: "channel", label: "Channel", expr: "j2.channel" },
  ],
  order: "m.created_at desc",
};
