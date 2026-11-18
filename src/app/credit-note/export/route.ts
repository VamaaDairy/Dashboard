import { NextResponse, type NextRequest } from "next/server";
import { creditNoteWorkbook } from "@/lib/creditnote/export";
import { readFilter } from "@/lib/creditnote/filters";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Credit notes as an Excel file. ?from=YYYY-MM-DD&to=YYYY-MM-DD (challan date; default: this month so far), plus any
 * of the page's other filters (status, customer, product, reason, team, checked, approver, q). The proxy has already
 * checked the signed-in user can open /credit-note.
 */
export async function GET(req: NextRequest) {
  const f = readFilter(Object.fromEntries(req.nextUrl.searchParams));
  const now = today();
  if (!f.from) f.from = `${now.slice(0, 7)}-01`;
  if (!f.to) f.to = now;
  if (f.from > f.to) [f.from, f.to] = [f.to, f.from];
  const { file } = await creditNoteWorkbook(f);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="credit_notes_${f.from}_to_${f.to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
