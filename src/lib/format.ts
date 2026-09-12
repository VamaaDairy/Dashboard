export function formatNumber(n: number | null | undefined, decimals: number): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
