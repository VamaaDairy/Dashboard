import Link from "next/link";
import { cookies } from "next/headers";
import { Download, Search, Users } from "lucide-react";
import { CustomerTabs } from "@/components/customers/CustomerTabs";
import { userFromToken } from "@/lib/access-server";
import { levelFor } from "@/lib/access";
import { customerCounts } from "@/lib/customers";
import { PageHeader } from "@/components/ui/page-header";
import { Tiles } from "@/components/dash/Dash";
import { CUSTOMER_SORTS, listCustomers, type CustomerSort } from "@/lib/d2c/sales";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SORT_LABEL: Record<CustomerSort, string> = { newest: "Newest", spend: "Top spend", orders: "Most orders", recent: "Last order", name: "Name" };
const rs = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const date = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—";
const daysSince = (d: Date | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null);

/** Customer Master: everyone who has made an account in the Gaia app, with what they buy. */
export default async function D2cCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const sort = (sp.sort && sp.sort in CUSTOMER_SORTS ? sp.sort : "newest") as CustomerSort;
  const customers = await listCustomers(q, sort);
  // the Customer Master's other tabs, for those who can open them
  const me = await userFromToken((await cookies()).get("session")?.value);
  const counts = me && levelFor(me, "customers") !== "none" ? await customerCounts() : null;
  const all = q ? await listCustomers("", "newest") : customers;
  const buyers = all.filter((c) => c.orders > 0);
  const repeat = all.filter((c) => c.orders > 1);
  const subs = all.filter((c) => c.subscriptions > 0);
  const spend = all.reduce((s, c) => s + c.spend, 0);
  const thisMonth = all.filter((c) => {
    const j = new Date(c.joined), now = new Date();
    return j.getFullYear() === now.getFullYear() && j.getMonth() === now.getMonth();
  });
  const href = (s: string) => `/d2c/customers?${new URLSearchParams({ ...(q ? { q } : {}), sort: s })}`;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <PageHeader
          icon={Users}
          title="Customer Master · D2C"
          subtitle="Everyone with an account in the Gaia Dairy app: contact, address, orders, spend and subscriptions."
          actions={
            <a href={`/d2c/customers/export?${new URLSearchParams({ q, sort })}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <Download className="h-4 w-4" /> Download CSV
            </a>
          }
        />
        {counts ? <CustomerTabs on="d2c" counts={counts} /> : null}
        <Tiles
          items={[
            { label: "Customers", value: all.length.toLocaleString("en-IN"), note: `${thisMonth.length} joined this month` },
            { label: "Have ordered", value: buyers.length.toLocaleString("en-IN"), note: all.length ? `${Math.round((buyers.length / all.length) * 100)}% of accounts` : undefined },
            { label: "Repeat buyers", value: repeat.length.toLocaleString("en-IN"), note: buyers.length ? `${Math.round((repeat.length / buyers.length) * 100)}% of buyers` : undefined },
            { label: "On subscription", value: subs.length.toLocaleString("en-IN") },
            { label: "Total spend", value: rs(spend) },
            { label: "Avg spend / buyer", value: rs(buyers.length ? spend / buyers.length : 0) },
          ]}
        />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5 text-sm">
            {(Object.keys(SORT_LABEL) as CustomerSort[]).map((s) => (
              <Link key={s} href={href(s)} className={cn("rounded-full border px-3 py-1", s === sort ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                {SORT_LABEL[s]}
              </Link>
            ))}
          </div>
          <form className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input name="q" defaultValue={q} placeholder="Search name, mobile, address, pincode" className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm" />
            <input type="hidden" name="sort" value={sort} />
          </form>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {["Customer", "Mobile", "Address", "Joined", "Orders", "Spend", "Last order", "Subscriptions", "Status"].map((h) => (
                  <th key={h} className={cn("whitespace-nowrap px-3 py-2 font-semibold", ["Orders", "Spend", "Subscriptions"].includes(h) && "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const idle = daysSince(c.last_order);
                const status = c.orders === 0 ? "No orders yet" : idle != null && idle > 30 ? `Inactive ${idle} days` : "Active";
                return (
                  <tr key={c.id} className="border-t border-border align-top hover:bg-muted/40">
                    <td className="px-3 py-2"><Link href={`/d2c/customers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link></td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{c.phone}</td>
                    <td className="min-w-56 max-w-80 px-3 py-2 text-muted-foreground"><div className="line-clamp-2">{c.address ?? "—"}{c.pincode ? ` - ${c.pincode}` : ""}</div></td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{date(c.joined)}</td>
                    <td className="num px-3 py-2 text-right">{c.orders}</td>
                    <td className="num whitespace-nowrap px-3 py-2 text-right font-medium">{rs(c.spend)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{date(c.last_order)}</td>
                    <td className="num px-3 py-2 text-right">{c.subscriptions || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{status}</td>
                  </tr>
                );
              })}
              {customers.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">{q ? "No customer matches." : "No customers yet."}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
