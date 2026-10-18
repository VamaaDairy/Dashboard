import { Percent } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * State Channel Margin (Recibo route `stateChannelMargin`).
 *
 * Spec columns: 6; built: 6.
 */
export const stateChannelMargin: MasterDef = {
  slug: "stateChannelMargin",
  title: "State Channel Margin",
  subtitle: "Margin by state and channel, with the dates it applies.",
  icon: Percent,
  from: `fp_state_channel_margin m
    left join fp_state j1 on j1.state = m.state_state
    left join fp_channel j2 on j2.uid = m.channel_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.from_date desc, m.created_at desc)", kind: "num" },
    { key: "state", label: "State", expr: "j1.state" },
    { key: "channel", label: "Channel", expr: "j2.channel" },
    { key: "margin", label: "Margin", expr: "m.margin" },
    { key: "fromDate", label: "From Date", expr: "m.from_date" },
    { key: "toDate", label: "To Date", expr: "m.to_date" },
  ],
  search: ["j1.state", "j2.channel"],
  filters: [
    { key: "channel", label: "Channel", expr: "j2.channel" },
    { key: "state", label: "State", expr: "m.state_state" },
  ],
  order: "m.from_date desc, m.created_at desc",
};
