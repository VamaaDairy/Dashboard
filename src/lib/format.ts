export function formatNumber(n: number | null | undefined, decimals: number): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Same as formatNumber, but shows a dash where there is no number yet. */
export function formatOrDash(n: number | null | undefined, decimals: number): string {
  return formatNumber(n, decimals) || "—";
}
