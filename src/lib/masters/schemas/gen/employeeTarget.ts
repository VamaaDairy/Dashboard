import { Target } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Employee Target (Recibo route `employeeTarget`).
 *
 * Spec columns: 29; built: 28.
 * Left out (buttons, or no matching data column):
 *   - Balance Value (None)
 */
export const employeeTarget: MasterDef = {
  slug: "employeeTarget",
  title: "Employee Target",
  subtitle: "Sales targets set for employees, with what has been achieved.",
  icon: Target,
  from: `fp_employee_target m
    left join fp_staff j1 on j1.uid = m.employee_uid
    left join fp_firm j2 on j2.uid = m.firm_uid
    left join fp_channel j3 on j3.uid = m.channel_uid
    left join fp_designation j4 on j4.uid = j1.designation_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.start_date desc, m.created_at desc)", kind: "num" },
    { key: "employee", label: "Employee", expr: "j1.first_name" },
    { key: "employeeCode", label: "Employee Code", expr: "j1.employee_code", kind: "mono" },
    { key: "employeeDivision", label: "Employee Division", expr: "nullif(j1.division::text, 'null')" },
    { key: "customer", label: "Customer", expr: "j2.name" },
    { key: "customerCode", label: "Customer Code", expr: "j2.firm_code", kind: "mono" },
    { key: "skuName", label: "SKU Name", expr: "m.sku_name", kind: "mono" },
    { key: "skuCode", label: "SKU Code", expr: "m.sku_code", kind: "mono" },
    { key: "customField", label: "Custom Field", expr: "nullif(m.custom_field::text, 'null')" },
    { key: "routes", label: "Routes", expr: "nullif(m.routes::text, 'null')" },
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
    { key: "region", label: "Region", expr: "m.region" },
    { key: "achievementConsideration", label: "Achievement Consideration", expr: "m.achievement_consideration" },
    { key: "unitType", label: "Unit Type", expr: "m.unit_type", kind: "num" },
    { key: "startDate", label: "Start Date", expr: "m.start_date" },
    { key: "endDate", label: "End Date", expr: "m.end_date" },
    { key: "state", label: "State", expr: "m.state_state" },
    { key: "channel", label: "Channel", expr: "j3.channel" },
    { key: "chain", label: "Chain", expr: "m.chain_chain" },
  ],
  search: ["j1.first_name", "j1.employee_code", "j2.name", "m.sku_code"],
  filters: [
    { key: "designation", label: "Designation", expr: "j4.designation" },
    { key: "targettype", label: "Target type", expr: "m.target_type" },
    { key: "status", label: "Status", expr: "m.status" },
  ],
  order: "m.start_date desc, m.created_at desc",
};
