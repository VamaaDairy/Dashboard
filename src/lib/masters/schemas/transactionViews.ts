import { Receipt } from "lucide-react";
import type { MasterDef } from "../types";

/**
 * Sales invoice lists (Recibo routes `fpsecondarysalesview`, `fpsalesview`,
 * `fpsalesreturnview`: one component, `footprints-fp-transactionview`).
 * The spec's data columns in its order, with the Date, Status, Return and
 * Input Mode filters. One row per invoice.
 *
 * Not built: the View / Print / Modify / Cancel buttons and the bulk actions
 * (Accept All, Print Multiple, Excel Sales Return) - they need the invoice
 * documents and workflows, not just a list.
 *
 * What separates the three isn't in the spec. Taken here as: invoices are
 * transactions that are not returns; Primary = sold to distributor level and
 * above, Secondary = sold below it; Sales Return = transactions with a return type
 * where either side is below distributor level (the customer sends goods back, so
 * it can be the "from" side).
 */
const FROM = `fp_transaction t
    left join fp_firm ff on ff.uid = t.from_firm_uid
    left join fp_firm tf on tf.uid = t.to_firm_uid
    left join fp_channel tc on tc.uid = tf.channel_uid
    left join fp_channel fc on fc.uid = ff.channel_uid`;

const COLS: MasterDef["cols"] = [
  { key: "no", label: "No", expr: "row_number() over (order by coalesce(t.transaction_time, t.created_at) desc, t.voucher_number)", kind: "num" },
  { key: "date", label: "Date", expr: "t.voucher_time", kind: "mono" },
  { key: "voucherNo", label: "Voucher No", expr: "t.voucher_number", kind: "mono" },
  { key: "reference", label: "Reference", expr: "t.reference" },
  { key: "from", label: "From", expr: "ff.name" },
  { key: "to", label: "To", expr: "tf.name" },
  { key: "items", label: "Items", expr: "t.total_items", kind: "num" },
  { key: "qty", label: "Qty.", expr: "t.total_quantity", kind: "num" },
  { key: "cost", label: "Cost", expr: "t.total_cost", kind: "money" },
  { key: "acceptedQty", label: "Accepted Qty", expr: "t.accepted_qty", kind: "num" },
  { key: "acceptRemark", label: "Accept Remark", expr: "t.accept_remark" },
  { key: "rejection", label: "Rejection Remark", expr: "t.rejection_reason" },
  { key: "status", label: "Status", expr: "t.status" },
  { key: "inputMode", label: "Input Mode", expr: "t.input_mode" },
  { key: "returnType", label: "Return Type", expr: "t.return_type" },
  { key: "returnReason", label: "Return Reason", expr: "t.return_reason" },
];

const view = (slug: string, title: string, subtitle: string, baseWhere: string): MasterDef => ({
  slug,
  title,
  subtitle,
  icon: Receipt,
  from: FROM,
  baseWhere,
  dateRange: { expr: "coalesce(t.transaction_time, t.created_at)", days: 30 },
  emptyNote: "No invoices in this period.",
  cols: COLS,
  search: ["t.voucher_number", "t.reference", "ff.name", "tf.name"],
  filters: [
    { key: "status", label: "Status", expr: "t.status" },
    { key: "return", label: "Return", expr: "t.return_type" },
    { key: "mode", label: "Input mode", expr: "t.input_mode" },
  ],
  order: "coalesce(t.transaction_time, t.created_at) desc, t.voucher_number",
});

export const secondarySalesView = view(
  "fpsecondarysalesview",
  "Secondary Sales",
  "Invoices raised to retailers and other customers below the distributor level.",
  "t.return_type is null and (tc.level is null or tc.level >= 4)",
);
export const primarySalesView = view(
  "fpsalesview",
  "Primary Sales",
  "Invoices raised to distributors and stockists.",
  "t.return_type is null and tc.level <= 3",
);
export const salesReturnView = view(
  "fpsalesreturnview",
  "Sales Return",
  "Returns taken back from customers below the distributor level.",
  "t.return_type is not null and (tc.level is null or tc.level >= 4 or fc.level >= 4)",
);
