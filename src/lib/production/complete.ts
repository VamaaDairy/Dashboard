/**
 * A batch is complete - its data acceptable for costing - once it has milk or
 * any ingredient line. An ingredient entered as 0 counts (it was not used that
 * day); there is no need to enter every ingredient on the product's list. The
 * yield can come later.
 */
export function batchComplete(
  _standing: { ingredient_id: string }[],
  lines: { ingredient_id: string | null; qty: number }[],
  milkLitres = 0,
): boolean {
  return lines.length > 0 || milkLitres > 0;
}
