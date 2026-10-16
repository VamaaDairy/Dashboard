import { ClipboardList } from "lucide-react";
import type { MasterDef } from "../types";
import { active, person } from "./fragments";

/**
 * Secondary Order Booking Report (Recibo route `orderBookingReport`, Insights > Secondary Order).
 *
 * Follows the portal spec in src/app/md.md: the same 49 grid columns in the same
 * order, one row per booked item, From / To dates and Apply, with the order-type,
 * channel and state filters its state names point at. Column paths in the
 * comments are the portal's field names.
 *
 * Not in the spec, so derived here: "TAX %" (tax over the basic value) and
 * "Delivery Value" (delivered quantity x selling price).
 */
export const orderBookingReport: MasterDef = {
  slug: "orderBookingReport",
  title: "Secondary Order Booking Report",
  subtitle: "Orders booked in the field, one line per item, with who booked them, for which customer and to which distributor.",
  icon: ClipboardList,
  from: `fp_booking_order_item i
    join fp_booking_order o on o.uid = i.booking_order_uid
    join fp_product p on p.uid = i.product_uid
    left join fp_firm ff on ff.uid = o.from_firm_uid
    left join fp_state fs on fs.state = ff.state_state
    left join fp_channel fc on fc.uid = ff.channel_uid
    left join fp_staff sc on sc.uid = ff.sales_contact_uid
    left join fp_firm tf on tf.uid = o.to_firm_uid
    left join fp_staff st on st.uid = o.staff_uid
    left join fp_designation sd on sd.uid = st.designation_uid
    left join fp_staff rm on rm.uid = st.reporting_manager_uid`,
  dateRange: { expr: "o.booking_time", days: 30 },
  emptyNote: "No orders were booked in this period.",
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by o.booking_time desc, o.order_id desc, i.order_item_number)", kind: "num" },
    { key: "region", label: "Region", expr: "fs.region" },
    { key: "bookingDate", label: "Booking Date", expr: "o.booking_time", kind: "datetime" },
    { key: "orderId", label: "Booking ID", expr: "o.order_id", kind: "mono" },
    { key: "empName", label: "Booked By Employee Name", expr: "st.first_name" },
    { key: "empCode", label: "Employee Code", expr: "st.employee_code", kind: "mono" },
    { key: "empPhone", label: "Employee Phone", expr: "st.phone", kind: "mono" },
    { key: "empDesignation", label: "Employee Designation", expr: "sd.designation" },
    { key: "empEmail", label: "Employee Email", expr: "st.email" },
    { key: "empTeam", label: "Branch/Team/Territory", expr: "st.team_team" },
    { key: "empState", label: "Employee State", expr: "st.state_state" },
    { key: "manager", label: "Reporting Manager", expr: person("rm") },
    { key: "status", label: "Status", expr: "o.status" },
    { key: "syncStatus", label: "Sync Status", expr: "o.sync_status", kind: "num" },
    { key: "syncRemark", label: "Sync Remark", expr: "o.sync_remark" },
    { key: "custName", label: "Customer Name", expr: "ff.name" },
    { key: "custChannel", label: "Customer Channel", expr: "fc.channel" },
    { key: "custType", label: "Customer Type", expr: "fc.sales_type" },
    { key: "custPhone", label: "Customer Phone", expr: "ff.phone", kind: "mono" },
    { key: "custPlace", label: "Customer Place", expr: "ff.place" },
    { key: "custCity", label: "Customer City", expr: "ff.city" },
    { key: "custPincode", label: "Customer Pincode", expr: "ff.pincode", kind: "mono" },
    { key: "custState", label: "State", expr: "ff.state_state" },
    { key: "custStatus", label: "Customer Status", expr: active("ff"), kind: "status" },
    { key: "custTeam", label: "Customer Branch/Team/Territory", expr: "sc.team_team" },
    { key: "orderType", label: "Order Type", expr: "o.order_type" },
    { key: "distName", label: "Order Booked To - Distributor Name", expr: "tf.name" },
    { key: "distCode", label: "Distributor Code", expr: "tf.firm_code", kind: "mono" },
    { key: "skuCode", label: "SKU Code", expr: "p.sku_code", kind: "mono" },
    { key: "sku", label: "SKU", expr: "p.sku_name" },
    { key: "mrp", label: "MRP", expr: "p.mrp", kind: "money" },
    { key: "dp", label: "DP", expr: "p.dp", kind: "money" },
    { key: "skuSize", label: "SKU Size", expr: "p.sku_size" },
    { key: "category", label: "Category", expr: "p.category" },
    { key: "subCategory", label: "Sub Category", expr: "p.sub_category" },
    { key: "brand", label: "Brand", expr: "trim(p.brand)" },
    { key: "qty", label: "Quantity", expr: "i.quantity", kind: "num" },
    { key: "unit", label: "Booked Unit", expr: "i.unit ->> 'name'" },
    { key: "sellingPrice", label: "Selling Price", expr: "i.selling_price", kind: "money" },
    { key: "scheme", label: "Item Scheme Description", expr: "nullif(i.scheme_details::text, 'null')", wide: true },
    { key: "taxPct", label: "TAX %", expr: "case when i.net_price > 0 then round(((i.total_cost - i.net_price) / i.net_price * 100)::numeric, 2) end", kind: "num" },
    { key: "basic", label: "Basic Value/Total Cost Without Tax Value", expr: "i.net_price", kind: "money" },
    { key: "totalValue", label: "Total Value", expr: "i.total_cost", kind: "money" },
    { key: "cost", label: "Cost", expr: "i.total_cost", kind: "money" },
    { key: "stock", label: "Stock Audit", expr: "i.stock", kind: "num" },
    { key: "deliveryDate", label: "Delivery Date", expr: "i.delivery_date", kind: "date" },
    { key: "deliveryQty", label: "Delivery Quantity", expr: "i.invoice_quantity", kind: "num" },
    { key: "deliveryValue", label: "Delivery Value", expr: "i.invoice_quantity * i.selling_price", kind: "money" },
    { key: "custCreated", label: "Customer Created Date", expr: "ff.created_at", kind: "date" },
  ],
  search: ["o.order_id", "ff.name", "ff.firm_code", "st.first_name", "st.employee_code", "tf.name", "tf.firm_code", "p.sku_code", "p.sku_name"],
  filters: [
    { key: "orderType", label: "Order type", expr: "o.order_type" },
    { key: "channel", label: "Channel", expr: "fc.channel" },
    { key: "state", label: "State", expr: "ff.state_state" },
  ],
  order: "o.booking_time desc, o.order_id desc, i.order_item_number",
};
