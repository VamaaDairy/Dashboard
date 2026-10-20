import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database check for uptime monitors and the deploy script. Public, so it reports no details. */
export async function GET() {
  const started = Date.now();
  try {
    await Promise.race([
      pool.query("select 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), 3000)),
    ]);
    return Response.json(
      { status: "ok", db: "up", uptime: Math.round(process.uptime()), ms: Date.now() - started },
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
