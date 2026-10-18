import { Gauge } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * KPI Targets (Recibo route `kpiTargets`).
 *
 * Spec columns: 34; built: 20.
 * Left out (buttons, or no matching data column):
 *   - Parameter Name (parameterName)
 *   - Description (description)
 *   - Target Goal (description)
 *   - Target Achieved(%) (targetAchievedInPercent)
 *   - Super Brands (superBrands)
 *   - Brands (brands)
 *   - Categories (categories)
 *   - Minimum Qty (minQty)
 *   - Sub Categories (minQty)
 *   - Target Type (targetType)
 *   - Based On (basedOn)
 *   - From Price (basedOn)
 *   - To Price (fromPrice)
 *   - Price Type (toPrice)
 */
export const kpiTargets: MasterDef = {
  slug: "kpiTargets",
  title: "KPI Targets",
  subtitle: "KPI targets with goal, achievement and incentive earned.",
  icon: Gauge,
  from: `fp_kpi_target m
    left join fp_staff j1 on j1.uid = m.staff_uid
    left join fp_channel j2 on j2.uid = m.channel_uid`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "employeeName", label: "Employee Name", expr: "j1.first_name" },
    { key: "targetName", label: "Target Name", expr: "m.target_name" },
    { key: "targetGoal", label: "Target Goal", expr: "m.target_goal", kind: "num" },
    { key: "achievedPoints", label: "Achieved Points", expr: "m.achieved_points", kind: "num" },
    { key: "incentiveEarned", label: "Incentive Earned", expr: "m.incentive_earned", kind: "money" },
    { key: "targetAchieved", label: "Target Achieved(%)", expr: "m.target_achieved", kind: "num" },
    { key: "periodType", label: "Period Type", expr: "m.period_type" },
    { key: "channel", label: "Channel", expr: "j2.channel" },
    { key: "fromDate", label: "From Date", expr: "m.from_date", kind: "date" },
    { key: "toDate", label: "To Date", expr: "m.to_date", kind: "date" },
    { key: "region", label: "Region", expr: "nullif(m.region::text, 'null')" },
    { key: "states", label: "States", expr: "nullif(m.states::text, 'null')" },
    { key: "divisions", label: "Divisions", expr: "nullif(m.divisions::text, 'null')" },
    { key: "designations", label: "Designations", expr: "nullif(m.designations::text, 'null')" },
    { key: "customerClass", label: "Customer Class", expr: "nullif(m.customer_class::text, 'null')" },
    { key: "customerType", label: "Customer Type", expr: "nullif(m.customer_type::text, 'null')" },
    { key: "status", label: "Status", expr: "m.status" },
    { key: "weightagePoints", label: "Weightage Points", expr: "m.target_goal", kind: "num" },
    { key: "targetAchieved2", label: "Target Achieved", expr: "m.target_achieved", kind: "num" },
  ],
  search: ["m.target_name"],
  filters: [
    { key: "channel", label: "Channel", expr: "j2.channel" },
    { key: "period", label: "Period", expr: "m.period_type" },
  ],
  order: "m.created_at desc",
};
