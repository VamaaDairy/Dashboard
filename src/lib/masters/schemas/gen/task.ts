import { ListChecks } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Task Management (Recibo route `task`).
 *
 * Spec columns: 19; built: 14.
 * Left out (buttons, or no matching data column):
 *   - Staff (status)
 *   - status (status)
 *   - Start Time (status)
 *   - End Time (endTime)
 *   - Cancel Reason (cancelReason)
 */
export const task: MasterDef = {
  slug: "task",
  title: "Task Management",
  subtitle: "Tasks assigned to the field force, with their dates and approval state.",
  icon: ListChecks,
  from: `fp_task m
    left join fp_firm j1 on j1.uid = m.firm_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "name", label: "Name", expr: "m.task_name" },
    { key: "prefix", label: "Prefix", expr: "m.prefix" },
    { key: "taskId", label: "Task ID", expr: "m.task_id", kind: "num" },
    { key: "description", label: "Description", expr: "m.description" },
    { key: "startDate", label: "Start Date", expr: "m.from_date", kind: "date" },
    { key: "endDate", label: "End Date", expr: "m.to_date", kind: "date" },
    { key: "type", label: "Type", expr: "m.task_type_uid" },
    { key: "customer", label: "Customer", expr: "j1.name" },
    { key: "approvalRequired", label: "Approval Required", expr: "m.require_approval", kind: "num" },
    { key: "multiApproval", label: "Multi Approval", expr: "m.multi_approval", kind: "num" },
    { key: "approved", label: "Approved", expr: "m.approved", kind: "num" },
    { key: "approvedBy", label: "Approved By", expr: "nullif(m.approval_log::text, 'null')" },
    { key: "assignedStaffs", label: "Assigned Staffs", expr: "nullif(m.assigned_staff_uids::text, 'null')" },
  ],
  search: ["m.task_name", "m.task_id"],
  filters: [
    { key: "status", label: "Status", expr: "m.active" },
  ],
  order: "m.created_at desc",
};
