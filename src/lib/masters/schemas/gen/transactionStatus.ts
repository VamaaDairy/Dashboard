import { RefreshCw } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Transaction Status (Recibo route `transactionStatus`).
 *
 * Spec columns: 10; built: 9.
 * Left out (buttons, or no matching data column):
 *   - Action (button)
 */
export const transactionStatus: MasterDef = {
  slug: "transactionStatus",
  title: "Transaction Status",
  subtitle: "Transactions received from the ERP and whether each one synced.",
  icon: RefreshCw,
  from: `fp_crons_jobs_transaction m`,
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "transactionId", label: "Transaction ID", expr: "m.transaction_id", kind: "mono" },
    { key: "transactionDate", label: "Transaction Date", expr: "m.transaction_date" },
    { key: "items", label: "Items", expr: "m.total_items", kind: "num" },
    { key: "vanCode", label: "Van Code", expr: "m.customer_code", kind: "mono" },
    { key: "lpoNumber", label: "Lpo Number", expr: "m.lpo_number", kind: "mono" },
    { key: "notes", label: "Notes", expr: "m.notes" },
    { key: "syncRemarks", label: "Sync Remarks", expr: "m.remark" },
    { key: "responseMessage", label: "Response Message", expr: "m.remark" },
  ],
  search: ["m.transaction_id", "m.customer_code", "m.lpo_number"],
  filters: [
    { key: "synced", label: "Synced", expr: "m.synced" },
  ],
  order: "m.created_at desc",
};
