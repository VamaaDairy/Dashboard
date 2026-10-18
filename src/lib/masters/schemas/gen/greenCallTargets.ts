import { PhoneCall } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Green Call Target (Recibo route `greenCallTargets`).
 *
 * Spec columns: 12; built: 11.
 * Left out (buttons, or no matching data column):
 *   - BRAND (BRAND)
 */
export const greenCallTargets: MasterDef = {
  slug: "greenCallTargets",
  title: "Green Call Target",
  subtitle: "Targets that make a visit count as a green (productive) call.",
  icon: PhoneCall,
  from: `fp_green_call_target m`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "billValueTarget", label: "Bill Value Target", expr: "m.value_target", kind: "money" },
    { key: "quantityVolumeTarget", label: "Quantity Volume Target", expr: "m.quantity_volume_target", kind: "num" },
    { key: "numberOfProduct", label: "Number Of Product", expr: "m.volume_target", kind: "num" },
    { key: "channels", label: "Channels", expr: "nullif(m.channels::text, 'null')" },
    { key: "types", label: "Types", expr: "nullif(m.channel_types::text, 'null')" },
    { key: "classes", label: "Classes", expr: "nullif(m.channel_classes::text, 'null')" },
    { key: "onMustSellSku", label: "On Must Sell SKU", expr: "m.on_must_sell_sku", kind: "num" },
    { key: "status", label: "Status", expr: "case when m.status = 1 then 'Active' else 'Inactive' end", kind: "status" },
    { key: "minimumQty", label: "Minimum Qty", expr: "m.min_qty", kind: "num" },
    { key: "condition", label: "Condition", expr: "m.operation", kind: "num" },
  ],
  search: ["m.channels"],
  filters: [
    { key: "status", label: "Status", expr: "m.status" },
  ],
  order: "m.created_at desc",
};
