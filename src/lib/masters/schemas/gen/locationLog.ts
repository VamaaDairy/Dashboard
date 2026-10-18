import { Navigation } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Location Log (Recibo route `locationLog`).
 *
 * Spec columns: 15; built: 15.
 * The device and event columns of the portal screen come from other tables and are not built.
 */
export const locationLog: MasterDef = {
  slug: "locationLog",
  title: "Location Log",
  subtitle: "Location pings from employees phones, with GPS, battery and network state.",
  icon: Navigation,
  from: `fp_staff_location m
    left join fp_staff j1 on j1.uid = m.staff_uid`,
  dateRange: { expr: "m.activity_time", days: 30 },
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.activity_time desc)", kind: "num" },
    { key: "activityTime", label: "Activity Time", expr: "m.activity_time", kind: "datetime" },
    { key: "latitude", label: "Latitude", expr: "m.latitude", kind: "num" },
    { key: "longitude", label: "Longitude", expr: "m.longitude", kind: "num" },
    { key: "accuracy", label: "Accuracy", expr: "m.accuracy", kind: "num" },
    { key: "gpsStatus", label: "GPS Status", expr: "m.gps_status" },
    { key: "wifiStatus", label: "Wifi Status", expr: "m.wifi_status" },
    { key: "batteryOptimization", label: "Battery Optimization", expr: "m.battery_optimization" },
    { key: "batteryState", label: "Battery State", expr: "m.battery_state" },
    { key: "networkState", label: "Network State", expr: "m.network_state" },
    { key: "internetStatus", label: "Internet Status", expr: "m.internet_status" },
    { key: "staff", label: "Staff", expr: "j1.first_name" },
    { key: "speed", label: "Speed", expr: "m.speed", kind: "num" },
    { key: "provider", label: "Provider", expr: "m.provider" },
    { key: "operator", label: "Operator", expr: "m.operator" },
  ],
  search: ["j1.first_name", "j1.employee_code"],
  order: "m.activity_time desc",
};
