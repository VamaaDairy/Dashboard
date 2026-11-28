import { NextRequest, NextResponse } from "next/server";
import { plainCsv } from "@/lib/masters/csv";
import { CUSTOMER_KINDS, listFirms, type FirmKind } from "@/lib/customers";

export const dynamic = "force-dynamic";

/**
 * Every customer of one channel with every Customer Master column, narrowed by the same search and filters as the
 * list. The proxy has already checked the signed-in user can open the Customer Master.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const info = CUSTOMER_KINDS.find((k) => k.key === kind);
  if (!info || kind === "d2c") return new NextResponse("Not found", { status: 404 });
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const { rows } = await listFirms(kind as FirmKind, {
    q: sp.get("q") ?? "", type: sp.get("type"), state: sp.get("state"), officer: sp.get("officer"),
    status: status === "active" || status === "inactive" ? status : null,
  }, null);
  const csv = plainCsv(
    ["Code", "Name", "Type", "Class", "Status", "Contact person", "Phone", "City", "State", "Pincode", "GSTIN", "Tally name",
     "Served by", "Serves", "Route", "Sales officer", "Price list", "Credit limit", "App login", "Orders", "Last order", "Last 90 days", "Added"],
    rows.map((f) => [f.code, f.name, f.type, f.firmClass, f.active ? "Active" : "Inactive", f.contactPerson, f.phone, f.city, f.state, f.pincode,
      f.gstin, f.tallyName, f.servedBy, f.serves, f.route, f.salesOfficer, f.priceList ?? "Standard", f.creditLimit, f.appLogin, f.orders,
      f.lastOrder, Math.round(f.value90), f.created]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${kind}_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
