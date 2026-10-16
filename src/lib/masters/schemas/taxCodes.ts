import { Percent } from "lucide-react";
import type { MasterDef } from "../types";

/** Route: /orders/taxMaster */
export const taxCodes: MasterDef = {
  slug: "taxMaster",
  title: "Tax Codes",
  subtitle: "HSN / tax codes used by products. GST rates are blank until they are entered - the export carries only the code.",
  icon: Percent,
  from: `fp_tax_configuration t left join fp_product p on p.tax_configuration_uid = t.uid`,
  groupBy: "t.uid",
  cols: [
    { key: "code", label: "Tax code", expr: "t.tax_code", kind: "mono" },
    { key: "cats", label: "Categories", expr: "t.category_name", wide: true },
    { key: "products", label: "Products", expr: "count(p.uid)::int", kind: "num" },
    { key: "rates", label: "GST rates", expr: "case when jsonb_array_length(t.applicable_taxes) = 0 then 'Not entered' else t.applicable_taxes::text end" },
    { key: "since", label: "Applicable from", expr: "t.start_date", kind: "date" },
  ],
  search: ["t.tax_code", "t.category_name"],
  order: "t.tax_code",
};
