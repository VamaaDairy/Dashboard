import { SlidersHorizontal } from "lucide-react";
import { ParameterTable } from "@/components/ParameterTable";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { getParameters } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ParametersPage() {
  const parameters = await getParameters();
  return (
    <div className="flex flex-col flex-1 bg-white p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={SlidersHorizontal}
          title="Parameters"
          subtitle="Every rate, percentage and factor the cost model leans on. Change one here and every formula that reads it recalculates."
          actions={
            <Badge variant="outline" className="border-blue-200 bg-blue-50/60 text-[#2B4C86] font-mono font-bold text-xs">
              {parameters.length} parameters
            </Badge>
          }
        />
        <ParameterTable parameters={parameters} />
      </div>
    </div>
  );
}
