/**
 * fp_firm (customers), in two passes: the rows first, then the links between
 * them and to employees, which need both sides to exist.
 */
import { COMPANY_FIRM_CODE, COUNTRY_CODE } from "../constants";
import { given, uid } from "../lib/ids";
import { codes, dateOnly, flag, list, nowIso, num, stamp, str } from "../lib/parse";
import { companyFirm, lookup, patch, upsert } from "../lib/sql";
import type { Row, Step } from "../types";

const isActive = (status: unknown) => (str(status)?.toUpperCase() === "ACTIVE" ? 1 : 0);

/** Pass 1: everything that doesn't point at another customer or at an employee. */
export const loadCustomers: Step = async (ctx) => {
  const customers = ctx.reports.customers;
  if (!customers.length) return;
  const channels = await lookup(ctx, `select channel_code k, uid v from fp_channel`);

  const rows: Row[] = [];
  for (const r of customers) {
    const c = str(r["Customer Code"]);
    if (!c) { ctx.warn.push(`customer row skipped (no code): ${str(r["Name"])}`); continue; }
    const id = given(r["Uid"], `firm:${c}`);
    const ch = str(r["Channel Code"]);
    const created = stamp(r["Created Date"], r["Created Time"]);
    const creator = str(r["Who created the retailer (Username)"]);
    const updater = str(r["Updated By"]);
    rows.push({
      uid: id, name: str(r["Name"]) ?? c, firm_code: c, firm_class: str(r["Customer Class"]), firm_type: str(r["Customer Type"]),
      gstin: str(r["GSTIN/TRN"]), pan: str(r["PAN/IIN"]), cluster: str(r["Cluster"]), market: str(r["Market"]), route: str(r["TRUCK ROUTE"]),
      district: str(r["District"]), sub_district: str(r["Sub District"]), city: str(r["City"]), place: str(r["Place"]), pincode: str(r["Pincode"]),
      address: str(r["Address"]), latitude: num(r["Latitude"]), longitude: num(r["Longitude"]), country_code: COUNTRY_CODE,
      phone: str(r["Phone"]), landline: str(r["Alternate Phone"]), email: str(r["Email"]), floor_area: num(r["Floor Area"]),
      division: list(r["Division"]), active: isActive(r["Active Status"]),
      tcs_applicable: flag(r["TCS Applicable"]), parents: codes(r["Parent Customer Code"]).join(", "),
      contact_person: str(r["Contact Person"]), sales_report_mapping: "",
      license_no: str(r["License Number"]), erp_code: str(r["ERP Code"]), credit_limit: num(r["Credit Limit"]),
      deactivation_date: stamp(r["Deactivated Date"]), source_of_inactivation: str(r["Source Of Inactivation"]),
      created_by: creator ? { name: creator } : null,
      updated_by: updater ? { name: updater, from: str(r["Updated From"]) } : null,
      geo_tag_updated_at: stamp(r["GEO Tag Updated Date"], r["GEO Tag Updated Time"]),
      custom_fields: {
        customer_region: str(r["Customer Region"]), customer_branch: str(r["Customer Branch"]), branch_code: str(r["BranchCode"]),
        branch_type: str(r["Branch Type"]), branch: str(r["Branch"]), zone: str(r["Zone"]), head_quarter: str(r["Head Quarter"]),
        region: str(r["Region"]), parent_channels: str(r["Parent Customer Channel Code"]), sales_contact_status: str(r["Employee Status"]),
      },
      state_state: str(r["State"])?.toUpperCase() ?? null, channel_uid: ch ? channels.get(ch) ?? null : null, chain_chain: str(r["Chain"]),
      created_at: created ?? nowIso(), updated_at: stamp(r["Updated Date"], r["Updated Time"]) ?? created ?? nowIso(),
    });
    for (let i = 1; i <= 9; i++) {
      const url = str(r[`Picture ${i}`]);
      if (url) ctx.images.firm.push({ uid: uid(`fimg:${id}|${url}`), firm_uid: id, image_url: url });
    }
  }
  ctx.summary.push(`customers ${await upsert(ctx, "fp_firm", rows)}`);
};

/** Pass 2: parent distributor, master firm, company, sales contact, and the customer > parent mapping table. */
export const linkCustomers: Step = async (ctx) => {
  const customers = ctx.reports.customers;
  if (!customers.length) return;
  const company = await companyFirm(ctx);
  const firmByCode = await lookup(ctx, `select firm_code k, uid v from fp_firm`);
  const staffByCode = await lookup(ctx, `select employee_code k, uid v from fp_staff where employee_code is not null order by active, created_at desc`);
  const staffByEmail = await lookup(ctx, `select lower(email) k, uid v from fp_staff where email is not null order by active, created_at desc`);

  const refs: Row[] = [];
  const maps: Row[] = [];
  for (const r of customers) {
    const c = str(r["Customer Code"]);
    if (!c) continue;
    const id = given(r["Uid"], `firm:${c}`);
    const parents = codes(r["Parent Customer Code"]);
    const contactCode = str(r["Sales Contact Code"]);
    const contactEmail = str(r["Sales Team Email"])?.toLowerCase();
    const master = str(r["Master Firm Code"]);
    refs.push({
      uid: id,
      parent_firm_uid: parents[0] ? firmByCode.get(parents[0]) ?? null : null,
      master_firm_uid: master ? firmByCode.get(master) ?? null : null,
      company_uid: c === COMPANY_FIRM_CODE || id === company ? null : company ?? null,
      sales_contact_uid: (contactCode && staffByCode.get(contactCode)) || (contactEmail && staffByEmail.get(contactEmail)) || null,
    });
    const start = dateOnly(r["Created Date"]) ?? "2024-10-21";
    for (const p of parents) {
      const parent = firmByCode.get(p);
      if (parent) maps.push({ uid: uid(`fm:${id}|${parent}`), firm_uid: id, parent_firm_uid: parent, start_date: start, active: isActive(r["Active Status"]) });
    }
  }
  await patch(ctx, "fp_firm", refs, ["parent_firm_uid", "master_firm_uid", "company_uid", "sales_contact_uid"]);
  ctx.summary.push(`customer parent links ${await upsert(ctx, "fp_firm_mapping", maps)}`);
  const missing = refs.filter((x) => !x.sales_contact_uid).length;
  if (missing) ctx.warn.push(`${missing} customers have a sales contact that is not in the employee file`);
};
