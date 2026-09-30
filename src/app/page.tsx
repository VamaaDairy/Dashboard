import { Home } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Left empty on purpose for now - it will summarise the day once everything else is set up. */
export default function TodayPage() {
  const pretty = new Date(`${today()}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader icon={Home} title="Today" subtitle={pretty} />
      </div>
    </div>
  );
}
