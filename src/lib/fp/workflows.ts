import { query, tx } from "@/lib/db";
import { insertRow } from "./insert";
import type { RowAction } from "./rowActions";

/** Approval workflows on the people / customer side: leave, expenses, unmap requests, new customers, face re-registration, display audits, tickets. */
const reason = (i: { reason?: string }) => {
  const r = (i.reason ?? "").trim();
  if (!r) throw new Error("Give a reason");
  return r;
};

/** The employee recorded as having taken an approval decision: the portal's full-access employee (the portal user is not an employee row). */
const approver = async (db: { query: (t: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }) => {
  const r = (await db.query(`select s.uid from fp_staff s join fp_designation d on d.uid = s.designation_uid where s.active = 1 order by d.full_access desc, s.created_at limit 1`)).rows[0];
  if (!r) throw new Error("There is no employee to record the decision against");
  return String(r.uid);
};

const LEAVE: RowAction[] = [
  {
    id: "approve", label: "Approve", ask: "none", whenStatus: ["Pending"],
    run: (id) => tx(async (db) => {
      await db.query(`update fp_staff_leave set status = 'Approved', updated_at = now() where uid = $1 and status = 'Pending'`, [id]);
      await insertRow(db, "staffLeaveApproval", { staffLeaveUid: id, status: "Approved", approveTime: new Date(), approverUid: await approver(db) });
    }),
  },
  {
    id: "reject", label: "Reject", ask: "reason", tone: "danger", whenStatus: ["Pending"],
    run: (id, i) => tx(async (db) => {
      const r = reason(i);
      await db.query(`update fp_staff_leave set status = 'Rejected', remark = $2, updated_at = now() where uid = $1 and status = 'Pending'`, [id, r]);
      await insertRow(db, "staffLeaveApproval", { staffLeaveUid: id, status: "Rejected", approveTime: new Date(), remarks: r, approverUid: await approver(db) });
    }),
  },
  {
    id: "cancel", label: "Cancel leave", ask: "reason", tone: "danger", whenStatus: ["Pending", "Approved"],
    run: async (id, i) => { await query(`update fp_staff_leave set status = 'Cancelled', remark = $2, updated_at = now() where uid = $1`, [id, reason(i)]); },
  },
];

const EXPENSE: RowAction[] = [
  {
    id: "approve", label: "Approve", ask: "none", whenStatus: ["Pending"],
    run: (id) => tx(async (db) => {
      await db.query(`update fp_expense set status = 'Approved', updated_at = now() where uid = $1 and status = 'Pending'`, [id]);
      await insertRow(db, "expenseApproval", { expenseUid: id, status: "Approved", date: new Date(), approvalReason: "Approved", staffUid: await approver(db) });
    }),
  },
  {
    id: "reject", label: "Reject", ask: "reason", tone: "danger", whenStatus: ["Pending"],
    run: (id, i) => tx(async (db) => {
      const r = reason(i);
      await db.query(`update fp_expense set status = 'Rejected', updated_at = now() where uid = $1 and status = 'Pending'`, [id]);
      await insertRow(db, "expenseApproval", { expenseUid: id, status: "Rejected", date: new Date(), rejectionReason: r, staffUid: await approver(db) });
    }),
  },
];

export const WORKFLOW_ACTIONS: Record<string, RowAction[]> = {
  leave: LEAVE,
  expenses: EXPENSE,
  customerUnmapApproval: [
    {
      id: "approve", label: "Approve", ask: "none", whenStatus: ["Pending"],
      run: (id) => tx(async (db) => {
        const r = (await db.query(`update fp_customer_unmap_request set status = 'Approved', updated_at = now() where uid = $1 and status = 'Pending' returning staff_uid, firm_uid`, [id])).rows[0] as { staff_uid: string; firm_uid: string } | undefined;
        if (r) await db.query(`update fp_staff_firm_reporting set active = 0, end_date = now(), is_customer_unmap_requested = 0, updated_at = now() where staff_uid = $1 and firm_uid = $2`, [r.staff_uid, r.firm_uid]);
      }),
    },
    {
      id: "reject", label: "Reject", ask: "reason", tone: "danger", whenStatus: ["Pending"],
      run: async (id, i) => { await query(`update fp_customer_unmap_request set status = 'Rejected', reject_remark = $2, updated_at = now() where uid = $1 and status = 'Pending'`, [id, reason(i)]); },
    },
  ],
  customerApproval: [
    { id: "approve", label: "Approve", ask: "none", whenStatus: ["pending"], run: async (id) => { await query(`update fp_firm set active = 1, new_customer = 0, approved_by = '{"by":"portal"}'::jsonb, updated_at = now() where uid = $1`, [id]); } },
    { id: "reject", label: "Reject", ask: "reason", tone: "danger", whenStatus: ["pending"], run: async (id, i) => { await query(`update fp_firm set active = 0, new_customer = 0, remark = $2, updated_at = now() where uid = $1`, [id, reason(i)]); } },
    { id: "reopen", label: "Reopen", ask: "none", whenStatus: ["rejected"], run: async (id) => { await query(`update fp_firm set active = 1, new_customer = 1, is_reopen = 1, updated_at = now() where uid = $1`, [id]); } },
  ],
  employeefaceregistration: [
    { id: "approve", label: "Approve", ask: "none", whenStatus: ["Pending"], run: async (id) => { await query(`update fp_staff_face set re_reg_approved = true, re_reg_requested = false, updated_at = now() where uid = $1`, [id]); } },
    { id: "reject", label: "Reject", ask: "none", tone: "danger", whenStatus: ["Pending"], run: async (id) => { await query(`update fp_staff_face set re_reg_approved = false, re_reg_requested = false, updated_at = now() where uid = $1`, [id]); } },
  ],
  displayAudit: [
    { id: "approve", label: "Approve", ask: "none", whenStatus: ["Pending"], run: async (id) => { await query(`update fp_display_audit set status = 'Approved', updated_at = now() where uid = $1`, [id]); } },
    { id: "reject", label: "Reject", ask: "reason", tone: "danger", whenStatus: ["Pending"], run: async (id, i) => { reason(i); await query(`update fp_display_audit set status = 'Rejected', updated_at = now() where uid = $1`, [id]); } },
  ],
  serviceManagementView: [
    { id: "start", label: "Start", ask: "none", whenStatus: ["Open"], run: async (id) => { await query(`update fp_ticket set status = 'In Progress', updated_at = now() where uid = $1`, [id]); } },
    {
      id: "resolve", label: "Resolve", ask: "reason", whenStatus: ["Open", "In Progress"],
      run: (id, i) => tx(async (db) => {
        const r = reason(i);
        await db.query(`update fp_ticket set status = 'Resolved', updated_at = now() where uid = $1`, [id]);
        await insertRow(db, "ticketRemark", { ticketUid: id, description: r, remarkTime: new Date(), staffUid: await approver(db) });
      }),
    },
    { id: "close", label: "Close", ask: "none", whenStatus: ["Resolved"], run: async (id) => { await query(`update fp_ticket set status = 'Closed', updated_at = now() where uid = $1`, [id]); } },
  ],
  attendance: [
    { id: "relogin", label: "Approve re-login", ask: "none", whenStatus: ["pending-relogin"], run: async (id) => { await query(`update fp_staff_attendance set re_login_approval = 1, updated_at = now() where uid = $1`, [id]); } },
  ],
};
