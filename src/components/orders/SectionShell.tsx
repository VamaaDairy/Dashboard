import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

/** Placeholder page for an Orders subsection until its details are specified. */
export function SectionShell({
  icon, title, subtitle,
}: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <PageHeader icon={icon} title={title} subtitle={subtitle} />
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-[13px] text-tertiary-foreground">
          Nothing here yet - this page is set up and waiting for its details.
        </div>
      </div>
    </div>
  );
}
