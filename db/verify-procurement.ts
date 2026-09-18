/**
 * Proves the procurement module pays what it says it pays.
 *
 * Fixtures are created inside a transaction that is always rolled back, so the
 * check can be run against a live database without leaving anything behind.
 * Every "want" below is a figure worked out by hand from the three rules:
 * pay for the solids in the weight taken, add the sachiv's commission, and
 * share the tanker's cost over what it carried.
 */
import "dotenv/config";
import { pool } from "../src/lib/db";
import { priceBatch } from "../src/lib/procurement/pricing";

const KG_PER_L = 1.03;
const RATE_SOLID = 297;

let failures = 0;

function check(label: string, got: unknown, want: number, tol = 0.005) {
  const ok = got !== null && Number.isFinite(Number(got)) && Math.abs(Number(got) - want) < tol;
  if (!ok) failures++;
  console.log(
    `${ok ? "  ok  " : "  FAIL"}  ${label.padEnd(34)} got ${String(got).padEnd(22)} want ${want}`,
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      (await client.query(sql, params)).rows as T[];

    const [{ id: scenarioId }] = await q<{ id: string }>(
      `insert into scenario (code, name, status) values ('verify_proc', 'Procurement check', 'draft')
       returning id`);

    const [chart] = await q<{
      id: string; basis: "solids"; rate_solid: number;
      rate_fat: null; rate_snf: null; flat_rate: null;
    }>(
      `insert into milk_rate_chart (scenario_id, code, name, milk_type, basis, rate_solid)
       values ($1, 'buffalo_ts', 'Buffalo — kg solids', 'buffalo', 'solids', $2)
       returning id, basis, rate_solid, rate_fat, rate_snf, flat_rate`,
      [scenarioId, RATE_SOLID]);

    const centers = await q<{
      id: string; code: string;
      commission_mode: "pct_of_value" | "per_kg"; commission_rate: number;
    }>(
      `insert into procurement_center
         (scenario_id, code, name, sachiv_name, rate_chart_id, commission_mode, commission_rate)
       values ($1, 'rampur', 'Rampur society', 'Kanti Patel', $2, 'pct_of_value', 4),
              ($1, 'bhilwada', 'Bhilwada society', 'Ramesh Shah', $2, 'per_kg', 0.50)
       returning id, code, commission_mode, commission_rate`,
      [scenarioId, chart.id]);

    // Rs 38/km over 63 km plus Rs 250 of tolls; 2,000 kg loaded, 1,990 weighed in.
    const [trip] = await q<{ id: string }>(
      `insert into tanker_trip (scenario_id, trip_date, tanker_code, route, distance_km,
                                cost_mode, rate, other_cost, received_qty_kg)
       values ($1, '2026-09-14', 'TNK-1', 'North', 63, 'per_km', 38, 250, 1990)
       returning id`, [scenarioId]);

    const rampur = centers.find((c) => c.code === "rampur")!;
    const bhilwada = centers.find((c) => c.code === "bhilwada")!;

    for (const e of [
      { center: rampur, qty_kg: 1200, fat_pct: 6.5, snf_pct: 9.0 },
      { center: bhilwada, qty_kg: 800, fat_pct: 6.0, snf_pct: 8.8 },
    ]) {
      const p = priceBatch(e, chart, e.center, KG_PER_L);
      await q(
        `insert into procurement_batch
           (scenario_id, center_id, rate_chart_id, trip_id, collected_on, shift, qty_kg, fat_pct,
            snf_pct, qty_litre, kg_fat, kg_snf, kg_solids, farmer_amount, commission_amount,
            farmer_rate_per_kg)
         values ($1,$2,$3,$4,'2026-09-14','morning',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [scenarioId, e.center.id, chart.id, trip.id, e.qty_kg, e.fat_pct, e.snf_pct,
         p.qty_litre, p.kg_fat, p.kg_snf, p.kg_solids, p.farmer_amount, p.commission_amount,
         p.farmer_rate_per_kg]);
    }

    const rows = await q<Record<string, number | string>>(
      `select center_code, qty_kg, qty_litre, kg_fat, kg_snf, kg_solids, farmer_amount,
              farmer_rate_per_kg, commission_amount, transport_amount, landed_kg,
              total_cost, landed_per_kg, landed_per_litre
         from v_procurement_batch where scenario_id = $1`, [scenarioId]);
    const ram = rows.find((r) => r.center_code === "rampur")!;
    const bhil = rows.find((r) => r.center_code === "bhilwada")!;

    console.log("\nMODULE 1 - price to the farmer (paid on solids, not litres)");
    check("rampur kg fat (1200 x 6.5%)", ram.kg_fat, 78);
    check("rampur kg SNF (1200 x 9.0%)", ram.kg_snf, 108);
    check("rampur kg solids", ram.kg_solids, 186);
    check("rampur farmer Rs (186 x 297)", ram.farmer_amount, 186 * RATE_SOLID);
    check("rampur Rs/kg of milk", ram.farmer_rate_per_kg, (186 * RATE_SOLID) / 1200);
    check("rampur litres (1200 / 1.03)", ram.qty_litre, 1200 / KG_PER_L, 0.01);
    check("bhilwada kg solids", bhil.kg_solids, 118.4);
    check("bhilwada farmer Rs", bhil.farmer_amount, 118.4 * RATE_SOLID);

    console.log("\nMODULE 3 - sachiv commission");
    check("rampur 4% of payout", ram.commission_amount, 55242 * 0.04);
    check("bhilwada Rs 0.50 x 800 kg", bhil.commission_amount, 400);
    const [sachiv] = await q<Record<string, number>>(
      `select commission_per_kg, commission_pct_of_value
         from v_sachiv_commission where scenario_id = $1 and center_code = 'rampur'`,
      [scenarioId]);
    check("rampur commission per kg", sachiv.commission_per_kg, (55242 * 0.04) / 1200);
    check("rampur commission % of value", sachiv.commission_pct_of_value, 4);

    console.log("\nMODULE 2 - tanker to plant (Rs 38/km x 63 km + Rs 250, 10 kg short)");
    const [t] = await q<Record<string, number>>(
      `select dispatched_kg, landed_kg, shortage_kg, trip_cost, cost_per_kg, cost_per_litre
         from v_tanker_trip where scenario_id = $1`, [scenarioId]);
    check("dispatched kg", t.dispatched_kg, 2000);
    check("landed kg (dock weight)", t.landed_kg, 1990);
    check("transit shortage kg", t.shortage_kg, 10);
    check("trip cost", t.trip_cost, 38 * 63 + 250);
    check("trip Rs/kg landed", t.cost_per_kg, 2644 / 1990);
    check("trip Rs/litre landed", t.cost_per_litre, (2644 / 1990) * KG_PER_L);
    check("rampur share (1200/2000)", ram.transport_amount, 2644 * 0.6);
    check("bhilwada share (800/2000)", bhil.transport_amount, 2644 * 0.4);
    check("rampur landed kg after shortage", ram.landed_kg, 1200 * (1990 / 2000));

    console.log("\nLANDED COST OF MILK");
    const ramTotal = 55242 + 55242 * 0.04 + 2644 * 0.6;
    check("rampur total", ram.total_cost, ramTotal);
    check("rampur Rs/kg", ram.landed_per_kg, ramTotal / 1194);
    check("rampur Rs/litre", ram.landed_per_litre, (ramTotal / 1194) * KG_PER_L);

    const [day] = await q<Record<string, number>>(
      `select fat_pct, snf_pct, farmer_amount, commission_amount, transport_amount, total_cost,
              landed_per_kg, landed_per_litre, landed_per_kg_solids
         from v_procurement_day where scenario_id = $1`, [scenarioId]);
    const farmerTotal = 55242 + 118.4 * RATE_SOLID;
    const dayTotal = farmerTotal + (55242 * 0.04 + 400) + 2644;
    check("day farmer payout", day.farmer_amount, farmerTotal);
    check("day commission", day.commission_amount, 55242 * 0.04 + 400);
    check("day transport", day.transport_amount, 2644);
    check("day total", day.total_cost, dayTotal);
    check("day average fat %", day.fat_pct, ((78 + 48) / 2000) * 100);
    check("day average SNF %", day.snf_pct, ((108 + 70.4) / 2000) * 100);
    check("day landed Rs/kg", day.landed_per_kg, dayTotal / 1990);
    check("day landed Rs/litre", day.landed_per_litre, (dayTotal / 1990) * KG_PER_L);
    check("day landed Rs/kg solids", day.landed_per_kg_solids, dayTotal / 304.4);
  } finally {
    await client.query("rollback");
    client.release();
  }

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} CHECK(S) FAILED\n`);
  await pool.end();
  process.exit(failures === 0 ? 0 : 1);
}

main();
