import { Eye } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Display Audit (Recibo route `displayAudit`).
 *
 * Spec columns: 22; built: 12.
 * Left out (buttons, or no matching data column):
 *   - Date (approvalDate)
 *   - Employee Name (staff.firstName)
 *   - Employee E-Mail (staff.email)
 *   - Date (scheduledTime)
 *   - Activity Type (channelActivity.activityName)
 *   - Time Spent (timeSpent)
 *   - Name (staff.firstName)
 *   - Deviation Status (deviation)
 *   - Deviation Distance (deviationDistance)
 *   - Route  Deviation Reason (routeDeviationReason)
 */
export const displayAudit: MasterDef = {
  slug: "displayAudit",
  title: "Display Audit",
  subtitle: "Customers enrolled in display audits, with the amount and period.",
  icon: Eye,
  from: `fp_display_audit m
    left join fp_firm j1 on j1.uid = m.firm_uid
    left join fp_state j2 on j2.state = j1.state_state
    left join fp_channel j3 on j3.uid = j1.channel_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "customer", label: "Customer", expr: "j1.name" },
    { key: "customerCode", label: "Customer Code", expr: "j1.firm_code", kind: "mono" },
    { key: "amount", label: "Amount", expr: "m.amount", kind: "money" },
    { key: "enrollDate", label: "Enroll Date", expr: "m.enroll_date", kind: "date" },
    { key: "startDate", label: "Start Date", expr: "m.start_date", kind: "date" },
    { key: "endDate", label: "End Date", expr: "m.end_date", kind: "date" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "customerRegion", label: "Customer Region", expr: "j2.region" },
    { key: "customerState", label: "Customer State", expr: "j1.state_state" },
    { key: "customerChannel", label: "Customer Channel", expr: "j3.channel" },
    { key: "status2", label: "Status", expr: "m.status" },
  ],
  search: ["j1.name", "j1.firm_code"],
  filters: [
    { key: "channel", label: "Channel", expr: "j3.channel" },
    { key: "state", label: "State", expr: "j1.state_state" },
  ],
  order: "m.created_at desc",
};
