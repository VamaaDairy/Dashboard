import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ChevronLeft, ChevronRight, Contact, Download, List, Network, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Pill } from "@/components/cn/ui";
import { CustomerTabs } from "@/components/customers/CustomerTabs";
import { RowActions } from "@/components/masters/RowActions";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { CUSTOMER_KINDS, FIRM_PAGE, customerCounts, firmFilterOptions, firmTypes, isCustomerKind, listFirms, servedBy, type FirmFilter, type FirmKind, type FirmRow } from "@/lib/customers";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const rs = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const day = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—";
const th = "whitespace-nowrap px-3 py-2 font-semibold";
const td = "px-3 py-2";

/**
 * Customer Master, one sub-section per channel (super stockists, distributors, MFS, institutions, parlours, retailers;
 * D2C customers are /d2c/customers), each with a link to every profile. Firms can be narrowed to one type (GT / ATP, the MFS chain, the institution
 * group) and shown as a list or as a hierarchy: grouped by type (retailers: by who serves them), each with the
 * customers it serves underneath.
 */
export default async function CustomerListPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ q?: string; type?: string; view?: string; status?: string; state?: string; officer?: string; page?: string }> }) {
  const { kind } = await params;
  if (!isCustomerKind(kind)) notFound();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  // D2C customers have one page: /d2c/customers
  if (kind === "d2c") redirect(`/d2c/customers${q ? `?${new URLSearchParams({ q })}` : ""}`);
  const type = (sp.type ?? "").trim() || null;
  const tree = sp.view === "tree";
  const status = sp.status === "active" || sp.status === "inactive" ? sp.status : null;
  const state = (sp.state ?? "").trim() || null;
  const officer = (sp.officer ?? "").trim() || null;
  const page = Math.max(1, Number(sp.page) || 1);
  const filter: FirmFilter = { q, type, status, state, officer };
  const info = CUSTOMER_KINDS.find((k) => k.key === kind)!;
  const me = await userFromToken((await cookies()).get("session")?.value);
  // adding, editing, deactivating and deleting customers: the Customer Master's edit right
  const canAdd = !!me && atLeast(levelFor(me, "fp.distribution"), "edit");
  const [counts, listing, types, options] = await Promise.all([customerCounts(), listFirms(kind, filter, page), firmTypes(kind), firmFilterOptions(kind)]);
  const firms = listing.rows;
  const pages = Math.max(1, Math.ceil(listing.total / FIRM_PAGE));
  // the hierarchy: who each shown customer serves (one level down)
  const children = tree ? await servedBy(firms.filter((f) => f.serves > 0).map((f) => f.uid)) : new Map();
  const href = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const all: Record<string, string | null> = { q: q || null, type, view: tree ? "tree" : null, status, state, officer, page: null, ...over };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/customers/${kind}${qs ? `?${qs}` : ""}`;
  };
  const exportHref = `/customers/${kind}/export?${new URLSearchParams(Object.entries({ q, type, status, state, officer }).filter((e): e is [string, string] => !!e[1])).toString()}`;
  const narrowed = !!(q || status || state || officer);
  const select = "h-8 max-w-[11rem] rounded-lg border border-input bg-background px-2 text-sm";
  const chip = (on: boolean) => cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px]", on ? "border-primary bg-primary/10 font-medium text-primary" : "border-border hover:bg-muted");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Contact}
          title={`Customer Master · ${info.label}`}
          subtitle={`${info.about} Contact, who serves them, sales officer, price list, app login and orders; open one for the full profile.`}
          actions={(
            <div className="flex items-center gap-2">
              <a href={exportHref} className={buttonVariants({ variant: "outline" })}><Download className="size-4" /> Export</a>
              {canAdd ? <Link href="/customers/new" className={buttonVariants({ variant: "primary" })}><Plus className="size-4" /> Add {info.one.toLowerCase()}</Link> : null}
            </div>
          )}
        />
        <CustomerTabs on={kind} counts={counts} showD2c={!!me && levelFor(me, "d2c.customers") !== "none"} />
        <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-input p-0.5">
              <Link href={href({ view: null })} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px]", !tree ? "bg-primary text-primary-foreground" : "hover:bg-muted")}><List className="size-3.5" /> List</Link>
              <Link href={href({ view: "tree" })} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px]", tree ? "bg-primary text-primary-foreground" : "hover:bg-muted")}><Network className="size-3.5" /> Hierarchy</Link>
            </div>
            {types.length > 1 ? (
              <>
                <span className="ml-1 text-[12px] text-muted-foreground">Type</span>
                <Link href={href({ type: null })} className={chip(!type)}>All <span className="num opacity-70">{types.reduce((a, t) => a + t.n, 0).toLocaleString("en-IN")}</span></Link>
                {types.slice(0, 14).map((t) => (
                  <Link key={t.type} href={href({ type: t.type })} className={chip(type === t.type)}>{t.type} <span className="num opacity-70">{t.n.toLocaleString("en-IN")}</span></Link>
                ))}
              </>
            ) : null}
        </div>
        <form className="flex flex-wrap items-center gap-2">
          {type ? <input type="hidden" name="type" value={type} /> : null}
          {tree ? <input type="hidden" name="view" value="tree" /> : null}
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={q} placeholder="Search name, code, mobile, city, contact, GSTIN, Tally name, route"
              className="h-8 w-full rounded-lg border border-input bg-transparent pr-3 pl-8 text-sm focus:border-primary focus:outline-none" />
          </div>
          <>
              <select name="status" defaultValue={status ?? ""} className={select} aria-label="Status">
                <option value="">Active and inactive</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              {options.states.length > 1 ? (
                <select name="state" defaultValue={state ?? ""} className={select} aria-label="State">
                  <option value="">All states</option>
                  {options.states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : null}
              {options.officers.length ? (
                <select name="officer" defaultValue={officer ?? ""} className={select} aria-label="Sales officer">
                  <option value="">All sales officers</option>
                  {options.officers.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : null}
          </>
          <button className="h-8 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Search</button>
          {narrowed ? <Link href={href({ q: null, status: null, state: null, officer: null })} className="text-sm text-muted-foreground hover:underline">Clear</Link> : null}
        </form>

        {tree ? <Hierarchy kind={kind} firms={firms} served={children} /> : (
        <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  {[info.one, "Type", "Class", "Contact", "City", "State", "Pincode", "GSTIN", "Tally name", "Served by", "Serves", "Route", "Sales officer", "Price list", "Credit limit", "App", "Orders", "Last order", "Last 90 days", "Added", "Status"].map((h) => <th key={h} className={th}>{h}</th>)}
                  {canAdd ? <th className={th} /> : null}
                </tr>
              </thead>
              <tbody>
                {firms.map((f) => (
                  <tr key={f.uid} className="border-t border-border align-top hover:bg-muted/40">
                    <td className={`${td} min-w-56`}>
                      <Link href={`/customers/firm/${f.uid}`} className="font-medium text-primary hover:underline">{f.name}</Link>
                      {f.code ? <div className="font-mono text-[11px] text-tertiary-foreground">{f.code}</div> : null}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{f.type === "Not set" ? <span className="text-muted-foreground">—</span> : f.type}</td>
                    <td className={td}>{f.firmClass ?? "—"}</td>
                    <td className={td}><div>{f.contactPerson ?? "—"}</div><div className="font-mono text-xs text-muted-foreground">{f.phone ?? ""}</div></td>
                    <td className={td}>{f.city ?? "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>{f.state ?? "—"}</td>
                    <td className={`${td} font-mono text-xs`}>{f.pincode ?? "—"}</td>
                    <td className={`${td} font-mono text-xs`}>{f.gstin ?? "—"}</td>
                    <td className={`${td} min-w-40`}>{f.tallyName ?? "—"}</td>
                    <td className={td}>{f.servedByUid ? <Link href={`/customers/firm/${f.servedByUid}`} className="hover:underline">{f.servedBy}</Link> : "—"}</td>
                    <td className={`${td} num text-right`}>{f.serves || "—"}</td>
                    <td className={td}>{f.route ?? "—"}</td>
                    <td className={td}>{f.salesOfficer ?? "—"}</td>
                    <td className={td}>{f.priceList ?? <span className="text-muted-foreground">Standard</span>}</td>
                    <td className={`${td} num text-right`}>{f.creditLimit ? rs(f.creditLimit) : "—"}</td>
                    <td className={td}>{f.appLogin ? <Pill tone="success">Login</Pill> : <Pill>No login</Pill>}</td>
                    <td className={`${td} num text-right`}>{f.orders || "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>{day(f.lastOrder)}</td>
                    <td className={`${td} num text-right`}>{f.value90 ? rs(f.value90) : "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>{day(f.created)}</td>
                    <td className={td}>{f.active ? <Pill tone="success">Active</Pill> : <Pill>Inactive</Pill>}</td>
                    {canAdd ? <td className={td}><RowActions slug="distribution" id={f.uid} noun="customer" label={f.name} on={f.active} editHref={`/customers/firm/${f.uid}/edit`} /></td> : null}
                  </tr>
                ))}
                {firms.length === 0 ? <tr><td colSpan={canAdd ? 22 : 21} className="px-3 py-10 text-center text-muted-foreground">{narrowed || type ? "No customer matches." : `No ${info.label.toLowerCase()} yet.`}</td></tr> : null}
              </tbody>
            </table>
        </div>
        )}
        {listing.total > 0 ? (
          <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
            <span>
              {pages > 1
                ? `${((page - 1) * FIRM_PAGE + 1).toLocaleString("en-IN")}–${Math.min(page * FIRM_PAGE, listing.total).toLocaleString("en-IN")} of ${listing.total.toLocaleString("en-IN")}`
                : `${listing.total.toLocaleString("en-IN")} customer${listing.total === 1 ? "" : "s"}`}
            </span>
            {page > 1 ? <Link href={href({ page: String(page - 1) })} className="inline-flex items-center gap-1 hover:text-foreground"><ChevronLeft className="size-4" /> Previous</Link> : null}
            {page < pages ? <Link href={href({ page: String(page + 1) })} className="inline-flex items-center gap-1 hover:text-foreground">Next <ChevronRight className="size-4" /></Link> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const KIND_ONE = Object.fromEntries(CUSTOMER_KINDS.map((k) => [k.key, k.one]));

/**
 * The hierarchy: customers grouped by type (retailers: by who serves them), each opening to the customers it serves.
 */
function Hierarchy({ kind, firms, served }: { kind: FirmKind; firms: FirmRow[]; served: Map<string, Array<{ uid: string; name: string; code: string | null; kind: FirmKind | null; channel: string | null; city: string | null; active: boolean }>> }) {
  const groups = new Map<string, FirmRow[]>();
  for (const f of firms) {
    const g = kind === "retailers" ? f.servedBy ?? "Not mapped" : f.type;
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }
  const ordered = [...groups].sort((a, b) => (a[0] === "Not set" || a[0] === "Not mapped" ? 1 : 0) - (b[0] === "Not set" || b[0] === "Not mapped" ? 1 : 0) || b[1].length - a[1].length);
  if (!firms.length) return <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">No customer matches.</div>;
  return (
    <div className="space-y-3">
      {ordered.map(([g, list]) => {
        const active = list.filter((f) => f.active).length;
        return (
          <section key={g} className="overflow-hidden rounded-lg border border-border">
            <header className="flex flex-wrap items-baseline gap-2 border-b border-border bg-muted/50 px-4 py-2">
              <h3 className="font-semibold">{g}</h3>
              <span className="text-[12px] text-muted-foreground">{list.length} · {active} active{kind !== "retailers" ? ` · serve ${list.reduce((a, f) => a + f.serves, 0).toLocaleString("en-IN")}` : ""}</span>
            </header>
            <ul className="divide-y divide-border">
              {list.map((f) => {
                const kids = served.get(f.uid) ?? [];
                const row = (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                    <Link href={`/customers/firm/${f.uid}`} className="font-medium text-primary hover:underline">{f.name}</Link>
                    <span className="font-mono text-[11px] text-tertiary-foreground">{f.code}</span>
                    <span className="text-[12px] text-muted-foreground">{[f.city, kind !== "retailers" && f.servedBy ? `served by ${f.servedBy}` : null, f.orders ? `${f.orders} orders` : null].filter(Boolean).join(" · ")}</span>
                    {f.active ? null : <Pill>Inactive</Pill>}
                    {f.serves ? <span className="ml-auto text-[12px] font-medium text-foreground">serves {f.serves.toLocaleString("en-IN")}</span> : null}
                  </div>
                );
                return (
                  <li key={f.uid}>
                    {kids.length ? (
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 hover:bg-muted/40">
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                          {row}
                        </summary>
                        <ul className="border-t border-border bg-muted/20 py-1 pl-10 pr-4">
                          {kids.map((k) => (
                            <li key={k.uid} className="flex flex-wrap items-center gap-x-3 py-1 text-[13px]">
                              <Link href={`/customers/firm/${k.uid}`} className="hover:underline">{k.name}</Link>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{k.kind ? KIND_ONE[k.kind] : k.channel ?? "—"}</span>
                              <span className="text-[12px] text-muted-foreground">{[k.code, k.city].filter(Boolean).join(" · ")}</span>
                              {k.active ? null : <Pill>Inactive</Pill>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2"><span className="size-4 shrink-0" />{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
