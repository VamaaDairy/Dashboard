import { Target } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Customer Target (Recibo route `customerTarget`).
 *
 * Spec columns: 26; built: 22.
 * Left out (buttons, or no matching data column):
 *   - Balance Value (None)
 *   - Balance Volume (None)
 *   - Channel (channel.channel)
 *   - Chain (chainChain)
 */
export const customerTarget: MasterDef = {
  slug: "customerTarget",
  title: "Customer Target",
  subtitle: "Sales targets set for customers, with what has been achieved.",
  icon: Target,
  from: `fp_customer_target m
    left join fp_firm j1 on j1.uid = m.firm_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.start_date desc, m.created_at desc)", kind: "num" },
    { key: "customer", label: "Customer", expr: "j1.name" },
    { key: "customerCode", label: "Customer Code", expr: "j1.firm_code", kind: "mono" },
    { key: "skuCode", label: "SKU Code", expr: "m.sku_code", kind: "mono" },
    { key: "customField", label: "Custom Field", expr: "nullif(m.custom_field::text, 'null')" },
    { key: "brand", label: "Brand", expr: "m.brand" },
    { key: "superBrand", label: "Super Brand", expr: "nullif(m.super_brands::text, 'null')" },
    { key: "category", label: "Category", expr: "nullif(m.categories::text, 'null')" },
    { key: "subCategory", label: "Sub Category", expr: "nullif(m.sub_categories::text, 'null')" },
    { key: "targetType", label: "Target Type", expr: "m.target_type", kind: "num" },
    { key: "valueTarget", label: "Value Target", expr: "m.value_target", kind: "money" },
    { key: "valueAchieved", label: "Value Achieved", expr: "m.achieved_value_target", kind: "money" },
    { key: "percentageValueAchieved", label: "Percentage Value Achieved", expr: "m.achieved_value_target", kind: "money" },
    { key: "volumeTarget", label: "Volume Target", expr: "m.volume_target", kind: "num" },
    { key: "volumeAchieved", label: "Volume Achieved", expr: "m.achieved_volume_target", kind: "num" },
    { key: "percentageVolumeAchieved", label: "Percentage Volume Achieved", expr: "m.achieved_volume_target", kind: "num" },
    { key: "region", label: "Region", expr: "m.region" },
    { key: "achievementConsideration", label: "Achievement Consideration", expr: "m.achievement_consideration" },
    { key: "unitType", label: "Unit Type", expr: "m.unit_type", kind: "num" },
    { key: "startDate", label: "Start Date", expr: "m.start_date" },
    { key: "endDate", label: "End Date", expr: "m.end_date" },
    { key: "state", label: "State", expr: "m.state_state" },
  ],
  search: ["j1.name", "j1.firm_code", "m.sku_code"],
  filters: [
    { key: "targettype", label: "Target type", expr: "m.target_type" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "state", label: "State", expr: "j1.state_state" },
  ],
  order: "m.start_date desc, m.created_at desc",
};
