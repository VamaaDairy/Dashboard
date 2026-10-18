import { Contact } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * My Customer (Recibo route `myCustomer`).
 *
 * Spec columns: 7; built: 7.
 */
export const myCustomer: MasterDef = {
  slug: "myCustomer",
  title: "My Customer",
  subtitle: "Customers with state, channel, contact and status.",
  icon: Contact,
  from: `fp_firm m
    left join fp_state j1 on j1.state = m.state_state
    left join fp_channel j2 on j2.uid = m.channel_uid`,
  cols: [
    { key: "state", label: "State", expr: "j1.state" },
    { key: "channel", label: "Channel", expr: "j2.channel" },
    { key: "customerCode", label: "Customer Code", expr: "m.firm_code", kind: "mono" },
    { key: "customerName", label: "Customer Name", expr: "m.name" },
    { key: "phone", label: "Phone", expr: "m.phone", kind: "mono" },
    { key: "address", label: "Address", expr: "m.address" },
    { key: "status", label: "Status", expr: "case when m.active = 1 then 'Active' else 'Inactive' end", kind: "status" },
  ],
  search: ["m.name", "m.firm_code", "m.phone"],
  filters: [
    { key: "state", label: "State", expr: "m.state_state" },
    { key: "channel", label: "Channel", expr: "j2.channel" },
    { key: "status", label: "Status", expr: "m.active" },
  ],
  order: "m.name",
};
