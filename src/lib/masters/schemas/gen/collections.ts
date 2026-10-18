import { Wallet } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Payment Management (Recibo route `collections`).
 *
 * Spec columns: 10; built: 10.
 */
export const collections: MasterDef = {
  slug: "collections",
  title: "Payment Management",
  subtitle: "Invoices with the amount paid, what is still due and how old the due is.",
  icon: Wallet,
  from: `fp_bill m
    left join fp_firm j1 on j1.uid = m.to_firm_uid
    left join fp_channel j2 on j2.uid = j1.channel_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "invoiceNumber", label: "Invoice Number", expr: "m.invoice_number", kind: "mono" },
    { key: "reference", label: "Reference", expr: "m.reference" },
    { key: "invoiceDate", label: "Invoice Date", expr: "m.invoice_date", kind: "date" },
    { key: "toFirm", label: "To Firm", expr: "j1.name" },
    { key: "invoiceCost", label: "Invoice cost", expr: "m.invoice_cost", kind: "money" },
    { key: "amountPaid", label: "Amount Paid", expr: "m.total_amount_paid", kind: "money" },
    { key: "dueAmount", label: "Due Amount", expr: "m.current_due", kind: "money" },
    { key: "lastPaymentDate", label: "Last Payment Date", expr: "m.last_payment_date", kind: "date" },
    { key: "dueAge", label: "Due Age", expr: "m.due_age", kind: "num" },
    { key: "dueAgeSinceLastPayment", label: "Due Age Since Last Payment", expr: "m.due_age_since_last_payment", kind: "num" },
  ],
  search: ["m.invoice_number", "m.reference", "j1.name"],
  filters: [
    { key: "channel", label: "Channel", expr: "j2.channel" },
  ],
  order: "m.created_at desc",
};
