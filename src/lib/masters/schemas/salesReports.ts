import { TrendingUp } from "lucide-react";
import type { MasterDef } from "../types";

/**
 * Secondary Sales Report and Primary Sales Report (Recibo routes
 * `secondarySalesReport` / `primarySalesReport`, one component in the portal).
 * Same 39 grid columns in the spec's order, one row per invoiced item, From / To.
 *
 * The spec doesn't say what separates primary from secondary, so it is taken from
 * the buyer: a distributor / stockist / company (channel level 3 or above in the
 * chain) is a primary sale, anything below is secondary.
 * The date filter uses the transaction time (falling back to when it was created);
 * "Sales Date" shows the voucher time exactly as stored.
 */
const FROM = `fp_transaction_item i
    join fp_transaction t on t.uid = i.transaction_uid
    join fp_product p on p.uid = i.product_uid
    left join fp_firm tf on tf.uid = t.to_firm_uid
    left join fp_firm ff on ff.uid = t.from_firm_uid
    left join fp_channel tc on tc.uid = tf.channel_uid
    left join fp_state ts on ts.state = tf.state_state
    left join fp_booking_order bo on bo.uid = t.booking_order_uid
    left join fp_staff bs on bs.uid = bo.staff_uid
    left join fp_staff vs on vs.uid = t.user_uid`;

const COLS: MasterDef["cols"] = [
  { key: "salesDate", label: "Sales Date", expr: "t.voucher_time", kind: "mono" },
  { key: "toFirm", label: "To Firm", expr: "tf.name" },
  { key: "fromFirm", label: "From Firm", expr: "ff.name" },
  { key: "skuName", label: "SKU Name", expr: "p.sku_name" },
  { key: "skuCode", label: "SKU Code", expr: "p.sku_code", kind: "mono" },
  { key: "skuSize", label: "SKU Size", expr: "p.sku_size" },
  { key: "mrp", label: "MRP", expr: "p.mrp", kind: "money" },
  { key: "dp", label: "DP", expr: "p.dp", kind: "money" },
  { key: "category", label: "Category", expr: "p.category" },
  { key: "subCategory", label: "Sub Category", expr: "p.sub_category" },
  { key: "unit", label: "Unit", expr: "i.unit ->> 'name'" },
  { key: "orderQty", label: "Order Quantity", expr: "i.order_quantity", kind: "num" },
  { key: "orderValue", label: "Order Value", expr: "i.order_value", kind: "money" },
  { key: "invoiceQty", label: "Invoice Qty.", expr: "i.invoice_quantity", kind: "num" },
  { key: "invoiceValue", label: "Invoice Value", expr: "i.invoice_value", kind: "money" },
  { key: "cancelledQty", label: "Cancelled Qty.", expr: "i.cancelled_quantity", kind: "num" },
  { key: "cancelledValue", label: "Cancelled Value", expr: "i.cancelled_quantity_value", kind: "money" },
  { key: "discPct", label: "Discount %", expr: "i.additional_discount_percentage", kind: "num" },
  { key: "discValue", label: "Discount Value", expr: "i.additional_discount_value", kind: "money" },
  { key: "extraPct", label: "Extra Discount %", expr: "i.extra_discount_percentage", kind: "num" },
  { key: "extraValue", label: "Extra Discount Value", expr: "i.extra_discount_value", kind: "money" },
  { key: "cashPct", label: "Cash Discount %", expr: "t.cash_discount_percentage", kind: "num" },
  { key: "cashValue", label: "Cash Discount Value", expr: "i.cash_discount_percentage_value", kind: "money" },
  { key: "secPct", label: "Secondary Discount %", expr: "t.secondary_discount_percentage", kind: "num" },
  { key: "secValue", label: "Secondary Discount Value", expr: "i.secondary_discount_value", kind: "money" },
  { key: "cashFixed", label: "Cash Discount (Fixed In Amount)", expr: "i.cash_discount_fixed_value", kind: "money" },
  { key: "invoiceNo", label: "Invoice Number", expr: "t.voucher_number", kind: "mono" },
  { key: "bookedDate", label: "Booked Date", expr: "i.booking_order_date", kind: "mono" },
  { key: "deliveryDate", label: "Delivery Date", expr: "i.delivery_date", kind: "mono" },
  { key: "tat", label: "Order to Delivery TAT - No of Days", expr: "i.tat", kind: "num" },
  { key: "productScheme", label: "Product Scheme", expr: "nullif(i.scheme_details::text, 'null')", wide: true },
  { key: "orderScheme", label: "Order Scheme", expr: "nullif(t.scheme_details::text, 'null')", wide: true },
  { key: "returnType", label: "Return Type", expr: "t.return_type" },
  { key: "returnReason", label: "Return Reason", expr: "t.return_reason" },
  { key: "bookedStaff", label: "Booked Staff", expr: "bs.first_name" },
  { key: "vanStaff", label: "Van Sales Staff", expr: "vs.first_name" },
  { key: "channel", label: "Channel", expr: "tc.channel" },
  { key: "state", label: "State", expr: "tf.state_state" },
  { key: "region", label: "Region", expr: "ts.region" },
];

const report = (slug: string, title: string, subtitle: string, baseWhere: string): MasterDef => ({
  slug,
  title,
  subtitle,
  icon: TrendingUp,
  from: FROM,
  baseWhere,
  dateRange: { expr: "coalesce(t.transaction_time, t.created_at)", days: 30 },
  emptyNote: "No sales were invoiced in this period.",
  cols: COLS,
  search: ["t.voucher_number", "tf.name", "tf.firm_code", "ff.name", "p.sku_code", "p.sku_name"],
  order: "coalesce(t.transaction_time, t.created_at) desc, t.voucher_number, i.created_at",
});

export const secondarySalesReport = report(
  "secondarySalesReport",
  "Secondary Sales Report",
  "Item-wise sales to retailers and other customers below the distributor level.",
  "tc.level is null or tc.level >= 4",
);

export const primarySalesReport = report(
  "primarySalesReport",
  "Primary Sales Report",
  "Item-wise sales to distributors and stockists.",
  "tc.level <= 3",
);
