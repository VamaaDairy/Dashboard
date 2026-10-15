"use client";

import Link from "next/link";
import { BarList, Donut, GAIA } from "@/components/farmers/charts";
import { AlertTriangle, ClipboardList, CircleCheck, CircleDot, FileCheck2, Gauge, IndianRupee } from "lucide-react";
import { EmptyState, Panel, Pill, StatCard, TatPill } from "@/components/cn/ui";
import type { Complaint } from "@/lib/cn/data";
import { CAPA_REVIEW_DAYS, OPEN_STAGES, dmy, REPEAT_WINDOW_DAYS, STAGES, rupees, stageLabel, tatOf } from "@/lib/cn/sop";
import { addDays } from "@/lib/dates";
import { formatNumber } from "@/lib/format";

const n0 = (v: number) => formatNumber(v, 0);
const sum = (xs: (number | null)[]) => xs.reduce<number>((t, x) => t + (x ?? 0), 0);
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

function tally(rows: Complaint[], key: (c: Complaint) => string | null, value: (c: Complaint) => number = () => 1) {
  const m = new Map<string, number>();
  for (const c of rows) {
    const k = key(c);
    if (k) m.set(k, (m.get(k) ?? 0) + value(c));
  }
  return [...m].map(([label, v]) => ({ label, value: v }));
}

/** A quiet heading for a group of panels. */
function Head({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-baseline gap-3 pt-1">
      <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
      <p className="text-[12px] text-tertiary-foreground">{text}</p>
    </div>
  );
}

const Empty = ({ text = "Nothing in this period." }: { text?: string }) => <EmptyState icon={CircleCheck} title={text} />;

/**
 * `rows` are the complaints registered in the period; `all` is everything, for what does not
 * belong to a period - work still open, and CAPA follow-up.
 */
