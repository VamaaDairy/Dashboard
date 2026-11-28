import { NextRequest, NextResponse } from "next/server";
import { plainCsv } from "@/lib/masters/csv";
import { isWingTab, listEmployees } from "@/lib/employees";

export const dynamic = "force-dynamic";

/**
 * One group's employees with every Employee Master column, narrowed by the same search and filters as the list.
 * The proxy has already checked the signed-in user can open the Employee Master.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ wing: string }> }) {
  const { wing } = await ctx.params;
  if (!isWingTab(wing)) return new NextResponse("Not found", { status: 404 });
  const sp = req.nextUrl.searchParams;
  const dept = sp.get("dept");
  const status = sp.get("status");
  const rows = await listEmployees(wing, sp.get("q") ?? "", dept && /^\d+$/.test(dept) ? Number(dept) : undefined, {
    status: status === "active" || status === "left" ? status : null, designation: sp.get("designation") || null,
  });
  const csv = plainCsv(
    ["Code", "Name", "Designation", "Department", "Status", "Mobile", "Email", "City", "State", "Reports to", "Customers", "Joined", "Left",
     "Employee app", "Salesforce app", "Dashboard"],
    rows.map((r) => [r.code, r.name, r.designation, r.department, r.active ? "Active" : "Left", r.phone, r.email, r.city, r.state, r.manager,
      r.customers, r.joined, r.left, r.employeeApp, r.salesforceApp, r.dashboard ? r.dashboard.email : ""]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="employees-${wing}_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
