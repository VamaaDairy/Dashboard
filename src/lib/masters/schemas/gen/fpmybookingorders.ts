import { ShoppingBag } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Purchase Orders (Recibo route `fpmybookingorders`).
 *
 * Spec columns: 11; built: 11.
 * Purchase orders = orders whose buyer is at distributor level or above (not defined in the spec).
 */
export const fpmybookingorders: MasterDef = {
  slug: "fpmybookingorders",
  title: "Purchase Orders",
  subtitle: "Orders booked by distributors and stockists to the company.",
  icon: ShoppingBag,
  from: `fp_booking_order m
    left join fp_firm j1 on j1.uid = m.from_firm_uid
    left join fp_staff j2 on j2.uid = m.staff_uid
    left join fp_firm j3 on j3.uid = m.to_firm_uid
    left join fp_channel j4 on j4.uid = j1.channel_uid`,
  baseWhere: "j4.level <= 3",
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.booking_time desc)", kind: "num" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "date", label: "Date", expr: "m.booking_time", kind: "date" },
    { key: "from", label: "From", expr: "j1.name" },
    { key: "valueDp", label: "Value (DP)", expr: "m.dealer_cost", kind: "money" },
    { key: "items", label: "Items", expr: "m.total_item", kind: "num" },
    { key: "qty", label: "Qty.", expr: "m.total_quantity", kind: "num" },
    { key: "invoiceQty", label: "Invoice Qty.", expr: "m.invoice_quantity", kind: "num" },
    { key: "cancelledQty", label: "Cancelled Qty.", expr: "m.cancelled_quantity", kind: "num" },
    { key: "bookedBy", label: "Booked By", expr: "j2.first_name" },
    { key: "to", label: "To", expr: "j3.name" },
  ],
  search: ["m.order_id", "j1.name", "j3.name"],
  order: "m.booking_time desc",
};
