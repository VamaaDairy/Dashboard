import { ClipboardCheck } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Order Processing (Recibo route `fpcustbookingorders`).
 *
 * Spec columns: 22; built: 21.
 * Left out (buttons, or no matching data column):
 *   - Scheme Description (spec maps it to the wrong field)
 * The portal filters by month and year; this uses From / To like the other reports. Item lines and the Select / Cancel actions are not built.
 */
export const fpcustbookingorders: MasterDef = {
  slug: "fpcustbookingorders",
  title: "Order Processing",
  subtitle: "Orders from retailers and other customers below the distributor level, with status and invoicing so far.",
  icon: ClipboardCheck,
  from: `fp_booking_order m
    left join fp_firm j1 on j1.uid = m.from_firm_uid
    left join fp_staff j2 on j2.uid = m.staff_uid
    left join fp_firm j3 on j3.uid = m.to_firm_uid
    left join fp_staff j4 on j4.uid = j1.sales_contact_uid
    left join fp_channel j5 on j5.uid = j1.channel_uid`,
  baseWhere: "(j5.level is null or j5.level >= 4)",
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.booking_time desc)", kind: "num" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "syncStatus", label: "Sync Status", expr: "m.sync_status", kind: "num" },
    { key: "syncRemark", label: "Sync Remark", expr: "m.sync_remark" },
    { key: "currentStatus", label: "Current Status", expr: "m.current_status" },
    { key: "orderId", label: "Order ID", expr: "m.order_id", kind: "num" },
    { key: "date", label: "Date", expr: "m.booking_time", kind: "date" },
    { key: "from", label: "From", expr: "j1.name" },
    { key: "fromCode", label: "From Code", expr: "j1.firm_code", kind: "mono" },
    { key: "items", label: "Items", expr: "m.total_item", kind: "num" },
    { key: "qty", label: "Qty.", expr: "m.total_quantity", kind: "num" },
    { key: "valueDp", label: "Value (DP)", expr: "m.dealer_cost", kind: "money" },
    { key: "invoiceQty", label: "Invoice Qty.", expr: "m.invoice_quantity", kind: "num" },
    { key: "cancelledQty", label: "Cancelled Qty.", expr: "m.cancelled_quantity", kind: "num" },
    { key: "bookedBy", label: "Booked By", expr: "j2.first_name" },
    { key: "employeeCode", label: "Employee Code", expr: "j2.employee_code", kind: "mono" },
    { key: "to", label: "To", expr: "j3.name" },
    { key: "toCode", label: "To Code", expr: "j3.firm_code", kind: "mono" },
    { key: "salesContactTeam", label: "Sales Contact Team", expr: "j4.team_team" },
    { key: "fromShippingAddress", label: "From Shipping Address", expr: "nullif(m.from_shipping_address::text, 'null')" },
    { key: "toShippingAddress", label: "To Shipping Address", expr: "nullif(m.to_shipping_address::text, 'null')" },
  ],
  search: ["m.order_id", "j1.name", "j3.name", "j2.employee_code"],
  filters: [
    { key: "status", label: "Status", expr: "m.status" },
    { key: "channel", label: "Channel", expr: "j5.channel" },
    { key: "state", label: "State", expr: "j1.state_state" },
  ],
  order: "m.booking_time desc",
};
