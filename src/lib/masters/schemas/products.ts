import { Package } from "lucide-react";
import type { MasterDef } from "../types";
import { REF_TAX, SUGGEST_BRAND, SUGGEST_CATEGORY, SUGGEST_SUB_CATEGORY, SUGGEST_UNIT } from "../refs";
import { active } from "./fragments";

/** Route: /orders/fpproducts */
export const products: MasterDef = {
  slug: "fpproducts",
  title: "Product Master",
  subtitle: "All SKUs with category, pack, MRP and dealer price.",
  icon: Package,
  from: `fp_product p left join fp_tax_configuration t on t.uid = p.tax_configuration_uid`,
  cols: [
    { key: "sku", label: "SKU", expr: "p.sku_code", kind: "mono" },
    { key: "name", label: "Product", expr: "p.sku_name" },
    { key: "category", label: "Category", expr: "p.category" },
    { key: "sub", label: "Sub-category", expr: "p.sub_category" },
    { key: "brand", label: "Brand", expr: "trim(p.brand)" },
    { key: "unit", label: "Unit", expr: "p.primary_unit #>> '{}'" },
    { key: "pack", label: "Pack conversion", expr: "p.secondary_units::text", kind: "mono" },
    { key: "mrp", label: "MRP", expr: "p.mrp", kind: "money" },
    { key: "dp", label: "Dealer price", expr: "p.dp", kind: "money" },
    { key: "tax", label: "Tax code", expr: "t.tax_code", kind: "mono" },
    { key: "pos", label: "Position", expr: "p.position", kind: "num" },
    { key: "focus", label: "Focus", expr: "case when p.focus_product = 1 then 'Yes' else 'No' end" },
    { key: "status", label: "Status", expr: active("p"), kind: "status" },
  ],
  search: ["p.sku_code", "p.sku_name", "p.category", "p.sub_category"],
  filters: [
    { key: "category", label: "Category", expr: "p.category" },
    { key: "sub", label: "Sub-category", expr: "p.sub_category" },
    { key: "status", label: "Status", expr: active("p") },
  ],
  stats: [{ label: "Active", where: "p.active = 1" }, { label: "Inactive", where: "p.active = 0" }],
  order: "p.position nulls last, p.sku_name",

  entity: {
    table: "fp_product", idCol: "uid", idExpr: "p.uid", onExpr: "p.active = 1", noun: "product",
    defaults: { variant: "", active: 1 },
    active: { col: "active", on: 1, off: 0 },
    usage: [
      { label: "channel prices", sql: "select count(*)::int as n from fp_channel_rate where product_uid = $1" },
      { label: "slab prices", sql: "select count(*)::int as n from fp_slab_rate where product_uid = $1" },
    ],
    cleanup: ["delete from fp_product_image where product_uid = $1"],
    fields: [
      { name: "sku_code", label: "SKU code", type: "text", required: true, lockOnEdit: true, help: "Unique. Cannot be changed later." },
      { name: "sku_name", label: "Product name", type: "text", required: true },
      { name: "category", label: "Category", type: "suggest", suggest: SUGGEST_CATEGORY, required: true, help: "Pick one or type a new category." },
      { name: "sub_category", label: "Sub-category", type: "suggest", suggest: SUGGEST_SUB_CATEGORY, required: true },
      { name: "brand", label: "Brand", type: "suggest", suggest: SUGGEST_BRAND, required: true },
      { name: "mrp", label: "MRP", type: "number", required: true, min: 0 },
      { name: "dp", label: "Dealer price", type: "number", required: true, min: 0 },
      { name: "primary_unit", label: "Unit", type: "suggest", suggest: SUGGEST_UNIT, jsonString: true, placeholder: "PCS" },
      { name: "sku_size", label: "Size", type: "text" },
      { name: "tax_configuration_uid", label: "Tax code", type: "ref", ref: REF_TAX, required: true },
      { name: "position", label: "Position", type: "number", help: "Order in product lists." },
      { name: "focus_product", label: "Focus product", type: "bool" },
      { name: "description", label: "Description", type: "textarea", wide: true },
    ],
  },
};
