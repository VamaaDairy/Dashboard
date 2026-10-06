import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";

/** One farmer's totals over a period. Fat and SNF are weighted by litres, like a tank blend. */
export interface FarmerSummary {
  center: string;
  farmer_code: string;
  litres: number;
  kg_fat: number;
  kg_snf: number;
  fat_pct: number | null;
  snf_pct: number | null;
  amount: number;          // ₹, at each collection's price (see milk_price)
  priced_litres: number;   // litres that had a price - amount / priced_litres is their ₹ per litre
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
  price: number | null;    // the day's ₹ per litre, over the litres that had a price
  morning_litres: number;
  evening_litres: number;
}

// kg of fat (or SNF) in a set of collections: litres x kg per litre x percentage
const KG = (pct: string) => `sum(qty_litre * $K * ${pct} / 100)`;
const WEIGHTED = (pct: string) => `sum(qty_litre * ${pct}) / nullif(sum(qty_litre), 0)`;

function withK(sql: string, kgPerLitre: number) {
  return sql.replaceAll("$K", String(Number(kgPerLitre) || 1.03));
}

/** Farmers are identified by centre and code together - codes repeat from one centre to the next. */
export const farmerKey = (center: string, code: string) => `${center}|${code}`;

// Collections with each one's price: the rate chart from the day one applies,
// the app's price before (milk_price in db/011). A tanker centre's price is
// never the app's placeholder - it has no price until tanker pricing is set.
// `s` is the scenario parameter.
const PRICED = (where: string, s: string) =>
  `(select c.*,
           case when k.kind = 'tanker' then null
                else milk_price(${s}, c.day, c.fat_pct, c.clr, c.rate) end as price
      from vamaa_collection c
      join vamaa_center k on k.center = c.center and k.is_active
     where ${where}) c`;
const AMOUNT = `coalesce(sum(qty_litre * price), 0)`;
const PRICED_LITRES = `coalesce(sum(qty_litre) filter (where price is not null), 0)`;

/** Every farmer, in every centre, who supplied milk between `from` and `to`, keyed by farmerKey. */
export async function getFarmerSummaries(
  from: string, to: string, kgPerLitre: number,
): Promise<Record<string, FarmerSummary>> {
  const rows = await query<FarmerSummary>(
    withK(
      `select center, farmer_code, sum(qty_litre) as litres,
              ${KG("fat_pct")} as kg_fat, ${KG("snf_pct")} as kg_snf,
              ${WEIGHTED("fat_pct")} as fat_pct, ${WEIGHTED("snf_pct")} as snf_pct,
              ${AMOUNT} as amount, ${PRICED_LITRES} as priced_litres,
              count(distinct day)::int as days,
              to_char(max(day), 'YYYY-MM-DD') as last_day
         from ${PRICED("c.day between $1 and $2", "$3")}
        group by center, farmer_code`,
      kgPerLitre,
    ),
    [from, to, await activeScenarioId()],
  );
  return Object.fromEntries(rows.map((r) => [farmerKey(r.center, r.farmer_code), r]));
}

/** One farmer, one row per day they supplied milk, oldest first. */
export async function getFarmerDays(
  center: string, code: string, from: string, to: string, kgPerLitre: number,
): Promise<FarmerDay[]> {
  return query<FarmerDay>(
    withK(
      `select to_char(day, 'YYYY-MM-DD') as day, sum(qty_litre) as litres,
              ${WEIGHTED("fat_pct")} as fat_pct, ${WEIGHTED("snf_pct")} as snf_pct,
              ${KG("fat_pct")} as kg_fat, ${KG("snf_pct")} as kg_snf,
              ${AMOUNT} as amount,
              ${AMOUNT} / nullif(${PRICED_LITRES}, 0) as price,
              coalesce(sum(qty_litre) filter (where shift = 'M'), 0) as morning_litres,
              coalesce(sum(qty_litre) filter (where shift = 'E'), 0) as evening_litres
         from ${PRICED("c.center = $1 and c.farmer_code = $2 and c.day between $3 and $4", "$5")}
        group by day
        order by day`,
      kgPerLitre,
    ),
    [center, code, from, to, await activeScenarioId()],
  );
}

/** Each farmer's milk-to-plant transporter, keyed by farmerKey. */
export async function getFarmerTransporters(): Promise<Record<string, string>> {
  const rows = await query<{ center: string; farmer_code: string; transporter_id: string }>(
    `select center, farmer_code, transporter_id from farmer_transporter where scenario_id = $1`,
    [await activeScenarioId()],
  );
  return Object.fromEntries(rows.map((r) => [farmerKey(r.center, r.farmer_code), r.transporter_id]));
}

/**
 * Every farmer's share of transport cost between `from` and `to` (see
 * v_farmer_transport_day), with the litres that share was spread over - so
 * cost / litres is their transport cost per litre. Keyed by farmerKey.
 */
export async function getTransportShares(
  from: string, to: string,
): Promise<Record<string, { cost: number; litres: number }>> {
  const rows = await query<{ center: string; farmer_code: string; cost: number; litres: number }>(
    `select center, farmer_code, coalesce(sum(cost), 0) as cost,
            coalesce(sum(litres) filter (where cost is not null), 0) as litres
       from v_farmer_transport_day
      where scenario_id = $1 and day between $2 and $3
      group by center, farmer_code`,
    [await activeScenarioId(), from, to],
  );
  return Object.fromEntries(rows.map((r) => [farmerKey(r.center, r.farmer_code), { cost: r.cost, litres: r.litres }]));
}

/** One farmer's share of transport cost, by day. Days with no transporter cost are absent. */
export async function getFarmerTransportDays(
  center: string, code: string, from: string, to: string,
): Promise<Record<string, number>> {
  const rows = await query<{ day: string; cost: number }>(
    `select to_char(day, 'YYYY-MM-DD') as day, cost from v_farmer_transport_day
      where scenario_id = $1 and center = $2 and farmer_code = $3 and day between $4 and $5 and cost is not null`,
    [await activeScenarioId(), center, code, from, to],
  );
  return Object.fromEntries(rows.map((r) => [r.day, r.cost]));
}
