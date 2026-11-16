import { Pool, types } from "pg";

// numeric -> JS number. Costing values stay well inside float64 precision and
// every consumer here does arithmetic on them.
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const globalForDb = globalThis as unknown as { pool?: Pool };

const envInt = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isInteger(v) && v > 0 ? v : fallback;
};

/**
 * One pool per server process. Sizes and limits come from .env so they can be raised without a code change:
 *  DB_POOL_MAX               connections this process may hold (default 20; Postgres allows 100 in all, so keep
 *                            DB_POOL_MAX x number of app processes well under that)
 *  DB_STATEMENT_TIMEOUT_MS   a query running longer is stopped (default 120 s) instead of holding a connection forever
 *  DB_IDLE_TX_TIMEOUT_MS     a transaction left open and idle is ended (default 60 s), so it cannot block others
 */
export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp",
    max: envInt("DB_POOL_MAX", 20),
    // wait at most this long for a free connection, then fail the request instead of hanging
    connectionTimeoutMillis: envInt("DB_CONNECT_TIMEOUT_MS", 10_000),
    // give idle connections back to Postgres after 30 s
    idleTimeoutMillis: 30_000,
    statement_timeout: envInt("DB_STATEMENT_TIMEOUT_MS", 120_000),
    idle_in_transaction_session_timeout: envInt("DB_IDLE_TX_TIMEOUT_MS", 60_000),
    application_name: process.env.DB_APP_NAME ?? "dashboard",
  });

// a connection that drops while idle (Postgres restarted, network blip) must not crash the server: log it, and the
// pool makes a fresh one on the next query
if (!globalForDb.pool) pool.on("error", (e) => console.error("[db] idle connection error:", e.message));

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

/** How busy the pool is, for /api/health. */
export const poolStats = () => ({ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options.max });

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
