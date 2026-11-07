import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Contact, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Pill } from "@/components/cn/ui";
import { CustomerTabs } from "@/components/customers/CustomerTabs";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { CUSTOMER_KINDS, customerCounts, isCustomerKind, listD2c, listFirms } from "@/lib/customers";

export const dynamic = "force-dynamic";

const rs = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const day = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—";
const th = "whitespace-nowrap px-3 py-2 font-semibold";
const td = "px-3 py-2";

/** Customer Master: distributors, retailers or D2C customers, each with a link to its profile. */
export default async function CustomerListPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ q?: string }> }) {
  const { kind } = await params;
  if (!isCustomerKind(kind)) notFound();
  const q = ((await searchParams).q ?? "").trim();
  const info = CUSTOMER_KINDS.find((k) => k.key === kind)!;
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canAdd = kind !== "d2c" && !!me && atLeast(levelFor(me, "fp.distribution"), "edit");
  const [counts, firms, d2c] = await Promise.all([
    customerCounts(),
    kind === "d2c" ? Promise.resolve([]) : listFirms(kind, q),
    kind === "d2c" ? listD2c(q) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Contact}
          title={`Customer Master · ${info.label}`}
          subtitle={kind === "d2c"
            ? "Everyone who shops in the Gaia app: orders, spend and subscriptions. Open one for the full profile."
            : `Every ${info.one.toLowerCase()}: contact, who serves them, sales officer, price list, app login and orders. Open one for the full profile.`}
          actions={canAdd ? <Link href="/orders/distribution/new" className={buttonVariants({ variant: "primary" })}><Plus className="size-4" /> Add {info.one.toLowerCase()}</Link> : null}
        />
        <CustomerTabs on={kind} counts={counts} />
        <form className="flex max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={q} placeholder={kind === "d2c" ? "Search name, mobile, address, pincode" : "Search name, code, mobile, city, contact"}
              className="h-8 w-full rounded-lg border border-input bg-transparent pr-3 pl-8 text-sm focus:border-primary focus:outline-none" />
          </div>
          <button className="h-8 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Search</button>
          {q ? <Link href={`/customers/${kind}`} className="text-sm text-muted-foreground hover:underline">Clear</Link> : null}
        </form>

        <div className="overflow-x-auto rounded-lg border border-border">
          {kind === "d2c" ? (
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>{["Customer", "Mobile", "Address", "Joined", "Orders", "Spend", "Last order", "Subscriptions"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {d2c.map((c) => (
                  <tr key={c.id} className="border-t border-border align-top hover:bg-muted/40">
                    <td className={td}><Link href={`/d2c/customers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link></td>
                    <td className={`${td} font-mono text-xs`}>{c.phone}</td>
                    <td className={`${td} min-w-56 text-muted-foreground`}>{[c.address, c.pincode].filter(Boolean).join(" - ") || "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>{day(c.joined)}</td>
                    <td className={`${td} num text-right`}>{c.orders}</td>
                    <td className={`${td} num text-right`}>{rs(c.spend)}</td>
                    <td className={`${td} whitespace-nowrap`}>{day(c.last_order)}</td>
                    <td className={`${td} num text-right`}>{c.subscriptions || "—"}</td>
                  </tr>
                ))}
                {d2c.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">{q ? "No customer matches." : "No D2C customers yet."}</td></tr> : null}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>{[info.one, "Contact", "City", kind === "retailers" ? "Served by" : "Route", "Sales officer", "Price list", "App", "Orders", "Last order", "Last 90 days", "Status"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {firms.map((f) => (
                  <tr key={f.uid} className="border-t border-border align-top hover:bg-muted/40">
                    <td className={`${td} min-w-56`}>
                      <Link href={`/customers/firm/${f.uid}`} className="font-medium text-primary hover:underline">{f.name}</Link>
                      {f.code ? <div className="font-mono text-[11px] text-tertiary-foreground">{f.code}</div> : null}
                    </td>
                    <td className={td}><div>{f.contactPerson ?? "—"}</div><div className="font-mono text-xs text-muted-foreground">{f.phone ?? ""}</div></td>
                    <td className={td}>{f.city ?? "—"}</td>
                    <td className={td}>{(kind === "retailers" ? f.servedBy : f.route) ?? "—"}</td>
                    <td className={td}>{f.salesOfficer ?? "—"}</td>
                    <td className={td}>{f.priceList ?? <span className="text-muted-foreground">Standard</span>}</td>
                    <td className={td}>{f.appLogin ? <Pill tone="success">Login</Pill> : <Pill>No login</Pill>}</td>
                    <td className={`${td} num text-right`}>{f.orders || "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>{day(f.lastOrder)}</td>
                    <td className={`${td} num text-right`}>{f.value90 ? rs(f.value90) : "—"}</td>
                    <td className={td}>{f.active ? <Pill tone="success">Active</Pill> : <Pill>Inactive</Pill>}</td>
                  </tr>
                ))}
                {firms.length === 0 ? <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">{q ? "No customer matches." : `No ${info.label.toLowerCase()} yet.`}</td></tr> : null}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
