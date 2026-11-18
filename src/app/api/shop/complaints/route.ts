import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { APP_CATEGORIES, d2cComplaints, raiseD2c, readComplaint } from "@/lib/cn/app";

export const dynamic = "force-dynamic";

/** The signed-in customer's complaints, newest first, and the problem types they can pick. */
export async function GET(req: NextRequest) {
  const me = await customerFromRequest(req);
  if (!me) return fail(401, "Please sign in again.");
  return NextResponse.json({ categories: APP_CATEGORIES, complaints: await d2cComplaints(me.id) });
}

/**
 * Report a problem with one of their orders.
 * Body: { orderNo, category, description, lines: [{ sku, qty }], photos?: [base64 JPEG/PNG, at most 3] }.
 */
export async function POST(req: NextRequest) {
  const me = await customerFromRequest(req);
  if (!me) return fail(401, "Please sign in again.");
  if (tooMany(req, "d2c-complaint", 10)) return fail(429, "Too many complaints at once. Please wait a minute.");
  const b = (await readJson(req, 9_000_000)) as { orderNo?: unknown } | null;
  if (!b || typeof b.orderNo !== "string") return fail(400, "Pick the order the complaint is about.");
  const i = readComplaint(b);
  if (typeof i === "string") return fail(400, i);
  const r = await raiseD2c(me, b.orderNo, i);
  if (!r.ok) return fail(400, r.error);
  const all = await d2cComplaints(me.id);
  return NextResponse.json({ complaint: all.find((c) => c.complaintNo === r.complaintNo) ?? null }, { status: 201 });
}
