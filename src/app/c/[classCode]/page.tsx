import { notFound } from "next/navigation";
import { Table2 } from "lucide-react";
import { DataGrid } from "@/components/DataGrid";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { getGrid } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ClassGridPage({ params }: PageProps<"/c/[classCode]">) {
  const { classCode } = await params;
  const grid = await getGrid(classCode);
  if (!grid) notFound();

  return (
    <div className="flex h-screen flex-col gap-4 bg-background p-4 md:p-6">
      <PageHeader
        icon={Table2}
        title={grid.klass.plural_name ?? grid.klass.name}
        subtitle={
          <>
            Every cell is editable — a number, or a formula starting with{" "}
            <span className="font-mono">=</span>. Referenced elsewhere as{" "}
            <span className="font-mono">O.&lt;code&gt;.&lt;column&gt;</span>.
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-blue-200 bg-accent/60 text-foreground font-mono font-bold text-xs">
              {grid.rows.length} rows · {grid.fields.length} columns
            </Badge>
            <Badge variant="outline" className="border-blue-200 bg-accent/60 text-foreground font-mono font-bold text-xs">
              unit cost: {grid.klass.cost_field ?? "not set"}
            </Badge>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border shadow-xs">
        <DataGrid
          classId={grid.klass.id}
          classCode={grid.klass.code}
          fields={grid.fields}
          rows={grid.rows}
        />
      </div>
    </div>
  );
}
