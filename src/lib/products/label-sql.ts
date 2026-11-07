/**
 * SQL pieces for the one product name (product_label, migration 093), usable from report definitions that are
 * plain data. The labels themselves are kept up to date by src/lib/products/names.ts.
 */

/** The digits of a SKU-code expression as a number: T1042, 1,042 and 1042 are all 1042. */
export const skuNoSql = (codeExpr: string) => `nullif(regexp_replace((${codeExpr})::text, '\\D', '', 'g'), '')::bigint`;

/**
 * `left join ${labelJoin("s.code")}` gives `pl.name`, `pl.qty`, `pl.unit`, `pl.image`, `pl.sku_code`
 * (one row at most, so a report never doubles up).
 */
export const labelJoin = (codeExpr: string, alias = "pl") =>
  `lateral (select x.* from product_label x where x.sku_no = ${skuNoSql(codeExpr)} order by x.sku_code limit 1) ${alias} on true`;
