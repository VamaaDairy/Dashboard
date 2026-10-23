import { Users } from "lucide-react";
import type { MasterDef } from "../types";
import { REF_DESIGNATIONS, REF_STAFF, REF_STATES } from "../refs";
import { person, active } from "./fragments";

/** Whether the employee (a sales officer booking for distributors) can sign in to the Gaia app. */
const APP_LOGIN = `case when dl.id is null then 'No login' when dl.active then 'Active' else 'Disabled' end`;

/** Route: /orders/staffs */
export const employees: MasterDef = {
  slug: "staffs",
  title: "Employee Profile",
  subtitle: "Everyone in the field force and office, active or gone, with their designation and manager.",
  icon: Users,
  from: `fp_staff s
    left join fp_designation d on d.uid = s.designation_uid
    left join fp_staff m on m.uid = s.reporting_manager_uid
    left join dist_login dl on dl.staff_uid = s.uid`,
  cols: [
    { key: "code", label: "Code", expr: "s.employee_code", kind: "mono" },
    { key: "name", label: "Name", expr: person("s") },
    { key: "designation", label: "Designation", expr: "d.designation" },
    { key: "status", label: "Status", expr: active("s"), kind: "status" },
    { key: "phone", label: "Phone", expr: "s.phone", kind: "mono" },
    { key: "email", label: "Email", expr: "s.email" },
    { key: "state", label: "State", expr: "s.state_state" },
    { key: "city", label: "City", expr: "s.city" },
    { key: "manager", label: "Reports to", expr: person("m") },
    { key: "customers", label: "Customers", expr: "(select count(*) from fp_firm x where x.sales_contact_uid = s.uid)::int", kind: "num" },
    { key: "joined", label: "Joined", expr: "s.date_of_joining", kind: "date" },
    { key: "left", label: "Left", expr: "coalesce(s.resignation_date, s.deactivation_date)", kind: "date" },
    { key: "applogin", label: "App login", expr: APP_LOGIN, kind: "status" },
    { key: "appmobile", label: "App mobile", expr: "dl.phone", kind: "mono" },
  ],
  search: ["s.employee_code", "s.first_name", "s.last_name", "s.phone", "s.email", "s.city"],
  filters: [
    { key: "designation", label: "Designation", expr: "d.designation" },
    { key: "status", label: "Status", expr: active("s") },
    { key: "state", label: "State", expr: "s.state_state" },
    { key: "manager", label: "Reports to", expr: person("m") },
    { key: "applogin", label: "App login", expr: APP_LOGIN },
  ],
  stats: [
    { label: "Active", where: "s.active = 1" },
    { label: "Inactive", where: "s.active = 0" },
    { label: "Field sales", where: "d.sales = 1 and s.active = 1" },
  ],
  order: "s.active desc, s.employee_code nulls last, s.first_name",
  appLogin: "salesman",

  entity: {
    table: "fp_staff", idCol: "uid", idExpr: "s.uid", onExpr: "s.active = 1", noun: "employee", actorCols: true,
    defaults: { country_code: 91, active: 1 },
    active: {
      col: "active", on: 1, off: 0,
      setOff: "deactivation_date = now()",
      setOn: "deactivation_date = null",
    },
    usage: [
      { label: "customers assigned to them", sql: "select count(*)::int as n from fp_firm where sales_contact_uid = $1" },
      { label: "employees reporting to them", sql: "select count(*)::int as n from fp_staff where reporting_manager_uid = $1" },
      { label: "routes", sql: "select count(*)::int as n from fp_beat where staff_uid = $1" },
    ],
    fields: [
      { name: "first_name", label: "First name", type: "text", required: true },
      { name: "last_name", label: "Last name", type: "text" },
      { name: "employee_code", label: "Employee code", type: "text", help: "Leave empty for office logins that have none." },
      { name: "designation_uid", label: "Designation", type: "ref", ref: REF_DESIGNATIONS, required: true },
      { name: "reporting_manager_uid", label: "Reports to", type: "ref", ref: REF_STAFF },
      { name: "gender", label: "Gender", type: "select", options: ["MALE", "FEMALE", "OTHER"] },
      { name: "phone", label: "Phone", type: "text" },
      { name: "email", label: "Email", type: "text" },
      { name: "date_of_joining", label: "Date of joining", type: "date", tz: true },
      { name: "state_state", label: "State", type: "ref", ref: REF_STATES },
      { name: "city", label: "City", type: "text" },
      { name: "pincode", label: "Pincode", type: "text" },
      { name: "address", label: "Address", type: "textarea", wide: true },
    ],
  },
};
