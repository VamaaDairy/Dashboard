import { RefreshCw } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Pre Sale Stock Status (Recibo route `preSaleSRSync`).
 *
 * Spec columns: 10; built: 9.
 * Left out (buttons, or no matching data column):
 *   - Action (button)
 * Pre-sale vs van-sale is not defined in the spec: a request made to an employee (van) is a van sale, any other is pre-sale.
 */
export const preSaleSRSync: MasterDef = {
  slug: "preSaleSRSync",
  title: "Pre Sale Stock Status",
  subtitle: "Stock requests made to a distributor and whether each one synced.",
  icon: RefreshCw,
  from: `fp_stock_request m
    left join fp_firm j1 on j1.uid = m.from_firm_uid
    left join fp_firm j2 on j2.uid = m.to_firm_uid
    left join fp_warehouse j3 on j3.uid = m.from_warehouse_uid`,
  baseWhere: "m.to_staff_uid is null",
  dateRange: { expr: "m.created_at", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.request_time desc nulls last)", kind: "num" },
    { key: "reqNo", label: "Req.No", expr: "m.requisition_number", kind: "num" },
    { key: "date", label: "Date", expr: "m.request_time" },
    { key: "items", label: "Items", expr: "m.total_items", kind: "num" },
    { key: "fromFirm", label: "From Firm", expr: "j1.name" },
    { key: "toFirm", label: "To Firm", expr: "j2.name" },
    { key: "fromWarehouse", label: "From Warehouse", expr: "j3.name" },
    { key: "toWarehouse", label: "To Warehouse", expr: "j1.to_warehouse" },
    { key: "binLocation", label: "Bin Location", expr: "j1.bin_location" },
  ],
  search: ["m.requisition_number"],
  order: "m.request_time desc nulls last",
};
