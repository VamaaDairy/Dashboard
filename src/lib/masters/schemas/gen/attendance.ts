import { CalendarCheck } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Attendance (Recibo route `attendance`).
 *
 * Spec columns: 34; built: 32.
 * Left out (buttons, or no matching data column):
 *   - Update (button)
 *   - Update (button)
 */
export const attendance: MasterDef = {
  slug: "attendance",
  title: "Attendance",
  subtitle: "Daily login and logout of each employee, with working time, visits and expense claims.",
  icon: CalendarCheck,
  from: `fp_staff_attendance m
    left join fp_staff j1 on j1.uid = m.staff_uid
    left join fp_designation j2 on j2.uid = j1.designation_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.attendance_date desc, m.login_time desc)", kind: "num" },
    { key: "name", label: "Name", expr: "j1.first_name" },
    { key: "code", label: "Code", expr: "j1.employee_code", kind: "mono" },
    { key: "division", label: "Division", expr: "nullif(j1.division::text, 'null')" },
    { key: "branch", label: "Branch", expr: "j1.team_team" },
    { key: "email", label: "Email", expr: "j1.email" },
    { key: "phone", label: "Phone", expr: "j1.phone", kind: "mono" },
    { key: "daysOnLeave", label: "Days on Leave", expr: "m.days_on_leave", kind: "num" },
    { key: "workingDays", label: "Working Days", expr: "m.working_days", kind: "num" },
    { key: "avgWorkingHours", label: "Avg. Working Hours", expr: "m.avg_working_hours", kind: "num" },
    { key: "date", label: "Date", expr: "m.attendance_date", kind: "date" },
    { key: "visits", label: "Visits", expr: "m.visits", kind: "num" },
    { key: "workingTime", label: "Working Time", expr: "m.working_time", kind: "num" },
    { key: "workingHours", label: "Working Hours", expr: "m.working_time", kind: "num" },
    { key: "allowanceKm", label: "Allowance/KM", expr: "m.km_allowance", kind: "money" },
    { key: "travelDistance", label: "Travel Distance", expr: "m.distance", kind: "num" },
    { key: "travelReimbursement", label: "Travel Reimbursement", expr: "m.travel_reimbursement", kind: "num" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "loginAddress", label: "Login Address", expr: "m.login_address" },
    { key: "logoutAddress", label: "Logout Address", expr: "m.logout_address" },
    { key: "loginType", label: "Login Type", expr: "m.login_type" },
    { key: "logoutType", label: "Logout Type", expr: "m.logout_type" },
    { key: "reporting", label: "Reporting", expr: "m.reporting" },
    { key: "loginDate", label: "Login Date", expr: "m.login_time", kind: "date" },
    { key: "logoutDate", label: "Logout Date", expr: "m.logout_time", kind: "date" },
    { key: "reLoginDate", label: "Re-Login Date", expr: "m.re_login_time", kind: "date" },
    { key: "reLoginAddress", label: "Re-Login Address", expr: "m.re_login_address" },
    { key: "reLogoutDate", label: "Re-Logout Date", expr: "m.re_logout_time", kind: "date" },
    { key: "reLogoutAddress", label: "Re-Logout Address", expr: "m.re_logout_address" },
    { key: "reLoginApproval", label: "Re-Login Approval", expr: "m.re_login_approval", kind: "num" },
    { key: "lastLogoutDate", label: "Last Logout Date", expr: "m.re_logout_time", kind: "date" },
    { key: "lastLogoutAddress", label: "Last Logout Address", expr: "m.re_logout_address" },
  ],
  search: ["j1.first_name", "j1.employee_code", "j1.email"],
  filters: [
    { key: "state", label: "State", expr: "j1.state_state" },
    { key: "designation", label: "Designation", expr: "j2.designation" },
  ],
  order: "m.attendance_date desc, m.login_time desc",
};
