/** fp_staff from both employee sheets (active and deactivated), then the reporting line by manager e-mail. */
import { COUNTRY_CODE } from "../constants";
import { given } from "../lib/ids";
import { list, nowIso, num, slug, stamp, str } from "../lib/parse";
import { companyFirm, lookup, patch, upsert } from "../lib/sql";
import type { Rec, Row, Step } from "../types";

function staffRow(r: Rec, gone: boolean, designation: string, company: string): Row {
  const created = stamp(r["Created Date"], r["Created Time"]);
  const updater = str(r["Updated By"]);
  return {
    uid: given(r["UID"], `staff:${str(r["Emp Code"]) ?? str(r["Email"]) ?? str(r["First Name"])}`),
    first_name: str(r["First Name"]) ?? "-", last_name: str(r["Last Name"]), gender: str(r["Gender"]), country_code: COUNTRY_CODE,
    phone: str(r["Phone"]), employee_code: str(r["Emp Code"]), email: str(r["Email"]), city: str(r["City"]), pincode: str(r["Pin Code"]),
    address: str(r["Address"]), km_allowance: num(r["KM Allowance"]), daily_allowance: num(r["Daily Allowance"]),
    travel_allowance: num(r["Travel Allowance"]), outstation_allowance: num(r["Outstation Allowance"]),
    own_bike_km_allowance: num(r["Own Bike KM Allowance"]), own_car_km_allowance: num(r["Own Car KM Allowance"]),
    mobile_allowance: num(r["Mobile Allowance"]), night_out_allowance: num(r["Night Out Allowance"]),
    ex_station_allowance: num(r["Ex Station Allowance"]), petrol_allowance: num(r["Petrol Allowance"]),
    invoice_prefix: str(r["Invoice Prefix"]), working_states: list(r["Working States"]), division: list(r["Division"]),
    date_of_birth: stamp(r["Date of Birth"]), date_of_joining: stamp(r["Date of Joining"]), approval_level: num(r["Approval Level"]),
    parent_name: str(r["Father / Mother / Guardian Name"]), pan: str(r["PAN"]), aadhar_number: str(r["Aadhar Number"]),
    role: str(r["Role Type"]), cluster: str(r["Cluster"]), territory_code: str(r["Territory Code"]),
    van_registration_number: str(r["Van Registration Number"]), team_team: str(r["Team"]),
    active: gone ? 0 : str(r["Status"])?.toUpperCase() === "ACTIVE" ? 1 : 0,
    deactivation_date: stamp(r["Deactivated Date"], r["Deactivated Time"]), resignation_date: stamp(r["Resignation Date"]),
    resignation_type: str(r["Resignation Type"]),
    updated_by: updater ? { name: updater, from: str(r["Updated From"]) } : null,
    state_state: str(r["State"])?.toUpperCase() ?? null, designation_uid: designation, firm_uid: company,
    managers: str(r["Reporting Manager"]), reporting: str(r["Reporting Manager Email"]),
    created_at: created ?? nowIso(), updated_at: stamp(r["Updated Date"], r["Updated Time"]) ?? created ?? nowIso(),
  };
}

export const loadEmployees: Step = async (ctx) => {
  const { empActive, empGone } = ctx.reports;
  const sheets = [...empActive.map((r) => ({ r, gone: false })), ...empGone.map((r) => ({ r, gone: true }))];
  if (!sheets.length) return;

  const company = await companyFirm(ctx);
  if (!company) throw new Error("No company customer (channel CMP, e.g. VAM) in the database - import CUSTOMER_MASTER first, employees belong to it.");
  const designations = await lookup(ctx, `select designation_code k, uid v from fp_designation`);

  const rows: Row[] = [];
  for (const { r, gone } of sheets) {
    const d = str(r["Designation"]);
    const designation = d ? designations.get(slug(d)) : undefined;
    if (!designation) { ctx.warn.push(`employee skipped (no designation): ${str(r["First Name"])}`); continue; }
    rows.push(staffRow(r, gone, designation, company));
  }
  ctx.summary.push(`employees ${await upsert(ctx, "fp_staff", rows)}`);

  // reporting line, by the manager's e-mail
  const byEmail = await lookup(ctx, `select lower(email) k, uid v from fp_staff where email is not null order by active, created_at desc`);
  const links = rows.flatMap((s) => {
    const manager = byEmail.get((str(s.reporting) ?? "").toLowerCase());
    return manager && manager !== s.uid ? [{ uid: s.uid, reporting_manager_uid: manager }] : [];
  });
  await patch(ctx, "fp_staff", links, ["reporting_manager_uid"]);
};
