import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";

export interface RateChart {
  id: string;
  name: string;
  effective_from: string;
  notes: string | null;
  fats: number[];
  clrs: number[];
  /** "fat|clr" -> ₹ per litre, e.g. "4.0|27.0" -> 38.06 */
  cells: Record<string, number>;
}

const key = (fat: number, clr: number) => `${fat.toFixed(1)}|${clr.toFixed(1)}`;

/**
 * ₹ per litre for a reading: fat to the nearest 0.1 and CLR to the nearest
 * 0.5, as milk_chart_rate() does in SQL. Null when the reading is off the
 * chart (or blank) - never an invented rate.
 */
export function chartRate(chart: RateChart | null, fat: number | null | undefined, clr: number | null | undefined): number | null {
  if (!chart || fat === null || fat === undefined || clr === null || clr === undefined) return null;
  const f = Math.round(Number(fat) * 10) / 10;
  const c = Math.round(Number(clr) * 2) / 2;
  return chart.cells[key(f, c)] ?? null;
}

/** Every chart, newest first - for the chart picker. */
export async function getCharts(): Promise<{ id: string; name: string; effective_from: string }[]> {
  return query(
    `select id, name, to_char(effective_from, 'YYYY-MM-DD') as effective_from
       from milk_rate_grid where scenario_id = $1 order by effective_from desc`,
    [await activeScenarioId()],
  );
}

/** The chart in force on `date` (or a specific chart by id), with all its rates. */
export async function getChart(opts: { date?: string; id?: string }): Promise<RateChart | null> {
  const scenario = await activeScenarioId();
  const grid = await query<{ id: string; name: string; effective_from: string; notes: string | null }>(
    opts.id
      ? `select id, name, to_char(effective_from, 'YYYY-MM-DD') as effective_from, notes
           from milk_rate_grid where scenario_id = $1 and id = $2`
      : `select id, name, to_char(effective_from, 'YYYY-MM-DD') as effective_from, notes
           from milk_rate_grid where scenario_id = $1 and effective_from <= $2::date
          order by effective_from desc limit 1`,
    [scenario, opts.id ?? opts.date ?? "9999-12-31"],
  );
  if (!grid.length) return null;
  const cells = await query<{ fat: number; clr: number; rate: number }>(
    `select fat, clr, rate from milk_rate_grid_cell where grid_id = $1`, [grid[0].id]);
  return {
    ...grid[0],
    fats: [...new Set(cells.map((c) => Number(c.fat)))].sort((a, b) => a - b),
    clrs: [...new Set(cells.map((c) => Number(c.clr)))].sort((a, b) => a - b),
    cells: Object.fromEntries(cells.map((c) => [key(Number(c.fat), Number(c.clr)), Number(c.rate)])),
  };
}

export interface CollectionPrice {
  rate: number | null;     // ₹ per litre
  amount: number | null;   // ₹ for the collection
  source: "chart" | "app" | null;
}

/**
 * What a collection is priced at - the same rule as milk_price() in SQL.
 * `chart` is the chart in force on the collection's day (null before the
 * first one). Under a chart the price is calculated from it; before any
 * chart, the price the Vamaa app sent is kept as it was.
 */
export function collectionPrice(
  chart: RateChart | null,
  r: { quantity: number | string; fat: number | string; clr: number | string; rate: number | string; amount: number | string },
): CollectionPrice {
  const litres = Number(r.quantity) || 0;
  if (chart) {
    const rate = chartRate(chart, Number(r.fat), Number(r.clr));
    return { rate, amount: rate === null ? null : Math.round(rate * litres * 100) / 100, source: rate === null ? null : "chart" };
  }
  const amount = Number(r.amount) || 0;
  const rate = Number(r.rate) || (litres > 0 && amount > 0 ? amount / litres : 0);
  return rate > 0 ? { rate, amount: amount || Math.round(rate * litres * 100) / 100, source: "app" } : { rate: null, amount: null, source: null };
}
