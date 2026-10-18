import { MapPin } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Customer Map (Recibo route `customerLocation`).
 *
 * Spec columns: 12; built: 12.
 */
export const customerLocation: MasterDef = {
  slug: "customerLocation",
  title: "Customer Map",
  subtitle: "Customers with their sales contact and address. The map itself is not built.",
  icon: MapPin,
  from: `fp_firm m
    left join fp_staff j1 on j1.uid = m.sales_contact_uid
    left join fp_channel j2 on j2.uid = m.channel_uid`,
  cols: [
    { key: "employeeName", label: "Employee Name", expr: "j1.first_name" },
    { key: "firmName", label: "Firm Name", expr: "m.name" },
    { key: "state", label: "State", expr: "m.state_state" },
    { key: "phone", label: "Phone", expr: "m.phone", kind: "mono" },
    { key: "city", label: "City", expr: "m.city" },
    { key: "firmCode", label: "Firm Code", expr: "m.firm_code", kind: "mono" },
    { key: "gstin", label: "gstin", expr: "m.gstin", kind: "mono" },
    { key: "place", label: "Place", expr: "m.place" },
    { key: "pincode", label: "Pincode", expr: "m.pincode", kind: "mono" },
    { key: "address", label: "Address", expr: "m.address" },
    { key: "eMail", label: "E-mail", expr: "m.email" },
    { key: "status", label: "Status", expr: "case when m.active = 1 then 'Active' else 'Inactive' end", kind: "status" },
  ],
  search: ["m.name", "m.firm_code", "m.phone", "m.city"],
  filters: [
    { key: "state", label: "State", expr: "m.state_state" },
    { key: "channel", label: "Channel", expr: "j2.channel" },
    { key: "branch", label: "Branch", expr: "j1.team_team" },
    { key: "status", label: "Status", expr: "m.active" },
  ],
  order: "m.name",
};
