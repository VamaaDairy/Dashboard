import Link from "next/link";
import { ChevronRight, FolderTree, Home, Mail, RefreshCw, Scale, User } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, Section, THead, Th } from "@/components/tanks/ui";
import { formatNumber } from "@/lib/format";
import { loadLevel, type TreeNode } from "@/lib/outstandings/data";

export const dynamic = "force-dynamic";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const inr = (n: number) => formatNumber(Math.abs(n), 2);
const field = "rounded-lg border border-border bg-input/30 px-3 py-2 text-[13px] focus:border-primary focus:outline-none";
const href = (group?: string, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams(extra);
  if (group) p.set("group", group);
  const s = p.toString();
  return s ? `/outstandings?${s}` : "/outstandings";
};

/** Debit balances (receivables) read positive; a credit balance shows in brackets. */
function Balance({ value }: { value: number }) {
  return (
    <span className={`num ${value < 0 ? "text-tertiary-foreground" : ""}`}>
      {value < 0 ? "(" : ""}₹ {inr(value)}{value < 0 ? ")" : ""}
    </span>
  );
}

export default async function OutstandingsPage({ searchParams }: PageProps<"/outstandings">) {
  const sp = await searchParams;
  const group = first(sp.group) || undefined;
  const q = first(sp.q).trim().toLowerCase();
  const refresh = first(sp.refresh) === "1";

  let level: Awaited<ReturnType<typeof loadLevel>> | null = null;
  let error = "";
  try {
    level = await loadLevel(group, refresh);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const rows: TreeNode[] = level ? level.children.filter((c) => !q || c.name.toLowerCase().includes(q)) : [];
  const diff = level ? level.current.balance - level.childrenTotal : 0;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <PageHeader
          icon={Scale}
          title="Outstandings"
          subtitle={`Sundry Debtors from the Tally balance sheet${level ? ` · ${level.company}` : ""}.`}
          actions={
            <div className="flex flex-wrap gap-2">
            <Link href="/outstandings/statements" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] hover:bg-muted">
              <Mail className="h-4 w-4" /> Statements
            </Link>
            <Link href={href(group, { refresh: "1" })} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] hover:bg-muted">
              <RefreshCw className="h-4 w-4" /> Refresh from Tally
            </Link>
            </div>
          }
        />

        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-[13px] text-red-700 dark:text-red-400">{error}</div>
        ) : null}

        {level ? (
          <>
            <nav className="flex flex-wrap items-center gap-1 text-[13px]">
              <Link href="/outstandings" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-tertiary-foreground hover:bg-muted hover:text-foreground">
                <Home className="h-3.5 w-3.5" /> Sundry Debtors
              </Link>
              {level.breadcrumb.map((name, i) => (
                <span key={name} className="flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 text-tertiary-foreground" />
                  <Link href={href(name)} className={`rounded-md px-2 py-1 hover:bg-muted ${i === level.breadcrumb.length - 1 ? "font-medium" : "text-tertiary-foreground hover:text-foreground"}`}>
                    {name}
                  </Link>
                </span>
              ))}
            </nav>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
                <div className="font-mono text-[10px] uppercase tracking-wide text-tertiary-foreground">{level.current.name}</div>
                <div className="num mt-1 text-2xl font-semibold"><Balance value={level.current.balance} /></div>
                <div className="mt-0.5 text-[12px] text-tertiary-foreground">
                  {level.totals.parties.toLocaleString("en-IN")} parties in {level.totals.groups} groups · fetched {new Date(level.fetchedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
                <div className="font-mono text-[10px] uppercase tracking-wide text-tertiary-foreground">Sum of the rows below</div>
                <div className="num mt-1 text-2xl font-semibold"><Balance value={level.childrenTotal} /></div>
                {Math.abs(diff) > 1 ? (
                  <div className="mt-0.5 text-[12px] text-tertiary-foreground">Difference of ₹ {inr(diff)} sits directly on this group.</div>
                ) : (
                  <div className="mt-0.5 text-[12px] text-tertiary-foreground">Matches the group total.</div>
                )}
              </div>
            </div>

            {level.children.length > 8 ? (
              <form className="flex flex-wrap items-end gap-3">
                {group ? <input type="hidden" name="group" value={group} /> : null}
                <label className="flex flex-col gap-1 text-[12px] text-tertiary-foreground">Filter this level
                  <input name="q" defaultValue={first(sp.q)} placeholder="Search…" className={field} />
                </label>
                <button className="rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-background">Apply</button>
              </form>
            ) : null}

            <Section title={level.current.name} description="Open a group to go one level down. Debit balances (receivables) show positive; credit balances show in brackets.">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <THead>
                    <Th align="left">Name</Th>
                    <Th align="left">Type</Th>
                    <Th>Balance</Th>
                  </THead>
                  <tbody>
                    {rows.length === 0 ? (
                      <Empty colSpan={3}>{q ? "No row matches that filter." : "This group has nothing under it."}</Empty>
                    ) : rows.map((n) => (
                      <tr key={`${n.kind}:${n.name}`} className="border-t border-border hover:bg-muted/40">
                        <td className="px-3 py-2 font-medium">
                          {n.kind === "group" && n.hasChildren ? (
                            <Link href={href(n.name)} className="flex items-center gap-2">
                              <FolderTree className="h-4 w-4 shrink-0 text-tertiary-foreground" /> {n.name}
                              <ChevronRight className="h-4 w-4 shrink-0 text-tertiary-foreground" />
                            </Link>
                          ) : (
                            <span className="flex items-center gap-2">
                              {n.kind === "group" ? <FolderTree className="h-4 w-4 shrink-0 text-tertiary-foreground" /> : <User className="h-4 w-4 shrink-0 text-tertiary-foreground" />}
                              {n.name}
                              {n.email ? <Mail className="h-3.5 w-3.5 shrink-0 text-tertiary-foreground" /> : null}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-tertiary-foreground">{n.kind === "group" ? "Group" : "Ledger"}</td>
                        <td className="px-3 py-2 text-right"><Balance value={n.balance} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        ) : null}
      </div>
    </div>
  );
}
