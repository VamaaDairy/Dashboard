/**
 * A batch is complete - its data acceptable for costing - only once every
 * ingredient on the product's standing list has a quantity. A product with no
 * list (ghee, khowa) has nothing to enter, so it is complete once it has milk
 * or any ingredient. The yield can come later.
 */
export function batchComplete(
  standing: { ingredient_id: string }[],
  lines: { ingredient_id: string | null; qty: number }[],
  milkLitres = 0,
): boolean {
  const entered = lines.filter((l) => Number(l.qty) > 0);
  if (!standing.length) return entered.length > 0 || milkLitres > 0;
  return standing.every((s) => entered.some((l) => l.ingredient_id === s.ingredient_id));
}
