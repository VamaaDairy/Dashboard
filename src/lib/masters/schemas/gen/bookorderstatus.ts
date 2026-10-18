import { RefreshCw } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Booking Order Status (Recibo route `bookorderstatus`).
 *
 * Spec columns: 8; built: 7.
 * Left out (buttons, or no matching data column):
 *   - Action (button)
 */
export const bookorderstatus: MasterDef = {
  slug: "bookorderstatus",
  title: "Booking Order Status",
  subtitle: "Booking orders with their sync status and remarks.",
  icon: RefreshCw,
  from: `fp_booking_order m
    left join fp_staff j1 on j1.uid = m.staff_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.booking_time desc)", kind: "num" },
    { key: "orderId", label: "Order ID", expr: "m.order_id", kind: "num" },
    { key: "date", label: "Date", expr: "m.booking_time", kind: "date" },
    { key: "items", label: "Items", expr: "m.total_item", kind: "num" },
    { key: "employeeName", label: "Employee Name", expr: "j1.first_name" },
    { key: "employeeCode", label: "Employee Code", expr: "j1.employee_code", kind: "mono" },
    { key: "syncRemarks", label: "Sync Remarks", expr: "m.sync_remark" },
  ],
  search: ["m.order_id", "j1.first_name", "j1.employee_code"],
  order: "m.booking_time desc",
};
