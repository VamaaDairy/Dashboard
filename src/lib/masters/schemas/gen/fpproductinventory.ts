import { Boxes } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Product Inventory (Recibo route `fpproductinventory`).
 *
 * Spec columns: 20; built: 20.
 */
export const fpproductinventory: MasterDef = {
  slug: "fpproductinventory",
  title: "Product Inventory",
  subtitle: "Stock by customer, warehouse and product, with batch and expiry.",
  icon: Boxes,
  from: `fp_product_inventory m
    left join fp_firm j1 on j1.uid = m.firm_uid
    left join fp_channel j2 on j2.uid = j1.channel_uid
    left join fp_warehouse j3 on j3.uid = m.warehouse_uid
    left join fp_product j4 on j4.uid = m.product_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.updated_at desc)", kind: "num" },
    { key: "channel", label: "Channel", expr: "j2.channel" },
    { key: "customer", label: "Customer", expr: "j1.name" },
    { key: "warehouse", label: "Warehouse", expr: "j3.name" },
    { key: "warehouseCode", label: "Warehouse Code", expr: "j3.warehousecode", kind: "mono" },
    { key: "intransitStock", label: "Intransit Stock", expr: "m.intransit_stock", kind: "num" },
    { key: "totalStock", label: "Total Stock", expr: "m.stock", kind: "num" },
    { key: "skuCode", label: "SKU Code", expr: "j4.sku_code", kind: "mono" },
    { key: "variant", label: "Variant", expr: "j4.variant" },
    { key: "skuName", label: "SKU Name", expr: "j4.sku_name", kind: "mono" },
    { key: "skuSize", label: "SKU Size", expr: "j4.sku_size", kind: "mono" },
    { key: "brand", label: "Brand", expr: "j4.brand" },
    { key: "category", label: "Category", expr: "j4.category" },
    { key: "dp", label: "DP", expr: "j4.dp", kind: "money" },
    { key: "mrp", label: "MRP", expr: "j4.mrp", kind: "money" },
    { key: "primaryUnit", label: "Primary Unit", expr: "nullif(j4.primary_unit::text, 'null')" },
    { key: "secondaryUnit", label: "Secondary Unit", expr: "nullif(j4.secondary_units::text, 'null')" },
    { key: "batchNumber", label: "Batch Number", expr: "m.batch_number", kind: "mono" },
    { key: "batchDate", label: "Batch Date", expr: "m.batch_date", kind: "date" },
    { key: "expireDate", label: "Expire Date", expr: "m.expire_date", kind: "date" },
  ],
  search: ["j4.sku_code", "j4.sku_name", "m.batch_number"],
  order: "m.updated_at desc",
};
