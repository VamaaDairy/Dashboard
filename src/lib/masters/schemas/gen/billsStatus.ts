import { RefreshCw } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Bills Status (Recibo route `billsStatus`).
 *
 * Spec columns: 10; built: 9.
 * Left out (buttons, or no matching data column):
 *   - Action (button)
 */
export const billsStatus: MasterDef = {
  slug: "billsStatus",
  title: "Bills Status",
  subtitle: "Invoices sent to the ERP and whether each one synced.",
  icon: RefreshCw,
  from: `fp_crons_jobs_bill m`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "invoiceDate", label: "Invoice Date", expr: "m.invoice_date", kind: "mono" },
    { key: "deliveryDate", label: "Delivery Date", expr: "m.delivery_date" },
    { key: "invoiceNo", label: "Invoice No", expr: "m.invoice_number", kind: "mono" },
    { key: "uniqueRefNo", label: "Unique Ref No", expr: "m.uniquereferenceno", kind: "mono" },
    { key: "payNotRequired", label: "Pay Not Required", expr: "m.pay_not_required", kind: "num" },
    { key: "billType", label: "Bill Type", expr: "m.bill_type" },
    { key: "invoiceCost", label: "Invoice Cost", expr: "m.invoice_cost", kind: "money" },
    { key: "syncRemarks", label: "Sync Remarks", expr: "m.remark" },
  ],
  search: ["m.invoice_number", "m.uniquereferenceno"],
  filters: [
    { key: "synced", label: "Synced", expr: "m.synced" },
  ],
  order: "m.created_at desc",
};
