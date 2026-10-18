import { ReceiptText } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Credit Note (Recibo route `creditNote`).
 *
 * Spec columns: 10; built: 10.
 */
export const creditNote: MasterDef = {
  slug: "creditNote",
  title: "Credit Note",
  subtitle: "Credit notes between firms, with how much has been redeemed.",
  icon: ReceiptText,
  from: `fp_credit_note m
    left join fp_firm j1 on j1.uid = m.to_firm_uid
    left join fp_firm j2 on j2.uid = m.from_firm_uid`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "date", label: "Date", expr: "m.date", kind: "date" },
    { key: "creditNoteNo", label: "Credit Note No", expr: "m.credit_note_no", kind: "mono" },
    { key: "tofirmName", label: "ToFirm Name", expr: "j1.name" },
    { key: "fromfirmName", label: "FromFirm Name", expr: "j2.name" },
    { key: "creditNoteValue", label: "Credit Note Value", expr: "m.credit_note_value", kind: "money" },
    { key: "redeemedValue", label: "Redeemed Value", expr: "m.redeemed", kind: "money" },
    { key: "billNo", label: "Bill No", expr: "m.bill_no", kind: "mono" },
    { key: "refNo", label: "Ref No", expr: "m.ref_no", kind: "mono" },
    { key: "status", label: "Status", expr: "case when m.status = 1 then 'Active' else 'Inactive' end", kind: "status" },
    { key: "remainingCreditNoteValue", label: "Remaining Credit Note Value", expr: "m.credit_note_value - coalesce(m.redeemed, 0)", kind: "money" },
  ],
  search: ["m.credit_note_no", "m.bill_no", "m.ref_no", "j1.name", "j2.name"],
  filters: [
    { key: "status", label: "Status", expr: "m.status" },
  ],
  order: "m.created_at desc",
};
