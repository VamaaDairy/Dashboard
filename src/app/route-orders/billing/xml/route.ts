import { NextResponse, type NextRequest } from "next/server";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { billsForExport, validDate } from "@/lib/route-orders/data";
import { tallyXml } from "@/lib/route-orders/tally-xml";

/** The day's live bills as a Tally import file. */
export async function GET(req: NextRequest) {
  const me = await userFromToken(req.cookies.get("session")?.value);
  if (!me || !atLeast(levelFor(me, "routeorders.billing"), "view")) return new NextResponse("Not allowed", { status: 403 });
  const date = validDate(req.nextUrl.searchParams.get("date") ?? undefined);
  const bills = await billsForExport(date);
  if (!bills.length) return new NextResponse("No bills for this date", { status: 404 });
  return new NextResponse(tallyXml(bills), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="Tally_Sales_${date}.xml"`,
      "Cache-Control": "no-store",
    },
  });
}
