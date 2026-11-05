import { NextResponse, type NextRequest } from "next/server";
import { labourWorkbook } from "@/lib/daily/labour-export";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * The Labour page as an Excel file. ?from=YYYY-MM-DD&to=YYYY-MM-DD (default: this month so far). The proxy has
 * already checked the signed-in user can open /labour.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const now = today();
  let from = isDay(sp.get("from")) ? sp.get("from")! : `${now.slice(0, 7)}-01`;
  let to = isDay(sp.get("to")) ? sp.get("to")! : now;
  if (from > to) [from, to] = [to, from];
  const file = await labourWorkbook(from, to);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="labour_${from}_to_${to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
