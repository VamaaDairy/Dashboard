import { ScanFace } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Employee Face Registration (Recibo route `employeefaceregistration`).
 *
 * Spec columns: 10; built: 8.
 * Left out (buttons, or no matching data column):
 *   - Approve (button)
 *   - Reject (button)
 */
export const employeefaceregistration: MasterDef = {
  slug: "employeefaceregistration",
  title: "Employee Face Registration",
  subtitle: "Employees registered for face attendance, and re-registration requests.",
  icon: ScanFace,
  from: `fp_staff_face m
    left join fp_staff j1 on j1.uid = m.staff_uid
    left join fp_designation j2 on j2.uid = j1.designation_uid
    left join fp_staff j3 on j3.uid = j1.reporting_manager_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "name", label: "Name", expr: "j1.first_name" },
    { key: "employeeCode", label: "Employee Code", expr: "j1.employee_code", kind: "mono" },
    { key: "state", label: "State", expr: "j1.state_state" },
    { key: "phone", label: "Phone", expr: "j1.phone", kind: "mono" },
    { key: "email", label: "Email", expr: "j1.email" },
    { key: "designation", label: "Designation", expr: "j2.designation" },
    { key: "reportingManager", label: "Reporting Manager", expr: "j3.first_name" },
  ],
  search: ["j1.first_name", "j1.employee_code"],
  filters: [
    { key: "designation", label: "Designation", expr: "j2.designation" },
  ],
  order: "m.created_at desc",
};
