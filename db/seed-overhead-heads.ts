/**
 * Standard daily overhead cost heads for the Production day-entry page
 * (`daily_overhead`, divided by `production_day.milk_processed_l` to give
 * that day's shared conversion rate - see `db/002_daily.sql`).
 *
 * Fuel is split into procurement (collection), delivery (market dispatch) and
 * production in plant per Darshan's request - all created with amount-only entry for now; the
 * qty/rate calculation for each gets defined later and can be added without
 * a migration (it's just how the day-entry form is filled in).
 *
 * Idempotent: safe to run again.
 */
import "dotenv/config";
import { pool } from "../src/lib/db";

const HEADS: Array<{ code: string; label: string; unit: string | null; notes?: string }> = [
  { code: "coal", label: "Coal / Boiler Fuel", unit: "kg" },
  { code: "electricity", label: "Electricity", unit: "units" },
  { code: "labour", label: "Labour", unit: "hours" },
  { code: "plant_staff", label: "Plant Staff Salary", unit: "day" },
  { code: "chemicals_daily", label: "Chemicals (culture, cleaning, lab)", unit: "day" },
  { code: "fuel_procurement", label: "Fuel - Procurement", unit: null,
    notes: "Vehicle fuel for milk collection/pickup - calculation method to be confirmed" },
  { code: "fuel_delivery", label: "Fuel - Delivery", unit: null,
    notes: "Vehicle fuel for market delivery/dispatch - calculation method to be confirmed" },
  { code: "fuel_production", label: "Fuel - Production in plant", unit: null,
    notes: "Fuel used inside the plant for production - calculation method to be confirmed" },
  { code: "other_overhead", label: "Other Plant Cost", unit: "day" },
];

async function main() {
  const scenario = await pool.query<{ id: string }>(
    `select id from scenario order by (status = 'active') desc, created_at desc limit 1`,
  );
  if (!scenario.rows.length) throw new Error("No scenario found - run `npm run db:setup` first");
  const sid = scenario.rows[0].id;

  for (const [i, h] of HEADS.entries()) {
    const existing = await pool.query(`select 1 from overhead_head where scenario_id = $1 and code = $2`, [sid, h.code]);
    if (existing.rows.length) { console.log(`skip ${h.code}, already exists`); continue; }
    await pool.query(
      `insert into overhead_head (scenario_id, code, label, unit, notes, sort_order) values ($1,$2,$3,$4,$5,$6)`,
      [sid, h.code, h.label, h.unit, h.notes ?? null, i],
    );
    console.log(`created ${h.code}`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
