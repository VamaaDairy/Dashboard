import Link from "next/link";
import { Network } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { OrgChart } from "@/components/hierarchy/OrgChart";
import { customerNodes, employeeNodes } from "@/lib/hierarchy";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Admin > Hierarchy (owners only): the Employee Master as a reporting chart and the Customer Master as a
 * who-serves-whom chart. Read-only; change a manager or who serves a customer on their profile.
 */
export default async function HierarchyPage({ searchParams }: { searchParams: Promise<{ of?: string; inactive?: string }> }) {
  const sp = await searchParams;
  const of = sp.of === "customers" ? "customers" : "employees";
  const inactive = sp.inactive === "1";
  const nodes = of === "employees" ? await employeeNodes(inactive) : await customerNodes(inactive);
  const href = (o: string, i: boolean) => `/hierarchy?of=${o}${i ? "&inactive=1" : ""}`;
  const tab = (on: boolean) =>
    cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Network}
          title="Hierarchy"
          subtitle={of === "employees"
            ? "Employee Master as a chart: who reports to whom. Change someone's reporting manager on their profile."
            : "Customer Master as a chart: Gaia > super stockist > distributor > retailer. Change who serves a customer on their profile."}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={href("employees", inactive)} className={tab(of === "employees")}>Employees</Link>
          <Link href={href("customers", inactive)} className={tab(of === "customers")}>Customers</Link>
          <Link href={href(of, !inactive)} className="ml-2 text-[13px] text-muted-foreground hover:underline">
            {inactive ? "Hide inactive" : "Show inactive too"}
          </Link>
        </div>
        <OrgChart
          key={`${of}-${inactive}`}
          kind={of}
          nodes={nodes}
          rootLabel="Gaia"
          openDepth={of === "employees" ? 2 : 1}
          unit={of === "employees" ? "employees" : "customers"}
        />
      </div>
    </div>
  );
}
