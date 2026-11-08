import Link from "next/link";
import { ListChecks, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, Pill, StatCard } from "@/components/cn/ui";
import { PricingTabs } from "@/components/pricing/PricingTabs";
import { channels, priceLists } from "@/lib/price-list";
import { pricedCustomers } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Customer prices: every trade customer (distributors, retailers, super stockists ...) with the price list they are on.
 * Open one for its full price sheet - what the Gaia app charges it for each SKU, and why.
 */
export default async function CustomerPricesPage({ searchParams }: { searchParams: Promise<{ q?: string; channel?: string; list?: string }> }) {
  const sp = await searchParams;
  const [rows, chans, lists] = await Promise.all([pricedCustomers(sp), channels(), priceLists()]);
  const onList = rows.filter((r) => r.listUid).length;

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, channel: sp.channel, list: sp.list, ...patch })) if (v) p.set(k, v);
    return p.size ? `/price-list/customers?${p}` : "/price-list/customers";
  };
  const chip = (on: boolean) => cn("rounded-full border px-2.5 py-1 text-[12px]", on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <PageHeader icon={Users} title="Customer prices" subtitle="Each trade customer and the prices they get. Open a customer for their full price sheet, exactly as the Gaia app charges them." />
        <PricingTabs on="customers" />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Users} label="Customers shown" value={rows.length.toLocaleString("en-IN")} note={rows.length >= 1000 ? "first 1,000 - search to narrow" : undefined} />
          <StatCard icon={ListChecks} label="On a party list" value={onList.toLocaleString("en-IN")} tone="brand" />
          <StatCard icon={Users} label="On channel prices" value={(rows.length - onList).toLocaleString("en-IN")} href={link({ list: "none" })} />
          <StatCard icon={ListChecks} label="Party price lists" value={String(lists.length)} href="/price-list/lists" />
        </div>

        <Panel flush>
          <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:flex-wrap lg:items-center">
            <form action="/price-list/customers" className="relative lg:w-80">
              {sp.channel ? <input type="hidden" name="channel" value={sp.channel} /> : null}
              {sp.list ? <input type="hidden" name="list" value={sp.list} /> : null}
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input name="q" defaultValue={sp.q} placeholder="Search name, code or city" className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus:border-foreground" />
            </form>
            <div className="flex flex-wrap gap-1.5">
              <Link href={link({ channel: undefined })} className={chip(!sp.channel)}>All channels</Link>
              {chans.map((c) => <Link key={c.uid} href={link({ channel: c.code })} className={chip(sp.channel?.toUpperCase() === c.code)}>{c.name}</Link>)}
            </div>
            <form action="/price-list/customers" className="lg:ml-auto">
              {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
              {sp.channel ? <input type="hidden" name="channel" value={sp.channel} /> : null}
              <select name="list" defaultValue={sp.list ?? ""} className="h-9 rounded-lg border border-input bg-background px-2.5 text-[13px]" aria-label="Price list">
                <option value="">Any price list</option>
                <option value="none">No list (channel prices)</option>
                {lists.map((l) => <option key={l.uid} value={l.uid}>{l.name}</option>)}
              </select>
              <button className="ml-1.5 h-9 rounded-lg border border-border px-3 text-[13px] hover:bg-muted">Filter</button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-2 py-2.5">Channel</th>
                  <th className="px-2 py-2.5">City</th>
                  <th className="px-2 py-2.5">Price list</th>
                  <th className="px-2 py-2.5 text-right">Special prices</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.uid} className="border-t border-border hover:bg-muted/30">
                    <td className="min-w-64 px-4 py-2">
                      <Link href={`/price-list/customers/${r.uid}`} className="font-medium text-foreground hover:underline">{r.name}</Link>
                      <div className="font-mono text-[11px] text-tertiary-foreground">{r.code}</div>
                    </td>
                    <td className="px-2 py-2">{r.channel ?? "—"}</td>
                    <td className="px-2 py-2">{r.city ?? "—"}</td>
                    <td className="px-2 py-2">
                      {r.listUid ? <Link href={`/price-list/lists?list=${r.listUid}`} className="hover:underline">{r.list}</Link> : <span className="text-tertiary-foreground">Channel prices</span>}
                    </td>
                    <td className="num px-2 py-2 text-right">{r.listUid ? r.listPriced : <span className="text-tertiary-foreground">—</span>}</td>
                    <td className="px-4 py-2">{r.active ? <Pill tone="success">Active</Pill> : <Pill>Inactive</Pill>}</td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No customers match.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
