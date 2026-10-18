import { Gift } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Product Schemes (Recibo route `schemes`).
 *
 * Spec columns: 38; built: 17.
 * Left out (buttons, or no matching data column):
 *   - Product Name (product.modelName)
 *   - SKU Code (product.skuCode)
 *   - Variant (product.variant)
 *   - SKU Size (product.skuSize)
 *   - Offer Qty (offerQty)
 *   - Minimum Qty (minQty)
 *   - Offer Value (offerValue)
 *   - Scheme Description (offerValue)
 *   - Multiplier (offer.multiplier)
 *   - Sp Value (offer.spValue)
 *   - Discount Value (offer.spValue)
 *   - Dis Percentage (offer.discountValue)
 *   - Additional Qty (offer.discountPercentage)
 *   - Additional Quantity Price (offer.additionalQty)
 *   - Offer Product Name (offer.additionalQtyPrice)
 *   - Offer Product Qty (offer.offerProductName)
 *   - Offer Product Qty Price (offer.offerProductQty)
 *   - Voucher (offer.voucher)
 *   - Voucher Value (offer.voucher)
 *   - Voucher Description (offer.voucherValue)
 *   - Bundle Description (offer.voucherDescription)
 */
export const schemes: MasterDef = {
  slug: "schemes",
  title: "Product Schemes",
  subtitle: "Trade schemes with the channels, states and products they apply to.",
  icon: Gift,
  from: `fp_scheme m
    left join fp_channel j1 on j1.uid = m.channel_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.start_date desc, m.name)", kind: "num" },
    { key: "schemeName", label: "Scheme Name", expr: "m.name" },
    { key: "type", label: "Type", expr: "m.type", kind: "num" },
    { key: "channel", label: "Channel", expr: "j1.channel" },
    { key: "basedOn", label: "Based On", expr: "m.based_on", kind: "num" },
    { key: "startDate", label: "Start Date", expr: "m.start_date", kind: "date" },
    { key: "endDate", label: "End Date", expr: "m.end_date", kind: "date" },
    { key: "states", label: "States", expr: "m.states" },
    { key: "branch", label: "Branch", expr: "m.states" },
    { key: "customerType", label: "Customer Type", expr: "nullif(m.firm_types::text, 'null')" },
    { key: "customerClass", label: "Customer Class", expr: "nullif(m.firm_classes::text, 'null')" },
    { key: "categories", label: "Categories", expr: "nullif(m.product_categories::text, 'null')" },
    { key: "subCategories", label: "Sub Categories", expr: "nullif(m.product_sub_categories::text, 'null')" },
    { key: "brands", label: "Brands", expr: "nullif(m.product_brands::text, 'null')" },
    { key: "assortedQty", label: "Assorted Qty", expr: "m.assorted_scheme_quantity", kind: "num" },
    { key: "productScheme", label: "Product Scheme", expr: "m.include_product_scheme", kind: "num" },
    { key: "status", label: "Status", expr: "case when m.active = 1 then 'Active' else 'Inactive' end", kind: "status" },
  ],
  search: ["m.name"],
  filters: [
    { key: "channel", label: "Channel", expr: "j1.channel" },
    { key: "type", label: "Type", expr: "m.type" },
  ],
  order: "m.start_date desc, m.name",
};
