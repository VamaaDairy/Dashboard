/**
 * The two legs of transport. Transport and Fuel both split along these, and
 * share the same URL segment so each page can link to its twin.
 */
export const TRANSPORT_SECTIONS = {
  milk_to_plant: { label: "Milk to plant", path: "milk-to-plant", fuelColumn: "fuel_procurement" },
  delivery: { label: "Delivery outside plant", path: "delivery", fuelColumn: "fuel_delivery" },
} as const;

export type CostBasis = "per_km" | "per_trip" | "diesel";

/**
 * How each basis is entered and shown. `unit` is what the day entry asks for;
 * `per` is how its rate reads ("10.40 / km"). Diesel has no rate of its own -
 * it is charged at the shared diesel price.
 */
export const COST_BASES: Record<CostBasis, { label: string; rateLabel: string; unit: string; per: string }> = {
  per_km: { label: "Per km", rateLabel: "₹ / km", unit: "km", per: "/ km" },
  per_trip: { label: "Fixed per trip", rateLabel: "₹ / trip", unit: "trips", per: "/ trip" },
  diesel: { label: "Diesel used", rateLabel: "diesel price", unit: "L", per: "/ L diesel" },
};

/** Which run column a basis is entered in. */
export const RUN_FIELD: Record<CostBasis, "km" | "trips" | "litres"> = {
  per_km: "km",
  per_trip: "trips",
  diesel: "litres",
};

/**
 * One day's cost for a transporter: km, trips or diesel litres x the rate in
 * force (for diesel, the diesel price). Unknown (null) until there is a rate
 * and the quantity it is charged on. Mirrors `cost` in the v_transport_run view.
 */
export function transportCost(basis: CostBasis | null, units: number | null, rate: number | null): number | null {
  if (basis === null || rate === null || units === null) return null;
  return units * rate;
}
