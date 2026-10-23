import { Contact } from "lucide-react";
import type { MasterDef } from "../types";
import { REF_BEATS, REF_CHANNELS, REF_PARENT_FIRMS, REF_STAFF, REF_STATES, SUGGEST_CUSTOMER_CLASS, SUGGEST_CUSTOMER_TYPE } from "../refs";
import { person, active } from "./fragments";

/** Whether the customer can sign in to the Gaia app: a distributor needs an enabled login and an active customer record. */
const APP_LOGIN = `case when dl.id is null then 'No login' when not dl.active then 'Disabled' when f.active = 1 then 'Active' else 'Customer inactive' end`;

/** Route: /orders/distribution */
export const customers: MasterDef = {
  slug: "distribution",
  title: "Customer Masters",
  subtitle: "Every distributor, retailer, institution and store, with who serves them and which route they are on.",
  icon: Contact,
  from: `fp_firm f
    left join fp_channel ch on ch.uid = f.channel_uid
    left join fp_firm p on p.uid = f.parent_firm_uid
    left join fp_staff s on s.uid = f.sales_contact_uid
    left join fp_beat b on b.uid = f.beat_uid
    left join dist_login dl on dl.firm_uid = f.uid`,
  cols: [
    { key: "code", label: "Code", expr: "f.firm_code", kind: "mono" },
    { key: "name", label: "Name", expr: "f.name" },
    { key: "channel", label: "Channel", expr: "ch.channel" },
    { key: "type", label: "Type", expr: "f.firm_type" },
    { key: "class", label: "Class", expr: "f.firm_class" },
    { key: "status", label: "Status", expr: active("f"), kind: "status" },
    { key: "state", label: "State", expr: "f.state_state" },
    { key: "city", label: "City", expr: "f.city" },
    { key: "pincode", label: "Pincode", expr: "f.pincode", kind: "mono" },
    { key: "phone", label: "Phone", expr: "f.phone", kind: "mono" },
    { key: "parent", label: "Served by", expr: "p.name" },
    { key: "salesman", label: "Sales contact", expr: person("s") },
    { key: "route", label: "Route", expr: "b.beat_name" },
    { key: "credit", label: "Credit limit", expr: "f.credit_limit", kind: "money" },
    { key: "gstin", label: "GSTIN", expr: "f.gstin", kind: "mono" },
    { key: "created", label: "Created", expr: "f.created_at", kind: "date" },
    { key: "applogin", label: "App login", expr: APP_LOGIN, kind: "status" },
    { key: "appmobile", label: "App mobile", expr: "dl.phone", kind: "mono" },
  ],
  search: ["f.firm_code", "f.name", "f.phone", "f.city", "f.gstin", "p.name", "b.beat_name"],
  filters: [
    { key: "channel", label: "Channel", expr: "ch.channel" },
    { key: "status", label: "Status", expr: active("f") },
    { key: "state", label: "State", expr: "f.state_state" },
    { key: "type", label: "Type", expr: "f.firm_type" },
    { key: "salesman", label: "Sales contact", expr: person("s") },
    { key: "applogin", label: "App login", expr: APP_LOGIN },
  ],
  stats: [
    { label: "Active", where: "f.active = 1" },
    { label: "Inactive", where: "f.active = 0" },
    { label: "Distributors", where: "ch.channel_code = 'DB'" },
    { label: "Retailers", where: "ch.channel_code = 'RT'" },
    { label: "On a route", where: "b.uid is not null" },
    { label: "Distributors with app login", where: "ch.channel_code = 'DB' and dl.id is not null" },
    { label: "Distributors without", where: "ch.channel_code = 'DB' and dl.id is null" },
  ],
  order: "f.firm_code",
  appLogin: "distributor",

  entity: {
    table: "fp_firm", idCol: "uid", idExpr: "f.uid", onExpr: "f.active = 1", noun: "customer", actorCols: true,
    defaults: { country_code: 91, parents: "", sales_report_mapping: "", active: 1 },
    active: {
      col: "active", on: 1, off: 0,
      setOff: "deactivation_date = now(), source_of_inactivation = 'Dashboard'",
      setOn: "deactivation_date = null, source_of_inactivation = null",
    },
    usage: [
      { label: "customers it serves", sql: "select count(*)::int as n from fp_firm where parent_firm_uid = $1 or master_firm_uid = $1 or company_uid = $1" },
      { label: "parent links", sql: "select count(*)::int as n from fp_firm_mapping where parent_firm_uid = $1" },
      { label: "employees", sql: "select count(*)::int as n from fp_staff where firm_uid = $1" },
    ],
    cleanup: ["delete from fp_firm_image where firm_uid = $1", "delete from fp_firm_mapping where firm_uid = $1"],
    fields: [
      { name: "firm_code", label: "Customer code", type: "text", required: true, lockOnEdit: true, upper: true, help: "Unique. Cannot be changed later." },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "channel_uid", label: "Channel", type: "ref", ref: REF_CHANNELS, required: true },
      { name: "firm_type", label: "Customer type", type: "suggest", suggest: SUGGEST_CUSTOMER_TYPE },
      { name: "firm_class", label: "Customer class", type: "suggest", suggest: SUGGEST_CUSTOMER_CLASS },
      { name: "parent_firm_uid", label: "Served by", type: "ref", ref: REF_PARENT_FIRMS, help: "The distributor / stockist this customer buys from." },
      { name: "sales_contact_uid", label: "Sales contact", type: "ref", ref: REF_STAFF },
      { name: "beat_uid", label: "Route", type: "ref", ref: REF_BEATS },
      { name: "phone", label: "Phone", type: "text" },
      { name: "email", label: "Email", type: "text" },
      { name: "contact_person", label: "Contact person", type: "text" },
      { name: "state_state", label: "State", type: "ref", ref: REF_STATES },
      { name: "city", label: "City", type: "text" },
      { name: "place", label: "Area", type: "text" },
      { name: "pincode", label: "Pincode", type: "text" },
      { name: "address", label: "Address", type: "textarea", wide: true },
      { name: "gstin", label: "GSTIN", type: "text", upper: true },
      { name: "pan", label: "PAN", type: "text", upper: true },
      { name: "credit_limit", label: "Credit limit", type: "number", min: 0 },
      { name: "latitude", label: "Latitude", type: "number", min: -90, max: 90 },
      { name: "longitude", label: "Longitude", type: "number", min: -180, max: 180 },
      { name: "license_no", label: "License number", type: "text" },
      { name: "erp_code", label: "ERP code", type: "text" },
    ],
  },
};
