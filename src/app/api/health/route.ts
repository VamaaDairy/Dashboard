import { pool, poolStats } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness + database check for uptime monitors and the deploy script. Public, so it reports no details beyond the
 * connection pool's counts (in use / idle / waiting): waiting above 0 for long means DB_POOL_MAX is too small.
 */
export async function GET() {
  const started = Date.now();
  try {
    await Promise.race([
      pool.query("select 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), 3000)),
    ]);
    return Response.json(
      { status: "ok", db: "up", uptime: Math.round(process.uptime()), ms: Date.now() - started, pool: poolStats() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("health: database check failed", e);
    return Response.json(
      { status: "degraded", db: "down", uptime: Math.round(process.uptime()) },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
