import { LifeBuoy } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Service Management (Recibo route `serviceManagementView`).
 *
 * Spec columns: 12; built: 11.
 * Left out (buttons, or no matching data column):
 *   - Assignees (spec maps it to the wrong field)
 */
export const serviceManagementView: MasterDef = {
  slug: "serviceManagementView",
  title: "Service Management",
  subtitle: "Service tickets raised for customers, with status, priority and who raised them.",
  icon: LifeBuoy,
  from: `fp_ticket m
    left join fp_staff j1 on j1.uid = m.created_staff_uid
    left join fp_firm j2 on j2.uid = m.customer_uid
    left join fp_ticket_type j3 on j3.uid = m.ticket_type_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_date desc nulls last, m.created_at desc)", kind: "num" },
    { key: "ticketNo", label: "Ticket No", expr: "m.ticket_no", kind: "mono" },
    { key: "name", label: "Name", expr: "m.name" },
    { key: "createdDate", label: "Created Date", expr: "m.created_date", kind: "date" },
    { key: "createdFrom", label: "Created From", expr: "m.created_from" },
    { key: "from", label: "From", expr: "m.created_from" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "priority", label: "Priority", expr: "m.priority" },
    { key: "createdStaff", label: "Created staff", expr: "j1.first_name" },
    { key: "customerName", label: "Customer Name", expr: "j2.name" },
    { key: "ticketType", label: "Ticket Type", expr: "j3.name" },
  ],
  search: ["m.ticket_no", "m.name", "j2.name"],
  filters: [
    { key: "status", label: "Status", expr: "m.status" },
    { key: "priority", label: "Priority", expr: "m.priority" },
    { key: "tickettype", label: "Ticket type", expr: "j3.name" },
  ],
  order: "m.created_date desc nulls last, m.created_at desc",
};
