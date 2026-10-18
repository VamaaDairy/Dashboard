import { MessageSquare } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * SMS Automation (Recibo route `communicationCredit`).
 *
 * Spec columns: 12; built: 7.
 * Left out (buttons, or no matching data column):
 *   - Credit Balance (creditBalance)
 *   - Debited Date (debitedDate)
 *   - Debit Count (debitCount)
 *   - Message Type (messageType)
 *   - Staff (staff.firstName)
 */
export const communicationCredit: MasterDef = {
  slug: "communicationCredit",
  title: "SMS Automation",
  subtitle: "Message credits bought and when they were credited.",
  icon: MessageSquare,
  from: `fp_communication_credits m`,
  cols: [
    { key: "communicationType", label: "Communication Type", expr: "m.communication_type" },
    { key: "creditedDate", label: "Credited Date", expr: "m.credited_date", kind: "date" },
    { key: "creditCount", label: "Credit Count", expr: "m.credit_count", kind: "num" },
    { key: "paymentDate", label: "Payment Date", expr: "m.payment_date", kind: "date" },
    { key: "amountPaid", label: "Amount Paid", expr: "m.amount_paid", kind: "money" },
    { key: "remarks", label: "Remarks", expr: "m.additional_info #>> '{remarks}'" },
    { key: "paymentMode", label: "Payment Mode", expr: "m.payment_mode" },
  ],
  search: ["m.communication_type"],
  filters: [
    { key: "type", label: "Type", expr: "m.communication_type" },
  ],
  order: "m.payment_date desc nulls last, m.created_at desc",
};
