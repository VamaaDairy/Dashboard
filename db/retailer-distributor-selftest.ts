/**
 * Self-test: every new retailer is served by a distributor (src/lib/distributor/requests.ts, index.ts) - on the local
 * database. Adds its own test retailers (phones 98000000xx) and removes them at the end.
 *
 *   npx tsx --require ./db/no-server-only.cjs db/retailer-distributor-selftest.ts  (server-only stubbed)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");

let failed = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failed++; };

async function main() {
  const { query, one } = await import("../src/lib/db");
  const { createFirmRequest, distributorsNear, servingDistributor, approveFirmRequest } = await import("../src/lib/distributor/requests");
  const PHONES = ["9800000001", "9800000002", "9800000003"];
  const clean = async () => {
    await query(`delete from fp_firm_mapping where firm_uid in (select uid from fp_firm where regexp_replace(coalesce(phone,''), '\\D', '', 'g') = any($1))`, [PHONES]);
    await query(`delete from fp_firm where regexp_replace(coalesce(phone,''), '\\D', '', 'g') = any($1)`, [PHONES]);
    await query(`delete from dist_firm_request where phone = any($1)`, [PHONES]);
  };
  await clean();
  const dist = await one<{ uid: string; name: string }>(`select f.uid, f.name from fp_firm f join fp_channel ch on ch.uid = f.channel_uid where ch.level between 2 and 3 and f.active = 1 limit 1`);
  const company = await one<{ uid: string }>(`select f.uid from fp_firm f join fp_channel ch on ch.uid = f.channel_uid where ch.level = 1 limit 1`);
  const staff = await one<{ uid: string }>(`select uid from fp_staff limit 1`);
  if (!dist || !company || !staff) throw new Error("Needs a distributor, the company and a staff member in the local database.");
  try {
    const list = await distributorsNear({ q: "" });
    check(list.some((d) => d.uid === dist.uid) && !list.some((d) => d.uid === company.uid), `the list has distributors / super stockists, not the company (${list.length})`);
    check(!!(await servingDistributor(dist.uid)) && !(await servingDistributor(company.uid)) && !(await servingDistributor("nope")), "only a distributor can serve a retailer");

    const base = { name: "ZZ Test Kirana", phone: PHONES[0], address: "Shop 1, Main Road, Raipur", kind: "Retailer" };
    const noDist = await createFirmRequest(staff.uid, null, base);
    check(!noDist.ok && !!noDist.fields?.distributorUid, `officer adding a retailer without its distributor: refused (${!noDist.ok ? noDist.fields?.distributorUid : ""})`);
    const withCompany = await createFirmRequest(staff.uid, null, { ...base, distributorUid: company.uid });
    check(!withCompany.ok, "the company is not a retailer's distributor: refused");
    const ok = await createFirmRequest(staff.uid, null, { ...base, distributorUid: dist.uid });
    check(ok.ok && ok.request.parentUid === dist.uid, "officer adding a retailer with its distributor: saved with it");
    const firm = await one<{ parent: string | null }>(`select parent_firm_uid as parent from fp_firm where regexp_replace(coalesce(phone,''), '\\D', '', 'g') = $1`, [PHONES[0]]);
    check(firm?.parent === dist.uid, `the retailer is in Customer Masters, served by ${dist.name}`);

    // a retailer request left for the office (no distributor on it): approval needs one
    const pend = await one<{ id: number }>(
      `insert into dist_firm_request (staff_uid, name, phone, address, kind) values ($1, 'ZZ Test Pending Retailer', $2, 'Shop 2, Main Road', 'Retailer') returning id`,
      [staff.uid, PHONES[1]],
    );
    const rt = await one<{ uid: string }>(`select uid from fp_channel where channel_code = 'RT'`);
    const refused = await approveFirmRequest(pend!.id, { code: "ZZT0001", channelUid: rt!.uid }, "selftest", { quiet: true });
    check(!refused.ok && /distributor/i.test(refused.error), `office approving a retailer without a distributor: refused (${!refused.ok ? refused.error : ""})`);
    const approved = await approveFirmRequest(pend!.id, { code: "ZZT0001", channelUid: rt!.uid, parentUid: dist.uid }, "selftest", { quiet: true });
    check(approved.ok, "with a distributor chosen: approved");
  } finally {
    await clean();
  }
  console.log(failed ? `${failed} FAILED` : "all passed");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
