import "server-only";
import type { StockBatch } from "./calc";

/** Batches with stock from the plant stock app (the one the demand-sheet workbook read), earliest expiry first. */

const STOCK_API = process.env.STOCK_API_BASE || "http://103.171.96.225:3000";

interface ApiBatch { batchNumber?: string; ubd?: string | null; expiryDate?: string | null; isExpired?: boolean; closing?: { total?: number } }
interface ApiProduct { id?: string | number; shelfLifeDays?: number; batchesList?: ApiBatch[] }

/** Stock id -> batches; null when the stock app can't be reached. Batches past their date are left out. */
export async function stockBatches(): Promise<Map<string, StockBatch[]> | null> {
  try {
    const res = await fetch(`${STOCK_API}/api/stock/current`, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Array<{ products?: ApiProduct[] }> };
    const out = new Map<string, StockBatch[]>();
    for (const cat of json.data ?? []) {
      for (const p of cat.products ?? []) {
        if (p.id === undefined) continue;
        const batches = (p.batchesList ?? [])
          .filter((b) => b.batchNumber && !b.isExpired && Number(b.closing?.total) > 0)
          .map((b) => ({ no: b.batchNumber!, ubd: (b.ubd || b.expiryDate || "").slice(0, 10) || null, pieces: Number(b.closing!.total), shelfDays: Number(p.shelfLifeDays) || 0 }))
          .sort((a, b) => (a.ubd ?? "9999").localeCompare(b.ubd ?? "9999"));
        out.set(String(p.id), batches);
      }
    }
    return out;
  } catch {
    return null;
  }
}
