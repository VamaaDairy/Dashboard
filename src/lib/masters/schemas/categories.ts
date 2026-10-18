import { Tags } from "lucide-react";
import type { MasterDef } from "../types";

/** Route: /orders/categoryMaster */
export const categories: MasterDef = {
  slug: "categoryMaster",
  title: "Categories & Sub-categories",
  subtitle: "How the product range is grouped, with the number of products and the MRP range in each group.",
  icon: Tags,
  from: `fp_product p`,
  groupBy: "p.category, p.sub_category",
  cols: [
    { key: "category", label: "Category", expr: "p.category" },
    { key: "sub", label: "Sub-category", expr: "p.sub_category" },
    { key: "products", label: "Products", expr: "count(*)::int", kind: "num" },
    { key: "active", label: "Active", expr: "(count(*) filter (where p.active = 1))::int", kind: "num" },
    { key: "min", label: "Lowest MRP", expr: "min(p.mrp)", kind: "money" },
    { key: "max", label: "Highest MRP", expr: "max(p.mrp)", kind: "money" },
  ],
  search: ["p.category", "p.sub_category"],
  filters: [{ key: "category", label: "Category", expr: "p.category" }],
  order: "p.category, p.sub_category",
};
