import { Wallet } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Expense Management (Recibo route `expenses`).
 *
 * Spec columns: 14; built: 10.
 * Left out (buttons, or no matching data column):
 *   - Approved/Rejected Date (date)
 *   - Approval Reason (approvalReason)
 *   - Rejection Reason (rejectionReason)
 *   - Action (button)
 */
export const expenses: MasterDef = {
  slug: "expenses",
  title: "Expense Management",
  subtitle: "Expense claims by employee, with type, amount, approval level and status.",
  icon: Wallet,
  from: `fp_expense m
    left join fp_expense_type j1 on j1.uid = m.expense_type_uid
    left join fp_staff j2 on j2.uid = m.staff_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "date", label: "Date", expr: "m.expense_date", kind: "date" },
    { key: "expenseType", label: "Expense Type", expr: "j1.type" },
    { key: "createdType", label: "Created Type", expr: "m.created_type" },
    { key: "totalAmount", label: "Total Amount", expr: "m.requested_amount", kind: "money" },
    { key: "amount", label: "Amount", expr: "m.amount", kind: "money" },
    { key: "currentLevel", label: "Current Level", expr: "m.current_approval_level", kind: "num" },
    { key: "description", label: "Description", expr: "m.description" },
    { key: "expenseSubmissionDate", label: "Expense Submission Date", expr: "m.created_at", kind: "date" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "staffName", label: "Staff Name", expr: "j2.first_name" },
  ],
  search: ["j2.first_name", "j2.employee_code", "m.expense_id"],
  filters: [
    { key: "status", label: "Status", expr: "m.status" },
    { key: "expensetype", label: "Expense type", expr: "j1.type" },
  ],
  order: "m.created_at desc",
};
