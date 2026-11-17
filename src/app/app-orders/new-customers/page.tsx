import { cookies } from "next/headers";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";
import { REF_BEATS, REF_CHANNELS, REF_PARENT_FIRMS } from "@/lib/masters/refs";
import { firmRequests } from "@/lib/distributor/requests";
import { RequestCard } from "./request-card";

export const dynamic = "force-dynamic";

/** New customers sales officers proposed from the Sales app, or that signed up in the Gaia Distributors app, waiting for the office: approve (creates the customer) or reject. */
export default async function NewCustomersPage() {
  const [requests, channels, parents, beats, me] = await Promise.all([
    firmRequests(),
    query<{ value: string; label: string }>(REF_CHANNELS),
    query<{ value: string; label: string }>(REF_PARENT_FIRMS),
    query<{ value: string; label: string }>(REF_BEATS),
    userFromToken((await cookies()).get("session")?.value),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "apporders"), "edit");
  const pending = requests.filter((r) => r.status === "pending");
  const done = requests.filter((r) => r.status !== "pending");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <PageHeader icon={UserPlus} title="New customers" subtitle="Parties a sales officer added in the Sales app, and distributors and retailers who signed up in the Gaia Distributors app. Approving creates the customer in Customer Masters (and, for an app sign-up, switches on their login)." />
        <h2 className="text-[15px] font-semibold">Waiting for approval ({pending.length})</h2>
        {pending.length ? pending.map((r) => <RequestCard key={r.id} r={r} channels={channels} parents={parents} beats={beats} canEdit={canEdit} />)
          : <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">Nothing waiting.</div>}
        {done.length ? (
          <>
            <h2 className="pt-2 text-[15px] font-semibold">Decided (last 60 days)</h2>
            {done.map((r) => <RequestCard key={r.id} r={r} channels={channels} parents={parents} beats={beats} canEdit={false} />)}
          </>
        ) : null}
      </div>
    </div>
  );
}
