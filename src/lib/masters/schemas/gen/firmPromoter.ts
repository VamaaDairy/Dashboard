import { UserCheck } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Promoter Management (Recibo route `firmPromoter`).
 *
 * Spec columns: 11; built: 11.
 */
export const firmPromoter: MasterDef = {
  slug: "firmPromoter",
  title: "Promoter Management",
  subtitle: "Promoters and the customers they are assigned to.",
  icon: UserCheck,
  from: `fp_firm_promoter m
    left join fp_staff j1 on j1.uid = m.promoter_uid
    left join fp_state j2 on j2.state = j1.state_state
    left join fp_staff j3 on j3.uid = j1.reporting_manager_uid
    left join fp_firm j4 on j4.uid = m.firm_uid
    left join fp_channel j5 on j5.uid = j4.channel_uid`,
  cols: [
    { key: "promoterName", label: "Promoter Name", expr: "j1.first_name" },
    { key: "phone", label: "Phone", expr: "j1.phone", kind: "mono" },
    { key: "state", label: "State", expr: "j2.state" },
    { key: "reportingManager", label: "Reporting Manager", expr: "j3.first_name" },
    { key: "reportingManagerPhone", label: "Reporting Manager Phone", expr: "j3.phone", kind: "mono" },
    { key: "customerName", label: "Customer Name", expr: "j4.name" },
    { key: "customerCode", label: "Customer Code", expr: "j4.firm_code", kind: "mono" },
    { key: "state2", label: "State", expr: "j4.state_state" },
    { key: "channel", label: "Channel", expr: "j5.channel" },
    { key: "phone2", label: "Phone", expr: "j4.phone", kind: "mono" },
    { key: "contactPerson", label: "Contact Person", expr: "j4.contact_person" },
  ],
  search: ["j1.first_name", "j4.name", "j4.firm_code"],
  filters: [
    { key: "channel", label: "Channel", expr: "j5.channel" },
    { key: "state", label: "State", expr: "j4.state_state" },
  ],
  order: "m.assigned_date desc",
};
