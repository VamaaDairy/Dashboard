import Link from "next/link";
import { Mail, RefreshCw, Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Statements } from "@/components/outstandings/Statements";
import { getSettings } from "@/lib/outstandings/store";
import { outstandingDebtors, type Debtor } from "@/lib/outstandings/statement";

export const dynamic = "force-dynamic";

export default async function StatementsPage({ searchParams }: PageProps<"/outstandings/statements">) {
  const sp = await searchParams;
  const refresh = (Array.isArray(sp.refresh) ? sp.refresh[0] : sp.refresh) === "1";

  let debtors: Debtor[] = [];
  let error = "";
  try {
    debtors = await outstandingDebtors(refresh);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const settings = await getSettings();

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <PageHeader
          icon={Mail}
          title="Statements"
          subtitle="Email each outstanding party its account statement, from the Tally balance sheet."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/outstandings" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] hover:bg-muted">
                <Scale className="h-4 w-4" /> Balance sheet
              </Link>
              <Link href="/outstandings/statements?refresh=1" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] hover:bg-muted">
                <RefreshCw className="h-4 w-4" /> Refresh from Tally
              </Link>
            </div>
          }
        />
        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-[13px] text-red-700 dark:text-red-400">{error}</div>
        ) : (
          <Statements debtors={debtors} settings={settings} />
        )}
      </div>
    </div>
  );
}
