/**
 * Litres and kilograms are interchangeable throughout the portal through a
 * single assumption: one litre of milk weighs `milk_kg_per_litre` kilograms
 * (1.03 by default). Procurement is weighed, so kilograms are the honest
 * quantity and litres are derived from them - never the other way round.
 *
 * The live factor is the `milk_kg_per_litre` parameter row; this constant is
 * only the fallback for when no scenario has overridden it.
 */
export const DEFAULT_KG_PER_LITRE = 1.03;

export function litresToKg(litres: number, kgPerLitre = DEFAULT_KG_PER_LITRE): number {
  return litres * kgPerLitre;
}

export function kgToLitres(kg: number, kgPerLitre = DEFAULT_KG_PER_LITRE): number {
  return kg / kgPerLitre;
}

/**
 * Kilograms of fat (or SNF) in a quantity of milk: litres x kg per litre x
 * the percentage. Null when the percentage isn't known.
 */
export function kgOfSolid(
  litres: number, pct: number | null | undefined, kgPerLitre = DEFAULT_KG_PER_LITRE,
): number | null {
  if (pct === null || pct === undefined || !Number.isFinite(Number(pct))) return null;
  return (litres * kgPerLitre * Number(pct)) / 100;
}

/** A rate quoted per litre, restated per kilogram (and back). */
export function perLitreToPerKg(rate: number, kgPerLitre = DEFAULT_KG_PER_LITRE): number {
  return rate / kgPerLitre;
}

export function perKgToPerLitre(rate: number, kgPerLitre = DEFAULT_KG_PER_LITRE): number {
  return rate * kgPerLitre;
}

/**
 * SNF from a lactometer reading, for centres that record CLR rather than SNF
 * directly: SNF% = CLR/4 + 0.20 x Fat% + 0.70.
 */
export function snfFromClr(clr: number, fatPct: number): number {
  return clr / 4 + 0.2 * fatPct + 0.7;
}
