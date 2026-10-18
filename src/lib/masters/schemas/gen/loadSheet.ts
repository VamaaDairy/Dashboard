import { Truck } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Load Sheet (Recibo route `loadSheet`).
 *
 * Spec columns: 22; built: 14.
 * Left out (buttons, or no matching data column):
 *   - Invoice Number (spec maps it to the wrong field)
 *   - Route (spec maps it to the wrong field)
 *   - Print (button)
 *   - Modify (button)
 *   - Return (None)
 *   - Select (button)
 *   - Route (spec maps it to the wrong field)
 *   - Print (button)
 * Product / stock lines of a load sheet and the Print / Modify / Approve Return actions are not built.
 */
export const loadSheet: MasterDef = {
  slug: "loadSheet",
  title: "Load Sheet",
  subtitle: "Load sheets with vehicle, route, delivery staff and return status.",
  icon: Truck,
  from: `fp_load_sheet m
    left join fp_firm j1 on j1.uid = m.from_firm_uid
    left join fp_staff j2 on j2.uid = m.delivery_staff_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "m.load_sheet_number", kind: "num" },
    { key: "date", label: "Date", expr: "m.generation_date", kind: "date" },
    { key: "vehicleNumber", label: "Vehicle Number", expr: "m.vehicle_number", kind: "mono" },
    { key: "remark", label: "Remark", expr: "m.remark" },
    { key: "toPincode", label: "To Pincode", expr: "m.to_pincode", kind: "mono" },
    { key: "toAddress", label: "To Address", expr: "m.to_address" },
    { key: "distance", label: "Distance", expr: "m.distance", kind: "num" },
    { key: "fromFirm", label: "From Firm", expr: "j1.name" },
    { key: "orderNumber", label: "Order Number", expr: "nullif(m.booking_number::text, 'null')" },
    { key: "deliveryStaffName", label: "Delivery Staff Name", expr: "j2.first_name" },
    { key: "deliveryStaffCode", label: "Delivery Staff Code", expr: "j2.employee_code", kind: "mono" },
    { key: "approveReturn", label: "Approve Return", expr: "m.distance", kind: "num" },
    { key: "stockReturn", label: "Stock Return", expr: "m.return_flag", kind: "num" },
    { key: "rejectedReason", label: "Rejected Reason", expr: "m.return_canceled_reason" },
  ],
  search: ["m.load_sheet_number", "m.vehicle_number", "m.booking_number", "j2.first_name"],
  order: "m.generation_date desc nulls last, m.created_at desc",
};