export function CnDashboard({ all, rows, today }: { all: Complaint[]; rows: Complaint[]; today: string }) {
  const open = all.filter((c) => OPEN_STAGES.includes(c.stage as never));
  const late = open.filter((c) => ["overdue", "escalated"].includes(tatOf(c, today).state));
  const escalated = open.filter((c) => tatOf(c, today).state === "escalated");
  const closed = rows.filter((c) => c.stage === "closed");
  const withCn = rows.filter((c) => c.cn_number);
  const avgClose = closed.length ? sum(closed.map((c) => days(c.complaint_date, c.closed_on ?? today))) / closed.length : null;
  const onTrack = open.length ? ((open.length - late.length) / open.length) * 100 : null;

  // repeats: the same product and complaint type more than once in the period
  const groups = new Map<string, Complaint[]>();
  for (const c of rows.filter((x) => x.stage !== "rejected")) {
    const k = `${c.product_name}\u0000${c.category}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const repeats = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);

  // CAPA: closed complaints with a root cause, not yet reviewed (due CAPA_REVIEW_DAYS after the target date)
  const reviewDue = all
    .filter((c) => c.stage === "closed" && c.root_cause && c.capa_review_on === null)
    .map((c) => ({ c, due: addDays(c.capa_target_date ?? c.closed_on ?? today, CAPA_REVIEW_DAYS) }))
    .sort((a, b) => a.due.localeCompare(b.due));
  const reviewed = all.filter((c) => c.capa_review_on !== null);
  const effective = reviewed.filter((c) => c.capa_effective).length;

  return (
    <div className="space-y-7">
      <section className="space-y-4">
      <Head title="Overview" text="Totals for the period you picked (open and overdue are always as of today)." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={ClipboardList} label="Complaints" value={n0(rows.length)} note="registered in period" />
        <StatCard icon={CircleDot} label="Open now" value={n0(open.length)} note="all periods" tone="info" />
        <StatCard icon={AlertTriangle} label="Overdue" value={n0(late.length)} note={escalated.length ? `${escalated.length} escalated` : "none escalated"} tone={late.length ? "danger" : "success"} />
        <StatCard icon={Gauge} label="Within TAT" value={onTrack === null ? "—" : `${formatNumber(onTrack, 0)}%`} note="of open complaints" tone="success" />
        <StatCard icon={IndianRupee} label="Claimed" value={rupees(sum(rows.map((c) => c.claim_value)))} note="in period" tone="warning" />
        <StatCard icon={FileCheck2} label="CN posted" value={rupees(sum(withCn.map((c) => c.cn_value)))} note={`${withCn.length} credit note${withCn.length === 1 ? "" : "s"}`} tone="brand" />
      </div>

      </section>

      <section className="space-y-4">
      <Head title="Where complaints stand" text="Which step open complaints are waiting in, how the period turned out, and what they were about." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Where open complaints are" description="Open complaints by the stage they are waiting in.">
          {open.length ? (
            <BarList items={STAGES.filter((s) => OPEN_STAGES.includes(s.key)).map((s) => ({ label: `${s.label} (${s.who})`, value: open.filter((c) => c.stage === s.key).length }))} />
          ) : <Empty text="No open complaints." />}
        </Panel>
        <Panel title="Outcome" description="How complaints registered in the period stand.">
          <Donut
            centre={n0(rows.length)} centreLabel="complaints"
            slices={[
              { label: "Closed with CN", value: rows.filter((c) => c.outcome === "cn_issued").length, color: GAIA.green },
              { label: "Closed, no CN", value: rows.filter((c) => c.outcome === "no_cn").length, color: GAIA.blue },
              { label: "Open", value: rows.filter((c) => OPEN_STAGES.includes(c.stage as never)).length, color: GAIA.orange },
              { label: "Rejected", value: rows.filter((c) => c.stage === "rejected").length, color: GAIA.muted },
            ].filter((s) => s.value > 0)}
          />
          {avgClose !== null ? <p className="mt-3 border-t border-border pt-3 text-[12px] text-tertiary-foreground">Closed complaints took {formatNumber(avgClose, 1)} days on average.</p> : null}
        </Panel>
        <Panel title="Complaint types" description="Number of complaints.">
          {rows.length ? <BarList items={tally(rows, (c) => c.category)} color={GAIA.orange} /> : <Empty />}
        </Panel>
      </div>

      </section>

      <section className="space-y-4">
      <Head title="Who and what" text="Departments, customers and products behind the complaints." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Departments" description="Complaints assigned for investigation.">
          {rows.some((c) => c.department) ? <BarList items={tally(rows, (c) => c.department)} /> : <Empty />}
        </Panel>
        <Panel title="Customers" description="Claim value by customer.">
          {rows.length ? <BarList items={tally(rows, (c) => c.customer_name, (c) => c.claim_value)} format={rupees} /> : <Empty />}
        </Panel>
        <Panel title="Products" description="Number of complaints by product.">
          {rows.length ? <BarList items={tally(rows, (c) => c.product_name)} color={GAIA.green} /> : <Empty />}
        </Panel>
      </div>

      </section>

      <section className="space-y-4">
      <Head title="Needs attention" text="Repeats, late complaints and CAPA reviews that are due." />
      <Panel flush title="Repeat complaints" description={`Same product and complaint type more than once in the period (a repeat within ${REPEAT_WINDOW_DAYS} days is also flagged on the complaint).`}>
        {repeats.length === 0 ? <Empty text="No repeats in this period." /> : (
          <ul className="divide-y divide-border text-[13px]">
            {repeats.map((g) => (
              <li key={g[0].product_name + g[0].category} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="font-medium">{g[0].product_name}</span>
                <span className="text-muted-foreground">{g[0].category} · {g.length} complaints</span>
                <span className="flex flex-wrap gap-2">
                  {g.map((c) => <Link key={c.id} href={`/cn/${c.id}`} className="num font-medium underline underline-offset-2">{c.complaint_no}</Link>)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel flush title="Overdue complaints" description="Past the TAT of their stage, longest first.">
          {late.length === 0 ? <Empty text="Nothing is overdue." /> : (
            <ul className="divide-y divide-border text-[13px]">
              {[...late].sort((a, b) => tatOf(b, today).late - tatOf(a, today).late).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span><Link href={`/cn/${c.id}`} className="num font-medium underline underline-offset-2">{c.complaint_no}</Link> <span className="text-muted-foreground">{c.customer_name} · {stageLabel(c.stage)}</span></span>
                  <TatPill c={c} today={today} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          flush
          title="CAPA follow-up"
          description={`Effectiveness is reviewed ${CAPA_REVIEW_DAYS} days after the CAPA target date.${reviewed.length ? ` ${effective} of ${reviewed.length} reviewed were effective.` : ""}`}
        >
          {reviewDue.length === 0 ? <Empty text="No CAPA waiting for review." /> : (
            <ul className="divide-y divide-border text-[13px]">
              {reviewDue.map(({ c, due }) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span><Link href={`/cn/${c.id}`} className="num font-medium underline underline-offset-2">{c.complaint_no}</Link> <span className="text-muted-foreground">{c.capa_owner}</span></span>
                  <Pill tone={due < today ? "danger" : "neutral"}>review {due < today ? "overdue since" : "by"} {dmy(due)}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      </section>
    </div>
  );
}
