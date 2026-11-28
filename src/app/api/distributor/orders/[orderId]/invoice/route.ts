import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { distFromRequest, distOrderUid } from "@/lib/distributor";
import { invoiceFor } from "@/lib/distributor/invoice";
import { isPlantOrder, tallyInvoicesFor } from "@/lib/distributor/tally-invoice";

export const dynamic = "force-dynamic";

/**
 * The bill of one of this login's orders. An order from the plant: its Tally bill (made in Route orders > Billing),
 * none until then. An order supplied by a distributor: that distributor's GST invoice (issued now if older).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const id = Number((await params).orderId);
  const uid = Number.isInteger(id) && id > 0 ? await distOrderUid(login, id) : null;
  if (!uid) return fail(404, "Order not found.");
  if (await isPlantOrder(uid)) {
    const bills = await tallyInvoicesFor(uid);
    if (!bills.length) return fail(404, "The bill for this order isn't made yet. It shows here once Gaia makes it.");
    return NextResponse.json({ invoice: bills[0], invoices: bills });
  }
  const invoice = await invoiceFor(uid);
  return invoice ? NextResponse.json({ invoice }) : fail(404, "Order not found.");
}
