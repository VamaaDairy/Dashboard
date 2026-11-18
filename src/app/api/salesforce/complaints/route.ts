import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { distOrderUid } from "@/lib/distributor";
import { sfFromRequest } from "@/lib/salesforce";
import { APP_CATEGORIES, raiseTrade, readComplaint, tradeComplaints } from "@/lib/cn/app";

export const dynamic = "force-dynamic";

/** Complaints this sales officer raised for their parties, newest first, and the problem types to pick from. */
export async function GET(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  return NextResponse.json({ categories: APP_CATEGORIES, complaints: await tradeComplaints(login) });
}

/**
 * Raise a complaint for a party about one of the orders on the officer's Orders list.
 * Body: { orderId, category, description, lines: [{ sku, qty }], photos?: [base64, at most 3] }.
 */
export async function POST(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "sf-complaint", 20)) return fail(429, "Too many complaints at once. Please wait a minute.");
  const b = (await readJson(req, 9_000_000)) as { orderId?: unknown } | null;
  const orderId = Number(b?.orderId);
  if (!b || !Number.isInteger(orderId)) return fail(400, "Pick the order the complaint is about.");
  const uid = await distOrderUid(login, orderId);
  if (!uid) return fail(404, "Order not found.");
  const i = readComplaint(b);
  if (typeof i === "string") return fail(400, i);
  const r = await raiseTrade(login, "salesforce", uid, i);
  if (!r.ok) return fail(400, r.error);
  const all = await tradeComplaints(login);
  return NextResponse.json({ complaint: all.find((c) => c.complaintNo === r.complaintNo) ?? null }, { status: 201 });
}
