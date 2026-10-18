import { Footprints } from "lucide-react";
import type { MasterDef } from "../types";
import { person } from "./fragments";

/**
 * Market Visits (Recibo route `activity`, Insights > Market Visits): the
 * employee-level summary grid. One row per employee, with the visit counters
 * of every scheduled customer activity in the chosen period added up.
 *
 * The counters are stored on `fp_staff_channel_activity`, one row per scheduled
 * customer activity. Adding them per employee is how the summary is read here;
 * the spec doesn't spell the aggregation out.
 *
 * Left out:
 *   - % Coverage, % Productivity, % Productivity on Scheduled (formulas not in the spec)
 *   - the second and third grids (an employee's activities, and the customer-wise
 *     list; the latter is the Customer Activity Insights screen)
 *   - the chart
 */
const sum = (col: string) => `coalesce(sum(a.${col}), 0)`;

export const marketVisits: MasterDef = {
  slug: "activity",
  title: "Market Visits",
  subtitle: "Visits and orders per employee over the period: outlets scheduled, completed, visited and billed.",
  icon: Footprints,
  from: `fp_staff_channel_activity a
    join fp_staff st on st.uid = a.staff_uid
    left join fp_state fs on fs.state = st.state_state
    left join fp_designation sd on sd.uid = st.designation_uid
    left join fp_staff rm on rm.uid = st.reporting_manager_uid
    left join fp_channel_activity ca on ca.uid = a.channel_activity_uid`,
  groupBy: "st.uid, fs.id, sd.uid, rm.uid",
  dateRange: { expr: "a.scheduled_time", days: 30 },
  emptyNote: "No visits were scheduled in this period.",
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by st.first_name, st.employee_code)", kind: "num" },
    { key: "region", label: "Region", expr: "fs.region" },
    { key: "team", label: "Branch/Team/Territory", expr: "st.team_team" },
    { key: "state", label: "State", expr: "st.state_state" },
    { key: "name", label: "Name", expr: "st.first_name" },
    { key: "code", label: "Code", expr: "st.employee_code", kind: "mono" },
    { key: "designation", label: "Designation", expr: "sd.designation" },
    { key: "manager", label: "Reporting Manager", expr: person("rm") },
    { key: "scheduled", label: "Scheduled Outlets", expr: sum("schedules"), kind: "num" },
    { key: "completed", label: "Completed", expr: sum("completed"), kind: "num" },
    { key: "markVisit", label: "Mark Visit", expr: sum("mark_visit"), kind: "num" },
    { key: "devMarkVisit", label: "Deviated Mark Visit", expr: sum("deviated_mark_visit"), kind: "num" },
    { key: "nonDevMarkVisit", label: "Non - Deviated Mark Visit", expr: sum("non_deviated_mark_visit"), kind: "num" },
    { key: "orderTaken", label: "Order Taken", expr: sum("order_booked"), kind: "num" },
    { key: "primOrders", label: "Primary Order Taken", expr: sum("primary_order_booked"), kind: "num" },
    { key: "primQty", label: "Primary Order Quantity", expr: sum("primary_order_quantity"), kind: "num" },
    { key: "primValue", label: "Primary Order Value", expr: sum("primary_order_value"), kind: "money" },
    { key: "primCancelled", label: "Primary Cancelled Order Count", expr: sum("primary_canceled_order_count"), kind: "num" },
    { key: "secOrders", label: "Secondary Order Taken", expr: sum("secondary_order_booked"), kind: "num" },
    { key: "secQty", label: "Secondary Order Quantity", expr: sum("secondary_order_quantity"), kind: "num" },
    { key: "secValue", label: "Secondary Order Value", expr: sum("secondary_order_value"), kind: "money" },
    { key: "secCancelled", label: "Secondary Cancelled Order Count", expr: sum("secondary_canceled_order_count"), kind: "num" },
    { key: "primCusDev", label: "Primary Customer Deviated Activity Count", expr: sum("pr_cus_deviated_count"), kind: "num" },
    { key: "secCusDev", label: "Secondary Customer Deviated Activity Count", expr: sum("sec_cus_deviated_count"), kind: "num" },
    { key: "primCusNonDev", label: "Primary Customer Non - Deviated Activity Count", expr: sum("pr_cus_non_deviated_count"), kind: "num" },
    { key: "secCusNonDev", label: "Secondary Customer Non - Deviated Activity Count", expr: sum("sec_cus_non_deviated_count"), kind: "num" },
    { key: "devPrimBooked", label: "Deviated Primary OrderBooked", expr: sum("deviated_primary_order_booked"), kind: "num" },
    { key: "nonDevPrimBooked", label: "Non - Deviated Primary OrderBooked", expr: sum("non_deviated_primary_order_booked"), kind: "num" },
    { key: "devSecBooked", label: "Deviated Secondary OrderBooked", expr: sum("deviated_secondary_order_booked"), kind: "num" },
    { key: "nonDevSecBooked", label: "Non - Deviated Secondary OrderBooked", expr: sum("non_deviated_secondary_order_booked"), kind: "num" },
    { key: "devCalls", label: "Deviated Call Count", expr: sum("deviated_call_count"), kind: "num" },
    { key: "nonDevCalls", label: "Non - Deviated Call Count", expr: sum("non_deviated_call_count"), kind: "num" },
    { key: "uob", label: "Unique Outlets Billed / ECO", expr: sum("uob"), kind: "num" },
    { key: "newOutlets", label: "New Outlets Added", expr: sum("new_store_addition"), kind: "num" },
    { key: "checkNoActivity", label: "Checking Without Activity", expr: sum("checking_without_activity"), kind: "num" },
    { key: "pending", label: "Pending", expr: sum("yet_to_start"), kind: "num" },
    { key: "inProgress", label: "In Progress", expr: sum("in_progress"), kind: "num" },
    { key: "missed", label: "Missed", expr: sum("incomplete"), kind: "num" },
  ],
  search: ["st.first_name", "st.last_name", "st.employee_code"],
  filters: [
    { key: "activity", label: "Activity", expr: "ca.activity_name" },
    { key: "region", label: "Region", expr: "fs.region" },
    { key: "team", label: "Branch/Team", expr: "st.team_team" },
    { key: "state", label: "State", expr: "st.state_state" },
    { key: "designation", label: "Designation", expr: "sd.designation" },
  ],
  order: "st.first_name, st.employee_code",
};
