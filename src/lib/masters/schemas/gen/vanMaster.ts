import { Truck } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Van Master (Recibo route `vanMaster`).
 *
 * Spec columns: 11; built: 11.
 */
export const vanMaster: MasterDef = {
  slug: "vanMaster",
  title: "Van Master",
  subtitle: "Vans with their bin location, branch and codes.",
  icon: Truck,
  from: `fp_van_master m`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.van_name)", kind: "num" },
    { key: "vanName", label: "Van Name", expr: "m.van_name" },
    { key: "vanCode", label: "Van Code", expr: "m.van_code", kind: "mono" },
    { key: "binLocation", label: "Bin Location", expr: "m.bin_location" },
    { key: "binDescription", label: "Bin Description", expr: "m.bin_description" },
    { key: "branch", label: "Branch", expr: "m.branch" },
    { key: "vanMasterCode", label: "Van Master Code", expr: "m.van_master_code", kind: "mono" },
    { key: "arInvoiceCode", label: "Ar Invoice Code", expr: "m.ar_invoice_code", kind: "mono" },
    { key: "discountPercentage", label: "Discount Percentage", expr: "m.discount_percentage", kind: "num" },
    { key: "status", label: "Status", expr: "case when m.active = 1 then 'Active' else 'Inactive' end", kind: "status" },
    { key: "kraIpAddress", label: "KRA IP Address", expr: "m.kra_ip_address" },
  ],
  search: ["m.van_name", "m.van_code"],
  filters: [
    { key: "status", label: "Status", expr: "m.active" },
  ],
  order: "m.van_name",
};
