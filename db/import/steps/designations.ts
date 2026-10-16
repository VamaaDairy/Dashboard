/** fp_designation: every designation named by an employee or by a customer's sales contact. */
import { ADMIN_DESIGNATION } from "../constants";
import { uid } from "../lib/ids";
import { slug, str } from "../lib/parse";
import { upsert } from "../lib/sql";
import type { Row, Step } from "../types";

export const loadDesignations: Step = async (ctx) => {
  const { empActive, empGone, customers } = ctx.reports;
  const names = new Set<string>();
  for (const r of [...empActive, ...empGone]) { const d = str(r["Designation"]); if (d) names.add(d.toUpperCase()); }
  for (const r of customers) { const d = str(r["Sales Contact Designation"]); if (d) names.add(d.toUpperCase()); }
  if (!names.size) return;

  const rows: Row[] = [...names].map((name) => {
    const code = slug(name);
    const admin = name === ADMIN_DESIGNATION;
    return {
      uid: uid(`designation:${code}`), designation: name, designation_code: code,
      department: admin ? "MIS" : "SALES", full_access: admin ? 1 : 0, active: 1, sales: admin ? 0 : 1,
    };
  });
  ctx.summary.push(`designations ${await upsert(ctx, "fp_designation", rows)}`);
};
