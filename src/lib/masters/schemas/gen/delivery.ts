import { PackageCheck } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Delivery (Recibo route `delivery`).
 *
 * Spec columns: 10; built: 10.
 */
export const delivery: MasterDef = {
  slug: "delivery",
  title: "Delivery",
  subtitle: "Deliveries made to customers, with items, quantity and value.",
  icon: PackageCheck,
  from: `fp_delivery m
    left join fp_firm j1 on j1.uid = m.to_firm_uid
    left join fp_staff j2 on j2.uid = m.staff_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.delivery_time desc nulls last, m.created_at desc)", kind: "num" },
    { key: "date", label: "Date", expr: "m.delivery_time", kind: "date" },
    { key: "toFirm", label: "To Firm", expr: "j1.name" },
    { key: "totalItems", label: "Total Items", expr: "m.total_item", kind: "num" },
    { key: "totalQuantity", label: "Total Quantity", expr: "m.total_quantity", kind: "num" },
    { key: "netPrice", label: "Net Price", expr: "m.net_price", kind: "money" },
    { key: "totalCost", label: "Total Cost", expr: "m.total_cost", kind: "money" },
    { key: "dealerCost", label: "Dealer Cost", expr: "m.dealer_cost", kind: "money" },
    { key: "deliveredStaff", label: "Delivered Staff", expr: "j2.first_name" },
    { key: "schemeDescription", label: "Scheme Description", expr: "nullif(m.scheme_details::text, 'null')" },
  ],
  search: ["m.invoice_number", "j1.name", "j2.first_name"],
  order: "m.delivery_time desc nulls last, m.created_at desc",
};
