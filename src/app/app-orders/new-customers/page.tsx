import { cookies } from "next/headers";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";
import { REF_BEATS, REF_CHANNELS, REF_PARENT_FIRMS, REF_STAFF, SUGGEST_CUSTOMER_CLASS } from "@/lib/masters/refs";
import { firmRequests, nextFirmCodes } from "@/lib/distributor/requests";
import { priceLists } from "@/lib/price-list";
import { RequestCard } from "./request-card";

export const dynamic = "force-dynamic";

/** New customers sales officers proposed from the Sales app, or that signed up in the Gaia Distributors app, waiting for the office: approve (creates the customer) or reject. */
export default async function NewCustomersPage() {
  const [requests, channels, parents, beats, staff, classes, lists, codes, me] = await Promise.all([
    firmRequests(),
    query<{ value: string; label: string }>(REF_CHANNELS),
    query<{ value: string; label: string }>(REF_PARENT_FIRMS),
    query<{ value: string; label: string }>(REF_BEATS),
    query<{ value: string; label: string }>(REF_STAFF),
    query<{ value: string }>(SUGGEST_CUSTOMER_CLASS),
    priceLists(),
    nextFirmCodes(),
    userFromToken((await cookies()).get("session")?.value),
  ]);
  // what the office chooses when approving: who looks after it, its class and its rates
  const choices = {
    channels, parents, beats, staff, codes,
    classes: classes.map((c) => c.value),
    lists: lists.map((l) => ({ value: l.uid, label: `${l.name}${l.grp ? ` (${l.grp})` : ""} · ${l.priced} products` })),
  };
  const canEdit = !!me && atLeast(levelFor(me, "apporders"), "edit");
  const pending = requests.filter((r) => r.status === "pending");
  const done = requests.filter((r) => r.status !== "pending");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <PageHeader icon={UserPlus} title="New customers" subtitle="Parties a sales officer added in the Sales app, and distributors who onboarded themselves in the Gaia Distributors app. Approving creates the customer in Customer Masters with every detail they gave, sets its rates, and switches on their app login with the PIN they chose; they follow it under My application in the app." />
        <h2 className="text-[15px] font-semibold">Waiting for approval ({pending.length})</h2>
        {pending.length ? pending.map((r) => <RequestCard key={r.id} r={r} choices={choices} canEdit={canEdit} />)
          : <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">Nothing waiting.</div>}
        {done.length ? (
          <>
            <h2 className="pt-2 text-[15px] font-semibold">Decided (last 60 days)</h2>
            {done.map((r) => <RequestCard key={r.id} r={r} choices={choices} canEdit={false} />)}
          </>
        ) : null}
      </div>
    </div>
  );
}
