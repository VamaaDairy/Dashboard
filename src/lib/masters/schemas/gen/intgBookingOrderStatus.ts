import { RefreshCw } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Integration Booking Order Status (Recibo route `intgBookingOrderStatus`).
 *
 * Spec columns: 8; built: 8.
 */
export const intgBookingOrderStatus: MasterDef = {
  slug: "intgBookingOrderStatus",
  title: "Integration Booking Order Status",
  subtitle: "Booking orders sent to the ERP and whether each one synced.",
  icon: RefreshCw,
  from: `fp_crons_jobs_order m`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.booking_time desc nulls last)", kind: "num" },
    { key: "orderId", label: "Order ID", expr: "m.order_id", kind: "mono" },
    { key: "date", label: "Date", expr: "m.booking_time" },
    { key: "items", label: "Items", expr: "m.total_item", kind: "num" },
    { key: "quantity", label: "Quantity", expr: "m.total_quantity", kind: "num" },
    { key: "synced", label: "Synced", expr: "m.synced", kind: "num" },
    { key: "syncedForStatus", label: "Synced for Status", expr: "m.syncedforstatus", kind: "num" },
    { key: "syncRemarks", label: "Sync Remarks", expr: "m.remark" },
  ],
  search: ["m.order_id"],
  filters: [
    { key: "synced", label: "Synced", expr: "m.synced" },
  ],
  order: "m.booking_time desc nulls last",
};
