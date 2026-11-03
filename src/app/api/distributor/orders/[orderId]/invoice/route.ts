import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { distFromRequest, distOrderUid } from "@/lib/distributor";
import { invoiceFor } from "@/lib/distributor/invoice";

export const dynamic = "force-dynamic";

/** The GST invoice of one of this login's orders (issued now if the order is older than invoices). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const id = Number((await params).orderId);
  const uid = Number.isInteger(id) && id > 0 ? await distOrderUid(login, id) : null;
  if (!uid) return fail(404, "Order not found.");
  const invoice = await invoiceFor(uid);
  return invoice ? NextResponse.json({ invoice }) : fail(404, "Order not found.");
}
