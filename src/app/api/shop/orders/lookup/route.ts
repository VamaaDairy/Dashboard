import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { fail, orderJson, readJson, tooMany } from "@/lib/shop/api";
import { getOrderByKey } from "@/lib/shop/orders";

export const dynamic = "force-dynamic";

/**
 * The app asks for its own orders: { keys: [accessKey, ...] } (up to 50, newest first).
 * An order can only be read by someone holding its secret key, so there is no way to list other people's orders.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "lookup", 30)) return fail(429, "Too many requests. Please wait a minute.");
  const body = (await readJson(req)) as { keys?: unknown } | null;
  if (!body || !Array.isArray(body.keys)) return fail(400, "Send { keys: [...] }.");

  const keys = [...new Set(body.keys.filter((k): k is string => typeof k === "string" && /^[0-9a-f]{32}$/.test(k)))].slice(0, 50);
  if (!keys.length) return NextResponse.json({ orders: [] });

  const found = await query<{ access_key: string }>(
    `select access_key from shop_order where access_key = any($1) order by created_at desc`,
    [keys],
  );
  const orders = (await Promise.all(found.map((f) => getOrderByKey(f.access_key)))).filter((o) => o !== null);
  return NextResponse.json({ orders: orders.map((o) => orderJson(o!)) });
}
