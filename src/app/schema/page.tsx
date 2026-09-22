import { Settings2 } from "lucide-react";
import { SchemaEditor } from "@/components/SchemaEditor";
import { PageHeader } from "@/components/ui/page-header";
import { getSchema } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SchemaPage() {
  const classes = await getSchema();
  return (
    <div className="flex flex-col flex-1 bg-background p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Settings2}
          title="Columns & classes"
          subtitle="Classes are the kinds of things you cost; columns are what each one carries. Add a column with a default formula and every row picks it up — unless it overrides it."
        />
        <SchemaEditor classes={classes} />
      </div>
    </div>
  );
}
