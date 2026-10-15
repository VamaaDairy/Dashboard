import Link from "next/link";
import { AlertTriangle, BadgeCheck, CircleDot, ClipboardCheck, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ComplaintList } from "@/components/cn/ComplaintList";
import { CnFilters } from "@/components/cn/CnFilters";
import { StatCard } from "@/components/cn/ui";
import { listComplaints, type Complaint } from "@/lib/cn/data";
import { OPEN_STAGES, rupees, tatOf } from "@/lib/cn/sop";
import { today } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VIEWS: { key: string; label: string; test: (c: Complaint, today: string) => boolean }[] = [
  { key: "", label: "All", test: () => true },
  { key: "open", label: "Open", test: (c: Complaint) => OPEN_STAGES.includes(c.stage as never) },
  { key: "late", label: "Overdue", test: (c: Complaint, t: string) => ["overdue", "escalated"].includes(tatOf(c, t).state) },
  { key: "closed", label: "Closed", test: (c: Complaint) => c.stage === "closed" },
  { key: "rejected", label: "Rejected", test: (c: Complaint) => c.stage === "rejected" },
];

export default async function ComplaintsPage({ searchParams }: PageProps<"/cn">) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const view = VIEWS.find((v) => v.key === get("view")) ?? VIEWS[0];
  const dept = get("dept");
  const q = get("q").toLowerCase();
  const now = today();

  const all = await listComplaints();
  const base = all.filter((c) => (!dept || c.department === dept) && (!q || [
    c.complaint_no, c.customer_name, c.invoice_no, c.product_name, c.batch_no, c.category, c.cn_number,
  ].filter(Boolean).join(" ").toLowerCase().includes(q)));
  const rows = base.filter((c) => view.test(c, now));

  const open = all.filter((c) => VIEWS[1].test(c, now));
  const late = open.filter((c) => VIEWS[2].test(c, now));
  const toApprove = all.filter((c) => c.stage === "recommended");
  const toPost = all.filter((c) => c.stage === "approved");
  const exposure = open.reduce((t, c) => t + (c.claim_value ?? 0), 0);

  const href = (v: string) => {
    const qs = new URLSearchParams();
    if (v) qs.set("view", v);
    if (dept) qs.set("dept", dept);
    if (q) qs.set("q", get("q"));
    return qs.size ? `/cn?${qs}` : "/cn";
  };

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <PageHeader
          icon={ClipboardCheck}
          title="Complaints & credit notes"
          subtitle="Every credit note starts from a registered complaint, a root cause and a named owner."
          actions={<Link href="/cn/new" className={buttonVariants({ variant: "primary" })}><Plus className="size-4" /> Register complaint</Link>}
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={CircleDot} label="Open complaints" value={String(open.length)} note={`${rupees(exposure)} claimed`} tone="info" />
          <StatCard icon={AlertTriangle} label="Overdue" value={String(late.length)} note={late.length ? "Past the TAT of their stage" : "Everything on track"} tone={late.length ? "danger" : "success"} href={href("late")} />
          <StatCard icon={BadgeCheck} label="Awaiting approval" value={String(toApprove.length)} note={rupees(toApprove.reduce((t, c) => t + (c.recommended_value ?? 0), 0))} tone="warning" href="/cn/approvals" />
          <StatCard icon={Wallet} label="Awaiting posting" value={String(toPost.length)} note={rupees(toPost.reduce((t, c) => t + (c.approved_value ?? 0), 0))} tone="brand" href="/cn/finance" />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 lg:border-0">
            {VIEWS.map((v) => {
              const on = v.key === view.key;
              return (
                <Link key={v.key} href={href(v.key)} aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors lg:rounded-md lg:py-1.5",
                    on ? "text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-foreground lg:bg-muted lg:after:hidden" : "text-tertiary-foreground hover:text-foreground",
                  )}>
                  {v.label}
                  <span className="num text-[11px] text-tertiary-foreground">{base.filter((c) => v.test(c, now)).length}</span>
                </Link>
              );
            })}
          </nav>
          <CnFilters />
        </div>

        <ComplaintList title="Complaints" rows={rows} today={now} empty="No complaints match" />
      </div>
    </div>
  );
}
