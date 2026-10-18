import { Activity } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Customer Activity Insights (Recibo route `customerActivity`).
 *
 * Spec columns: 22; built: 19.
 * Left out (buttons, or no matching data column):
 *   - View Images (button)
 *   - View Product (button)
 *   - View QPS Scheme (button)
 */
export const customerActivity: MasterDef = {
  slug: "customerActivity",
  title: "Customer Activity Insights",
  subtitle: "Each scheduled customer visit and activity: who, where, check-in / check-out, time spent and route deviation.",
  icon: Activity,
  from: `fp_staff_channel_activity m
    left join fp_channel_activity j1 on j1.uid = m.channel_activity_uid
    left join fp_staff j2 on j2.uid = m.staff_uid
    left join fp_firm j3 on j3.uid = m.firm_uid
    left join fp_state j4 on j4.state = j3.state_state`,
  dateRange: { expr: "m.scheduled_time", days: 30 },
  cols: [
    { key: "date", label: "Date", expr: "m.scheduled_time", kind: "date" },
    { key: "activityName", label: "Activity Name", expr: "j1.activity_name" },
    { key: "staffName", label: "Staff Name", expr: "j2.first_name" },
    { key: "staffDivision", label: "Staff Division", expr: "nullif(j2.division::text, 'null')" },
    { key: "customerName", label: "Customer Name", expr: "j3.name" },
    { key: "customerCode", label: "Customer Code", expr: "j3.firm_code", kind: "mono" },
    { key: "customerDivision", label: "Customer Division", expr: "nullif(j3.division::text, 'null')" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "address", label: "Address", expr: "j3.address" },
    { key: "city", label: "City", expr: "j3.city" },
    { key: "state", label: "State", expr: "j4.state" },
    { key: "region", label: "Region", expr: "j4.region" },
    { key: "checkIn", label: "Check-In", expr: "m.start_time", kind: "datetime" },
    { key: "checkOut", label: "Check-Out", expr: "m.end_time", kind: "datetime" },
    { key: "timeSpent", label: "Time Spent", expr: "m.time_spent", kind: "num" },
    { key: "deviationStatus", label: "Deviation Status", expr: "m.deviation" },
    { key: "deviationDistance", label: "Deviation Distance", expr: "m.deviation_distance", kind: "num" },
    { key: "routeDeviationReason", label: "Route  Deviation Reason", expr: "m.route_deviation_reason" },
    { key: "activityid", label: "ActivityID", expr: "m.activity_id", kind: "num" },
  ],
  search: ["j2.first_name", "j2.employee_code", "j3.name", "j3.firm_code", "m.activity_id"],
  filters: [
    { key: "activity", label: "Activity", expr: "j1.activity_name" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "state", label: "State", expr: "j3.state_state" },
  ],
  order: "m.scheduled_time desc nulls last, m.created_at desc",
};
