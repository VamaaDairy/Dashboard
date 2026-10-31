import { MapPinned } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TeamLive } from "@/components/employee/TeamLive";
import { teamLive } from "@/lib/employee/admin";
import { Page } from "../ui";

export const dynamic = "force-dynamic";

/** Where the sales team is right now, what they have done today, and the route any of them walked on any day. */
export default async function LiveTeamPage() {
  return (
    <Page>
      <PageHeader icon={MapPinned} title="Live team" subtitle="Location is tracked only while an employee's sales day is on. Positions refresh every 15 seconds." />
      <TeamLive initial={await teamLive()} />
    </Page>
  );
}
