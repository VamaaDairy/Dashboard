import type { Col } from "../types";
import { labelJoin } from "@/lib/products/label-sql";

/**
 * Every report that lists products shows them the same way: photo, SKU code, the one product name (as the Gaia D2C
 * app names it), and the pack quantity and unit in their own columns. Add `productJoin(code)` to the report's
 * `from` and spread `productCols(code)` where the product columns go.
 */
export const productJoin = (codeExpr: string) => `\n    left join ${labelJoin(codeExpr)}`;

export const productCols = (codeExpr: string, ownName?: string): Col[] => [
  { key: "pPhoto", label: "Photo", expr: "pl.image", kind: "image" },
  { key: "pSku", label: "SKU", expr: `coalesce(pl.sku_code, (${codeExpr})::text)`, kind: "mono" },
  { key: "pName", label: "Product", expr: ownName ? `coalesce(pl.name, ${ownName})` : "pl.name" },
  { key: "pQty", label: "Qty", expr: "pl.qty" },
  { key: "pUnit", label: "Unit", expr: "pl.unit" },
];
