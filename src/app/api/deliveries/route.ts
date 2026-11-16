import { NextResponse, type NextRequest } from "next/server";
import { apiCaller, apiError, can, forbidden, unauthorised } from "@/lib/api/access";
import { listSessions, sessionsOfOrder } from "@/lib/shop/delivery-session";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["assigned", "picked_up", "delivered", "unassigned", "reassigned", "cancelled"]);

/**
 * Delivery sessions (db/103_delivery_sessions.sql) - Dashboard sign-in or API key, with access to Online shop orders.
 *   ?order=<order id>              every session that order has had
 *   ?day=YYYY-MM-DD&rider=<id>&status=<status>&page=<n>   a day's sessions (100 a page), newest first
 */
export async function GET(req: NextRequest) {
  const caller = await apiCaller(req);
  if (!caller) return unauthorised();
  if (!can(caller, "shop", "view")) return forbidden();
  const p = req.nextUrl.searchParams;

  const order = p.get("order");
  if (order !== null) {
    const id = Number(order);
    if (!Number.isInteger(id) || id < 1) return apiError(400, "order must be the order's id.");
    return NextResponse.json({ sessions: await sessionsOfOrder(id) });
  }

  const day = p.get("day") ?? undefined;
  if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return apiError(400, "day must be YYYY-MM-DD.");
  const rider = p.get("rider");
  const riderId = rider === null ? undefined : Number(rider);
  if (riderId !== undefined && (!Number.isInteger(riderId) || riderId < 1)) return apiError(400, "rider must be the rider's id.");
  const status = p.get("status") ?? undefined;
  if (status && !STATUSES.has(status)) return apiError(400, `status must be one of ${[...STATUSES].join(", ")}.`);
  const page = Math.max(1, Math.floor(Number(p.get("page"))) || 1);
  return NextResponse.json(await listSessions({ day, riderId, status, page }));
}
