import { NextResponse, type NextRequest } from "next/server";
import { csvOf, type Col } from "@/lib/d2c/reports";
import { CUSTOMER_SORTS, listCustomers, type CustomerSort } from "@/lib/d2c/sales";

export const dynamic = "force-dynamic";

const COLS: Col[] = [
  { key: "name", label: "Customer", kind: "text" }, { key: "phone", label: "Mobile", kind: "mono" }, { key: "address", label: "Address", kind: "text" },
  { key: "pincode", label: "Pincode", kind: "mono" }, { key: "joined", label: "Joined", kind: "date" }, { key: "orders", label: "Orders", kind: "int" },
  { key: "spend", label: "Spend", kind: "money" }, { key: "first_order", label: "First order", kind: "date" }, { key: "last_order", label: "Last order", kind: "date" },
  { key: "subscriptions", label: "Active subscriptions", kind: "int" },
];

/** CSV of the Customer Master with the same search and sort as the page. The proxy has already checked access. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const s = req.nextUrl.searchParams.get("sort") ?? "newest";
  const rows = await listCustomers(q, (s in CUSTOMER_SORTS ? s : "newest") as CustomerSort);
  return new NextResponse(csvOf(COLS, rows as unknown as Array<Record<string, unknown>>), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="d2c-customers_${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
