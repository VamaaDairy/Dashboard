import { Percent } from "lucide-react";
import type { MasterDef } from "../types";
import { REF_PRODUCTS, REF_SLABS } from "../refs";
import { active } from "./fragments";

/** Route: /orders/priceSlabs */
export const slabs: MasterDef = {
  slug: "priceSlabs",
  title: "Slab Pricing",
  subtitle: "Special price lists (slabs) by product, as assigned to customers.",
  icon: Percent,
  from: `fp_slab_rate sr join fp_slab sl on sl.uid = sr.slab_uid join fp_product p on p.uid = sr.product_uid`,
  cols: [
    { key: "slab", label: "Slab", expr: "sl.name" },
    { key: "sku", label: "SKU", expr: "p.sku_code", kind: "mono" },
    { key: "product", label: "Product", expr: "p.sku_name" },
    { key: "mrp", label: "MRP", expr: "p.mrp", kind: "money" },
    { key: "dp", label: "Dealer price", expr: "sr.dp", kind: "money" },
    { key: "sp", label: "Selling price", expr: "sr.sp", kind: "money" },
    { key: "disc", label: "Max discount", expr: "sr.max_allowed_discount", kind: "num" },
    { key: "from", label: "Effective from", expr: "sr.from_date", kind: "date" },
    { key: "status", label: "Status", expr: active("sr"), kind: "status" },
  ],
  search: ["sl.name", "p.sku_code", "p.sku_name"],
  filters: [
    { key: "slab", label: "Slab", expr: "sl.name" },
    { key: "status", label: "Status", expr: active("sr") },
  ],
  order: "sl.name, p.sku_name",

  entity: {
    table: "fp_slab_rate", idCol: "uid", idExpr: "sr.uid", onExpr: "sr.active = 1", noun: "slab price",
    defaults: { active: 1 },
    active: { col: "active", on: 1, off: 0 },
    fields: [
      { name: "slab_uid", label: "Slab", type: "ref", ref: REF_SLABS, help: "Pick a slab, or type a new slab name below." },
      { name: "new_slab", label: "New slab name", type: "text", virtual: true, help: "Only if the slab does not exist yet." },
      { name: "product_uid", label: "Product", type: "ref", ref: REF_PRODUCTS, required: true },
      { name: "dp", label: "Dealer price", type: "number", required: true, min: 0 },
      { name: "sp", label: "Selling price", type: "number", required: true, min: 0 },
      { name: "max_allowed_discount", label: "Max discount", type: "number", min: 0, whenEmpty: 0 },
      { name: "from_date", label: "Effective from", type: "date", tz: true },
    ],
  },
};
