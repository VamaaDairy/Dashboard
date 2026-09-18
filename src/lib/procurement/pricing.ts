import { DEFAULT_KG_PER_LITRE, kgToLitres } from "@/lib/units";

/**
 * Every rule that turns a weighed, tested collection into money lives here and
 * nowhere else. The results are written onto the batch row at save time, so a
 * later edit to a rate chart never rewrites what was already paid out.
 */

export type RateBasis = "solids" | "fat_snf" | "fat_only" | "per_kg" | "per_litre";
export type CommissionMode = "per_kg" | "per_litre" | "pct_of_value" | "none";

export interface RateChart {
  basis: RateBasis;
  rate_solid: number | null;
  rate_fat: number | null;
  rate_snf: number | null;
  flat_rate: number | null;
}

export interface CommissionTerms {
  commission_mode: CommissionMode;
  commission_rate: number | null;
}

export interface BatchInput {
  qty_kg: number;
  fat_pct: number | null;
  snf_pct: number | null;
}

export interface PricedBatch {
  qty_kg: number;
  qty_litre: number;
  kg_fat: number;
  kg_snf: number;
  kg_solids: number;
  farmer_amount: number;
  farmer_rate_per_kg: number;
  commission_amount: number;
}

export const RATE_BASIS_LABEL: Record<RateBasis, string> = {
  solids: "Per kg total solids (fat + SNF)",
  fat_snf: "Separate fat and SNF rates",
  fat_only: "Per kg fat only",
  per_kg: "Flat rate per kg of milk",
  per_litre: "Flat rate per litre of milk",
};

export const COMMISSION_MODE_LABEL: Record<CommissionMode, string> = {
  per_kg: "Per kg collected",
  per_litre: "Per litre collected",
  pct_of_value: "Share of the farmer payment",
  none: "No commission",
};

/** The rate-chart field that carries the number, for basis-aware forms. */
export function rateFieldsFor(basis: RateBasis): Array<keyof RateChart> {
  switch (basis) {
    case "solids":
      return ["rate_solid"];
    case "fat_snf":
      return ["rate_fat", "rate_snf"];
    case "fat_only":
      return ["rate_fat"];
    default:
      return ["flat_rate"];
  }
}

/**
 * What the farmer is owed. Note what is *not* here: litres. We take delivery of
 * a weight, we test it, and we pay for the fat and SNF that weight contains.
 */
export function farmerAmount(
  batch: BatchInput,
  chart: RateChart,
  kgPerLitre = DEFAULT_KG_PER_LITRE,
): number {
  const qty = num(batch.qty_kg);
  const kgFat = (qty * num(batch.fat_pct)) / 100;
  const kgSnf = (qty * num(batch.snf_pct)) / 100;

  switch (chart.basis) {
    case "solids":
      return (kgFat + kgSnf) * num(chart.rate_solid);
    case "fat_snf":
      return kgFat * num(chart.rate_fat) + kgSnf * num(chart.rate_snf);
    case "fat_only":
      return kgFat * num(chart.rate_fat);
    case "per_kg":
      return qty * num(chart.flat_rate);
    case "per_litre":
      return kgToLitres(qty, kgPerLitre) * num(chart.flat_rate);
  }
}

/** What the sachiv earns for putting that collection together. */
export function commissionAmount(
  batch: BatchInput,
  terms: CommissionTerms,
  farmerValue: number,
  kgPerLitre = DEFAULT_KG_PER_LITRE,
): number {
  const qty = num(batch.qty_kg);
  const rate = num(terms.commission_rate);

  switch (terms.commission_mode) {
    case "per_kg":
      return qty * rate;
    case "per_litre":
      return kgToLitres(qty, kgPerLitre) * rate;
    case "pct_of_value":
      return (farmerValue * rate) / 100;
    case "none":
      return 0;
  }
}

/** Everything derived from one collection, ready to be written to its row. */
export function priceBatch(
  batch: BatchInput,
  chart: RateChart,
  terms: CommissionTerms,
  kgPerLitre = DEFAULT_KG_PER_LITRE,
): PricedBatch {
  const qty_kg = num(batch.qty_kg);
  const kg_fat = (qty_kg * num(batch.fat_pct)) / 100;
  const kg_snf = (qty_kg * num(batch.snf_pct)) / 100;
  const farmer = farmerAmount(batch, chart, kgPerLitre);

  return {
    qty_kg,
    qty_litre: kgToLitres(qty_kg, kgPerLitre),
    kg_fat,
    kg_snf,
    kg_solids: kg_fat + kg_snf,
    farmer_amount: farmer,
    farmer_rate_per_kg: qty_kg > 0 ? farmer / qty_kg : 0,
    commission_amount: commissionAmount(batch, terms, farmer, kgPerLitre),
  };
}

/**
 * What a chart pays for one kilogram of milk at a given test - the number a
 * rate chart is actually judged on, since the chart's own rates are per kg of
 * solids rather than per kg of milk.
 */
export function chartRatePerKg(
  chart: RateChart,
  fatPct: number,
  snfPct: number,
  kgPerLitre = DEFAULT_KG_PER_LITRE,
): number {
  return farmerAmount({ qty_kg: 1, fat_pct: fatPct, snf_pct: snfPct }, chart, kgPerLitre);
}

function num(v: number | null | undefined): number {
  return v === null || v === undefined || !Number.isFinite(Number(v)) ? 0 : Number(v);
}
