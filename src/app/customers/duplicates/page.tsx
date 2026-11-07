import Link from "next/link";
import { Copy } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/cn/ui";
import { CustomerTabs } from "@/components/customers/CustomerTabs";
import { CUSTOMER_KINDS, customerCounts, duplicates, profileHref } from "@/lib/customers";

export const dynamic = "force-dynamic";

/**
 * The same mobile number on more than one customer: one shop entered twice, or a retailer who also shops in the
 * D2C app. Open each record to merge or correct it.
 */
export default async function CustomerDuplicatesPage() {
  const [counts, groups] = await Promise.all([customerCounts(), duplicates()]);
  const one = (k: string) => CUSTOMER_KINDS.find((c) => c.key === k)?.one ?? k;
  const crossList = groups.filter((g) => new Set(g.records.map((r) => r.kind)).size > 1).length;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Copy}
          title="Customer Master · Same mobile twice"
          subtitle="Mobile numbers that are on more than one customer record. Within one list it is usually the same shop entered twice; across lists it is one person who is, say, a retailer and also a D2C customer."
        />
        <CustomerTabs on="duplicates" counts={counts} duplicates={groups.length} />
        <p className="text-sm text-muted-foreground">{groups.length} mobile number{groups.length === 1 ? "" : "s"} repeat · {crossList} across lists</p>
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.mobile} className="overflow-hidden rounded-lg border border-border bg-card">
              <header className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-sm">
                <span className="font-mono font-semibold">{g.mobile}</span>
                <span className="text-xs text-muted-foreground">{g.records.length} records</span>
              </header>
              <ul className="divide-y divide-border text-sm">
                {g.records.map((r) => (
                  <li key={`${r.kind}-${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2">
                    <Pill tone={r.kind === "d2c" ? "info" : "brand"}>{one(r.kind)}</Pill>
                    <Link href={profileHref(r.kind, r.id)} className="font-medium text-primary hover:underline">{r.name}</Link>
                    {r.detail ? <span className="text-xs text-muted-foreground">{r.detail}</span> : null}
                    {r.active ? null : <Pill>Inactive</Pill>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 ? <p className="rounded-lg border border-border px-4 py-10 text-center text-sm text-muted-foreground">No mobile number is on more than one customer.</p> : null}
        </div>
      </div>
    </div>
  );
}
