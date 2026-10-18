/** fp_category, fp_sub_category, fp_tax_configuration and fp_product (images are queued for the images step). */
import { DEFAULT_TAX_START, SOURCE_UTC_OFFSET } from "../constants";
import { given, uid } from "../lib/ids";
import { code, dateOnly, flag, list, nowIso, num, stamp, str } from "../lib/parse";
import { upsert } from "../lib/sql";
import type { Rec, Row, Step } from "../types";

const NO_TAX = "NONE";
const taxUid = (r: Rec) => uid(`tax:${code(r["Tax Code"]) ?? NO_TAX}`);
const startOf = (day: string) => `${day}T00:00:00${SOURCE_UTC_OFFSET}`;

/** "CRT:0.1,PCS:1" -> { CRT: 0.1, PCS: 1 } (conversion factors to the primary unit) */
function packUnits(v: unknown): Record<string, number> | null {
  const parts = list(v);
  if (!parts) return null;
  return Object.fromEntries(parts.map((p) => { const [k, n] = p.split(":"); return [k.trim(), Number(n)]; }));
}

async function loadTaxCodes(ctx: Parameters<Step>[0], products: Rec[]) {
  // The export carries the tax (HSN) code but not the GST rates, so applicable_taxes is left empty.
  const taxes = new Map<string, { cats: Set<string>; since: string }>();
  for (const r of products) {
    const t = code(r["Tax Code"]);
    if (!t) continue;
    const cur = taxes.get(t) ?? { cats: new Set<string>(), since: "9999-12-31" };
    const c = str(r["Category"]); if (c) cur.cats.add(c);
    const d = dateOnly(r["Created Date"]); if (d && d < cur.since) cur.since = d;
    taxes.set(t, cur);
  }
  const rows: Row[] = [...taxes].map(([t, v]) => ({
    uid: uid(`tax:${t}`), category_name: [...v.cats].join(", ") || `HSN ${t}`, tax_code: t, applicable_taxes: [],
    start_date: startOf(v.since === "9999-12-31" ? DEFAULT_TAX_START : v.since),
  }));
  if (products.some((r) => !code(r["Tax Code"]))) {
    rows.push({ uid: uid(`tax:${NO_TAX}`), category_name: "No tax code", tax_code: NO_TAX, applicable_taxes: [], start_date: startOf(DEFAULT_TAX_START) });
  }
  await upsert(ctx, "fp_tax_configuration", rows);
  if (taxes.size) ctx.warn.push("product tax codes were loaded without GST rates (the export has none) - fill them in fp_tax_configuration");
}

export const loadProducts: Step = async (ctx) => {
  const products = ctx.reports.products;
  if (!products.length) return;

  const cats = new Set(products.map((r) => str(r["Category"])).filter(Boolean) as string[]);
  const subs = new Set(products.map((r) => str(r["Sub Category"])).filter(Boolean) as string[]);
  await upsert(ctx, "fp_category", [...cats].map((c) => ({ uid: uid(`category:${c}`), category: c })));
  await upsert(ctx, "fp_sub_category", [...subs].map((c) => ({ uid: uid(`subcategory:${c}`), sub_category: c })));
  await loadTaxCodes(ctx, products);

  const rows: Row[] = [];
  for (const r of products) {
    const sku = code(r["SKU Code"]) ?? code(r["Product Code"]);
    if (!sku) { ctx.warn.push(`product row skipped (no SKU): ${str(r["Product Name"])}`); continue; }
    const id = given(r["UID"], `product:${sku}`);
    rows.push({
      uid: id, model_number: code(r["Product Code"]) ?? sku, brand: str(r["Brand"]) ?? "", super_brand: str(r["Super Brand"]),
      category: str(r["Category"]) ?? "", sub_category: str(r["Sub Category"]) ?? "", model_name: str(r["Product Name"]) ?? str(r["SKU Name"]) ?? sku,
      sku_code: sku, sku_name: str(r["SKU Name"]) ?? str(r["Product Name"]) ?? sku, sku_size: str(r["SKU Size"]),
      mrp: num(r["MRP"]) ?? 0, dp: num(r["Dealer Price"]) ?? 0, description: str(r["Description"]),
      active: flag(r["Status"]), primary_unit: str(r["Primary Unit"]), secondary_units: packUnits(r["Secondary Units"]),
      variant: str(r["Variant"]) ?? "", allowed_states: list(r["Allowed States"]), allowed_designations: list(r["Allowed Designations"]),
      allowed_channels: list(r["Allowed Channels"]), minimum_quantities: list(r["Minimum Quantities"]), minimum_stock_level: list(r["Minimum Stock Level"]),
      division: list(r["Division"]), position: num(r["Position"]), focus_product: flag(r["Focus Product"]),
      must_sell_channels: list(r["Must Sell Channels"]), must_sell_classes: list(r["Must Sell Classes"]), must_sell_types: list(r["Must Sell Types"]),
      must_sell_states: list(r["Must Sell States"]), must_sell_regions: list(r["Must Sell Regions"]),
      tax_configuration_uid: taxUid(r),
      created_at: stamp(r["Created Date"], r["Created Time"]) ?? nowIso(), updated_at: stamp(r["Updated Date"], r["Updated Time"]) ?? nowIso(),
    });
    [r["Image1"], r["Image2"]].forEach((u, i) => {
      const url = str(u);
      if (url) ctx.images.product.push({ uid: uid(`pimg:${id}|${i + 1}`), product_uid: id, image_url: url, imagesno: i + 1 });
    });
  }
  ctx.summary.push(`products ${await upsert(ctx, "fp_product", rows)}`);
};
