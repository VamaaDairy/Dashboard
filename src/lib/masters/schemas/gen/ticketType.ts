import { Tags } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Ticket Type (Recibo route `ticketType`).
 *
 * Spec columns: 8; built: 6.
 * Left out (buttons, or no matching data column):
 *   - Task Name (taskName)
 *   - Photo (photo)
 */
export const ticketType: MasterDef = {
  slug: "ticketType",
  title: "Ticket Type",
  subtitle: "The kinds of service ticket that can be raised.",
  icon: Tags,
  from: `fp_ticket_type m
    left join fp_channel j1 on j1.uid = m.channel_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.name)", kind: "num" },
    { key: "ticketName", label: "Ticket Name", expr: "m.name" },
    { key: "description", label: "Description", expr: "m.description" },
    { key: "channel", label: "Channel", expr: "j1.channel" },
    { key: "categories", label: "Categories", expr: "m.categories" },
    { key: "status", label: "Status", expr: "case when m.active = 1 then 'Active' else 'Inactive' end", kind: "status" },
  ],
  search: ["m.name"],
  filters: [
    { key: "channel", label: "Channel", expr: "j1.channel" },
    { key: "status", label: "Status", expr: "m.active" },
  ],
  order: "m.name",
};
