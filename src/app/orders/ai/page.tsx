import { Sparkles } from "lucide-react";
import { Panel, StatusChip, TD, TH } from "@/components/orders/common";
import { SectionShell } from "@/components/orders/SectionShell";
import { pickTab, SectionTabs, type TabDef } from "@/components/orders/SectionTabs";
import { dedupCandidates, shelfWatch, suggestOrder } from "@/lib/orders/ai";
import { refOptions } from "@/lib/orders/crud";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [
  { key: "suggest", label: "Order suggestion" },
  { key: "dedup", label: "Dealer de-duplication" },
  { key: "shelf", label: "Shelf watch" },
];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const tab = pickTab(TABS, sp.t);
  return (
    <SectionShell icon={Sparkles} title="Smart tools" subtitle="Suggestions worked out from your own orders, customers and audits.">
      <SectionTabs path="/orders/ai" tabs={TABS} active={tab} />
      {tab === "suggest" && <Suggest customerId={sp.c} />}
      {tab === "dedup" && <Dedup />}
      {tab === "shelf" && <Shelf />}
    </SectionShell>
  );
}

async function Suggest({ customerId }: { customerId?: string }) {
  const customers = await refOptions("customer");
  const res = customerId ? await suggestOrder(customerId) : null;
  return (
    <Panel
      title="Suggested order for a customer"
      actions={
        <form action="/orders/ai" className="flex items-center gap-2">
          <input type="hidden" name="t" value="suggest" />
          <select name="c" defaultValue={customerId ?? ""} className="h-8 min-w-56 rounded-lg border border-border bg-background px-2 text-[13px]">
            <option value="">Pick a customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className="h-8 rounded-lg border border-border bg-white px-3 text-[12px] font-medium hover:bg-muted">Suggest</button>
        </form>
      }
    >
      {!res ? (
        <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">Pick a customer to see what to offer them.</p>
      ) : (
        <>
          <p className="border-b border-border px-4 py-2.5 text-[12px] text-muted-foreground">
            {res.mode === "repeat" ? `Based on ${res.customer}'s orders in the last 120 days - items that are due again.` : `${res.customer} has no orders yet - these sell best at similar outlets.`}
          </p>
          <table className="w-full text-[13px]">
            <thead className="border-b border-border bg-muted/40"><tr><th className={TH}>Product</th><th className={`${TH} text-right`}>Suggested qty</th><th className={TH}>Why</th></tr></thead>
            <tbody>
              {res.items.map((i) => (
                <tr key={i.sku} className="border-b border-border/70">
                  <td className={`${TD} font-medium text-foreground`}>{i.name} <span className="text-[11px] text-muted-foreground">{i.sku}</span></td>
                  <td className={`${TD} text-right tabular-nums`}>{i.qty}</td>
                  <td className={`${TD} text-muted-foreground`}>{i.reason}</td>
                </tr>
              ))}
              {res.items.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Not enough sales history to suggest anything.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}

async function Dedup() {
  const pairs = await dedupCandidates();
  return (
    <Panel title={`Possible duplicate customers (${pairs.length})`}>
      <table className="w-full text-[13px]">
        <thead className="border-b border-border bg-muted/40"><tr><th className={TH}>Customer A</th><th className={TH}>Customer B</th><th className={TH}>Why</th><th className={`${TH} text-right`}>Match</th></tr></thead>
        <tbody>
          {pairs.map((p) => (
            <tr key={p.a.id + p.b.id} className="border-b border-border/70">
              <td className={TD}><span className="font-medium text-foreground">{p.a.name}</span> <span className="text-[11px] text-muted-foreground">{p.a.code}{p.a.city ? ` · ${p.a.city}` : ""}</span></td>
              <td className={TD}><span className="font-medium text-foreground">{p.b.name}</span> <span className="text-[11px] text-muted-foreground">{p.b.code}{p.b.city ? ` · ${p.b.city}` : ""}</span></td>
              <td className={`${TD} text-muted-foreground`}>{p.why}</td>
              <td className={`${TD} text-right tabular-nums`}>{Math.round(p.score * 100)}%</td>
            </tr>
          ))}
          {pairs.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No likely duplicates found.</td></tr>}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">Matches on GSTIN, phone, or a near-identical name in the same city. Merge by marking one as inactive on the Customers page.</p>
    </Panel>
  );
}

async function Shelf() {
  const rows = await shelfWatch();
  return (
    <Panel title={`Outlets needing a shelf check (${rows.length})`}>
      <table className="w-full text-[13px]">
        <thead className="border-b border-border bg-muted/40"><tr><th className={TH}>Outlet</th><th className={TH}>Last audit</th><th className={`${TH} text-right`}>Score</th><th className={TH}>Issue</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/70">
              <td className={`${TD} font-medium text-foreground`}>{r.name}</td>
              <td className={`${TD} text-muted-foreground`}>{r.last_audit ?? "—"}</td>
              <td className={`${TD} text-right tabular-nums`}>{r.score ?? "—"}</td>
              <td className={TD}><StatusChip value={r.issue === "Never audited" ? "pending" : "rejected"} /> <span className="ml-1 text-[12px] text-muted-foreground">{r.issue}</span></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Every active retailer has a recent, passing audit.</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}
