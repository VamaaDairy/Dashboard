import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";

/** Page frame shared by every Orders subsection: header, then the section's content. */
export function SectionShell({
  icon, title, subtitle, actions, children,
}: { icon: LucideIcon; title: string; subtitle: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <PageHeader icon={icon} title={title} subtitle={subtitle} actions={actions} />
        {children}
      </div>
    </div>
  );
}
