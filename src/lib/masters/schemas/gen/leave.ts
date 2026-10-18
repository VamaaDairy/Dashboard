import { CalendarOff } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Leave Management (Recibo route `leave`).
 *
 * Spec columns: 16; built: 13.
 * Left out (buttons, or no matching data column):
 *   - Approver (approver.firstName)
 *   - Approve Time (approveTime)
 *   - Remark (remarks)
 */
export const leave: MasterDef = {
  slug: "leave",
  title: "Leave Management",
  subtitle: "Leave requests by employee, with type, period and status.",
  icon: CalendarOff,
  from: `fp_staff_leave m
    left join fp_staff j1 on j1.uid = m.staff_uid
    left join fp_designation j2 on j2.uid = j1.designation_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "name", label: "Name", expr: "j1.first_name" },
    { key: "code", label: "Code", expr: "j1.employee_code", kind: "mono" },
    { key: "email", label: "Email", expr: "j1.email" },
    { key: "division", label: "Division", expr: "nullif(j1.division::text, 'null')" },
    { key: "phone", label: "Phone", expr: "j1.phone", kind: "mono" },
    { key: "type", label: "Type", expr: "m.request_type" },
    { key: "requestDate", label: "Request Date", expr: "m.request_time", kind: "date" },
    { key: "daysOnLeave", label: "Days on Leave", expr: "m.days", kind: "num" },
    { key: "fromDate", label: "From Date", expr: "m.from_date", kind: "date" },
    { key: "toDate", label: "To Date", expr: "m.to_date", kind: "date" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "remark", label: "Remark", expr: "m.remark" },
  ],
  search: ["j1.first_name", "j1.employee_code"],
  filters: [
    { key: "state", label: "State", expr: "j1.state_state" },
    { key: "designation", label: "Designation", expr: "j2.designation" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "type", label: "Type", expr: "m.request_type" },
  ],
  order: "m.created_at desc",
};
