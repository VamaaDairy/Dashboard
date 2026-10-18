import { RefreshCw } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Van Sale Stock Status (Recibo route `vansalestockreq`).
 *
 * Spec columns: 10; built: 9.
 * Left out (buttons, or no matching data column):
 *   - Action (button)
 * Pre-sale vs van-sale is not defined in the spec: a request made to an employee (van) is a van sale, any other is pre-sale.
 */
export const vansalestockreq: MasterDef = {
  slug: "vansalestockreq",
  title: "Van Sale Stock Status",
  subtitle: "Stock requests made to a van and whether each one synced.",
  icon: RefreshCw,
  from: `fp_stock_request m
    left join fp_staff j1 on j1.uid = m.to_staff_uid
    left join fp_van_master j2 on j2.uid = j1.van_master_uid`,
  baseWhere: "m.to_staff_uid is not null",
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.request_time desc nulls last)", kind: "num" },
    { key: "reqNo", label: "Req.No", expr: "m.requisition_number", kind: "num" },
    { key: "date", label: "Date", expr: "m.request_time" },
    { key: "items", label: "Items", expr: "m.total_items", kind: "num" },
    { key: "employeeName", label: "Employee Name", expr: "j1.first_name" },
    { key: "employeeCode", label: "Employee Code", expr: "j1.employee_code", kind: "mono" },
    { key: "vanName", label: "Van Name", expr: "j2.van_name" },
    { key: "vanCode", label: "Van Code", expr: "j2.van_code", kind: "mono" },
    { key: "binLocation", label: "Bin Location", expr: "j2.bin_location" },
  ],
  search: ["m.requisition_number", "j1.first_name", "j1.employee_code"],
  order: "m.request_time desc nulls last",
};
