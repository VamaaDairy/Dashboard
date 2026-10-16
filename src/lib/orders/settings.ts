import { query, tx } from "@/lib/db";

export interface SettingDef {
  key: string; label: string; hint?: string; group: string; type: "number" | "time" | "select" | "text" | "bool";
  default: string; options?: string[];
}

/** Organisation-level switches the Orders section reads. Values are stored as text. */
export const SETTINGS: SettingDef[] = [
  { key: "default_credit_days", group: "Billing & collection", label: "Default credit days", type: "number", default: "15", hint: "Used for an invoice's due date when the customer has no credit days of their own." },
  { key: "cheque_bounce_charge", group: "Billing & collection", label: "Cheque bounce charge (₹)", type: "number", default: "0" },
  { key: "block_over_credit", group: "Billing & collection", label: "Warn when an order crosses the credit limit", type: "bool", default: "true" },
  { key: "eod_cutoff", group: "Day end", label: "End-of-day cut-off time", type: "time", default: "20:00", hint: "Attendance and visits after this time count for the next day." },
  { key: "min_visits_per_day", group: "Field force", label: "Minimum visits per day", type: "number", default: "3", hint: "Drives the green in the day-wise visit grid." },
  { key: "order_share_channel", group: "Order sharing", label: "Share confirmed orders by", type: "select", default: "whatsapp", options: ["whatsapp", "email", "none"] },
  { key: "invoice_footer", group: "Printing", label: "Invoice footer text", type: "text", default: "Thank you for your business." },
];

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>(`select key, value from ord_setting`);
  const out: Record<string, string> = Object.fromEntries(SETTINGS.map((s) => [s.key, s.default]));
  for (const r of rows) if (r.key in out) out[r.key] = r.value;
  return out;
}

export async function saveSettings(values: Record<string, string>): Promise<void> {
  const defs = new Map(SETTINGS.map((s) => [s.key, s]));
  await tx(async (db) => {
    for (const [k, raw] of Object.entries(values)) {
      const d = defs.get(k);
      if (!d) continue;
      const v = String(raw).trim();
      if (d.type === "number" && (v === "" || !Number.isFinite(Number(v)) || Number(v) < 0)) throw new Error(`${d.label}: enter a number`);
      if (d.type === "time" && !/^\d{2}:\d{2}$/.test(v)) throw new Error(`${d.label}: use a time like 20:00`);
      if (d.type === "select" && !d.options!.includes(v)) throw new Error(`${d.label}: not an option`);
      if (d.type === "bool" && v !== "true" && v !== "false") throw new Error(`${d.label}: invalid`);
      await db.query(
        `insert into ord_setting (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value, updated_at = now()`, [k, v]);
    }
  });
}

export interface SyncRow { entity: string; records: number; last_run: string | null; status: string | null; message: string | null }

const COUNTS: Record<string, string> = {
  customers: "ord_customer", products: "ord_product", inventory: "ord_stock_move", stock_transfer: "ord_van_transfer",
  bills: "ord_invoice", transactions: "ord_payment", orders: "ord_order", van_stock: "ord_van_transfer",
};

/** Per integration entity: rows held here and the latest sync-log entry. */
export async function syncStatus(): Promise<SyncRow[]> {
  const out: SyncRow[] = [];
  for (const [entity, table] of Object.entries(COUNTS)) {
    const [c] = await query<{ n: number }>(`select count(*)::int as n from ${table}`);
    const [l] = await query<{ run_at: string; status: string; message: string | null }>(
      `select to_char(run_at, 'DD Mon YYYY HH24:MI') as run_at, status, message from ord_sync_log where entity = $1 order by run_at desc limit 1`, [entity]);
    out.push({ entity, records: c.n, last_run: l?.run_at ?? null, status: l?.status ?? null, message: l?.message ?? null });
  }
  return out;
}
