import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { centerCode } from "@/lib/vamaa/sync";

/** One farmer's totals over a period. Fat and SNF are weighted by litres, like a tank blend. */
export interface FarmerSummary {
  farmer_code: string;
  litres: number;
  kg_fat: number;
  kg_snf: number;
  fat_pct: number | null;
  snf_pct: number | null;
  amount: number;
  days: number;
  last_day: string | null;
}

/** One farmer on one day, both shifts together, plus the morning / evening split. */
export interface FarmerDay {
  day: string;
  litres: number;
  fat_pct: number | null;
  snf_pct: number | null;
  kg_fat: number;
  kg_snf: number;
  amount: number;
  morning_litres: number;
  evening_litres: number;
}

// kg of fat (or SNF) in a set of collections: litres x kg per litre x percentage
const KG = (pct: string) => `sum(qty_litre * $K * ${pct} / 100)`;
const WEIGHTED = (pct: string) => `sum(qty_litre * ${pct}) / nullif(sum(qty_litre), 0)`;

function withK(sql: string, kgPerLitre: number) {
  return sql.replaceAll("$K", String(Number(kgPerLitre) || 1.03));
}

/** Every farmer who supplied milk between `from` and `to`, keyed by farmer code. */
export async function getFarmerSummaries(
  from: string, to: string, kgPerLitre: number,
): Promise<Record<string, FarmerSummary>> {
  const rows = await query<FarmerSummary>(
    withK(
      `select farmer_code, sum(qty_litre) as litres,
              ${KG("fat_pct")} as kg_fat, ${KG("snf_pct")} as kg_snf,
              ${WEIGHTED("fat_pct")} as fat_pct, ${WEIGHTED("snf_pct")} as snf_pct,
              sum(amount) as amount, count(distinct day)::int as days,
              to_char(max(day), 'YYYY-MM-DD') as last_day
         from vamaa_collection
        where center = $1 and day between $2 and $3
        group by farmer_code`,
      kgPerLitre,
    ),
    [centerCode(), from, to],
  );
  return Object.fromEntries(rows.map((r) => [r.farmer_code, r]));
}

/** One farmer, one row per day they supplied milk, oldest first. */
export async function getFarmerDays(
  code: string, from: string, to: string, kgPerLitre: number,
): Promise<FarmerDay[]> {
  return query<FarmerDay>(
    withK(
      `select to_char(day, 'YYYY-MM-DD') as day, sum(qty_litre) as litres,
              ${WEIGHTED("fat_pct")} as fat_pct, ${WEIGHTED("snf_pct")} as snf_pct,
              ${KG("fat_pct")} as kg_fat, ${KG("snf_pct")} as kg_snf,
              sum(amount) as amount,
              coalesce(sum(qty_litre) filter (where shift = 'M'), 0) as morning_litres,
              coalesce(sum(qty_litre) filter (where shift = 'E'), 0) as evening_litres
         from vamaa_collection
        where center = $1 and farmer_code = $2 and day between $3 and $4
        group by day
        order by day`,
      kgPerLitre,
    ),
    [centerCode(), code, from, to],
  );
}

/** Each farmer's milk-to-plant transporter, keyed by farmer code. */
export async function getFarmerTransporters(): Promise<Record<string, string>> {
  const rows = await query<{ farmer_code: string; transporter_id: string }>(
    `select farmer_code, transporter_id from farmer_transporter where scenario_id = $1 and center = $2`,
    [await activeScenarioId(), centerCode()],
  );
  return Object.fromEntries(rows.map((r) => [r.farmer_code, r.transporter_id]));
}

/**
 * Every farmer's share of transport cost between `from` and `to` (see
 * v_farmer_transport_day), with the litres that share was spread over - so
 * cost / litres is their transport cost per litre.
 */
export async function getTransportShares(
  from: string, to: string,
): Promise<Record<string, { cost: number; litres: number }>> {
  const rows = await query<{ farmer_code: string; cost: number; litres: number }>(
    `select farmer_code, coalesce(sum(cost), 0) as cost,
            coalesce(sum(litres) filter (where cost is not null), 0) as litres
       from v_farmer_transport_day
      where scenario_id = $1 and center = $2 and day between $3 and $4
      group by farmer_code`,
    [await activeScenarioId(), centerCode(), from, to],
  );
  return Object.fromEntries(rows.map((r) => [r.farmer_code, { cost: r.cost, litres: r.litres }]));
}

/** One farmer's share of transport cost, by day. Days with no transporter cost are absent. */
export async function getFarmerTransportDays(code: string, from: string, to: string): Promise<Record<string, number>> {
  const rows = await query<{ day: string; cost: number }>(
    `select to_char(day, 'YYYY-MM-DD') as day, cost from v_farmer_transport_day
      where scenario_id = $1 and center = $2 and farmer_code = $3 and day between $4 and $5 and cost is not null`,
    [await activeScenarioId(), centerCode(), code, from, to],
  );
  return Object.fromEntries(rows.map((r) => [r.day, r.cost]));
}
