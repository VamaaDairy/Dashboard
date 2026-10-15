import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, ExternalLink, Repeat2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Panel, Pill, Row, Rows, StagePill, StageTrack, TatPill } from "@/components/cn/ui";
import { StagePanel } from "@/components/cn/StagePanel";
import { dmy } from "@/components/cn/ComplaintList";
import { getComplaint, listComplaints, listEvents, repeatsOf } from "@/lib/cn/data";
import { CAPA_REVIEW_DAYS, REPEAT_WINDOW_DAYS, rupees, tatOf } from "@/lib/cn/sop";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

const by = (name: string | null, on: string | null) => (name ? `${name} (${dmy(on)})` : "");
const stamp = (at: string) =>
  new Date(at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-tertiary-foreground">{label}</dt>
      <dd className="num truncate font-medium">{children}</dd>
    </div>
  );
}

export default async function ComplaintPage({ params }: PageProps<"/cn/[id]">) {
  const { id } = await params;
  const c = await getComplaint(id);
  if (!c) notFound();

  const me = await userFromToken((await cookies()).get("session")?.value);
  const can = {
    edit: !!me && atLeast(levelFor(me, "cn"), "edit"),
    approve: !!me && atLeast(levelFor(me, "cn.approve"), "edit"),
    finance: !!me && atLeast(levelFor(me, "cn.finance"), "edit"),
  };

  const now = today();
  const [events, all] = await Promise.all([listEvents(c.id), listComplaints()]);
  const repeats = repeatsOf(all, c, REPEAT_WINDOW_DAYS);
  const tat = tatOf(c, now);
  const capaDue = c.capa_target_date ? new Date(Date.parse(`${c.capa_target_date}T00:00:00Z`) + CAPA_REVIEW_DAYS * 86400000).toISOString().slice(0, 10) : null;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <PageHeader
          icon={ClipboardCheck}
          title={c.complaint_no}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <StagePill stage={c.stage} />
              <TatPill c={c} today={now} />
              {tat.due ? <span className="text-[12px]">due {dmy(tat.due)}</span> : null}
            </span>
          }
          actions={<Link href="/cn" className={buttonVariants({ variant: "outline" })}><ArrowLeft className="size-4" /> All complaints</Link>}
        />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0 space-y-5">
            {repeats.length > 0 ? (
              <div className="flex items-start gap-3 rounded-lg border border-border-warning bg-warning/10 px-4 py-3 text-[13px]">
                <Repeat2 className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <p className="text-foreground">
                  <span className="font-medium">Repeat complaint.</span> {repeats.length} more on {c.product_name} ({c.category}) within {REPEAT_WINDOW_DAYS} days:{" "}
                  {repeats.map((r, i) => <span key={r.id}>{i ? ", " : ""}<Link className="num font-medium underline underline-offset-2" href={`/cn/${r.id}`}>{r.complaint_no}</Link></span>)}.
                  {" "}Check whether the CAPA is working.
                </p>
              </div>
            ) : null}

            <StagePanel c={c} can={can} today={now} />

            <Panel title="Complaint" flush>
              <Rows>
                <Row label="Complaint date" value={dmy(c.complaint_date)} />
                <Row label="Customer" value={`${c.customer_name} (${c.customer_type})`} />
                <Row label="Depot / region" value={c.region} />
                <Row label="Contact no." value={c.contact_no} mono />
                <Row label="Invoice" value={`${c.invoice_no}${c.invoice_date ? ` · ${dmy(c.invoice_date)}` : ""}`} />
                <Row label="Product" value={`${c.product_name}${c.batch_no ? ` · batch ${c.batch_no}` : ""}`} />
                <Row label="Quantity affected" value={`${c.qty_affected} ${c.qty_unit}`} />
                <Row label="Complaint type" value={c.category} />
                <Row label="Description" value={c.description} />
                <Row label="Photo / video" value={
                  <a href={c.evidence_url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-info underline-offset-2 hover:underline">
                    <span className="truncate">{c.evidence_url}</span><ExternalLink className="size-3.5 shrink-0" />
                  </a>
                } />
                <Row label="Registered by" value={c.registered_by} />
              </Rows>
            </Panel>

            {c.mis_on ? (
              <Panel title="MIS & assignment" flush>
                <Rows>
                  <Row label="MIS check" value={by(c.mis_by, c.mis_on)} />
                  <Row label="MIS remark" value={c.mis_remark} />
                  <Row label="Department" value={c.department} />
                  <Row label="Assigned by" value={by(c.assigned_by, c.assigned_on)} />
                  <Row label="Investigation due" value={dmy(c.tat_due)} />
                </Rows>
              </Panel>
            ) : null}

            {c.rca_on ? (
              <Panel title="Investigation, RCA & CAPA" flush>
                <Rows>
                  <Row label="Findings" value={c.investigation} />
                  <Row label="Root cause" value={c.root_cause} />
                  <Row label="Corrective action" value={c.corrective_action} />
                  <Row label="Preventive action" value={c.preventive_action} />
                  <Row label="CAPA owner" value={c.capa_owner} />
                  <Row label="CAPA target date" value={dmy(c.capa_target_date)} />
                  <Row label="Submitted by" value={by(c.rca_by, c.rca_on)} />
                  <Row label="Effectiveness review" value={c.capa_review_on
                    ? `${c.capa_effective ? "Effective" : "Not effective"} - ${by(c.capa_review_by, c.capa_review_on)}${c.capa_review_remark ? ` - ${c.capa_review_remark}` : ""}`
                    : capaDue ? `Due by ${dmy(capaDue)}` : ""} />
                </Rows>
              </Panel>
            ) : null}

            {c.recommended_on || c.approved_on || c.cn_number ? (
              <Panel title="Credit note" flush>
                <Rows>
                  <Row label="Recommended" value={c.recommended_value !== null ? `${rupees(c.recommended_value)} - ${by(c.recommended_by, c.recommended_on)}` : c.outcome === "no_cn" ? `No credit note - ${by(c.recommended_by, c.recommended_on)}` : ""} />
                  <Row label="Remark" value={c.recommend_remark} />
                  <Row label="Approval needed" value={c.approval_level ? `${c.approval_level} or higher` : ""} />
                  <Row label="Decision" value={c.approved_on ? `${c.approved_value !== null ? `${rupees(c.approved_value)} approved as ${c.approver_level}` : "Rejected"} - ${by(c.approved_by, c.approved_on)}` : ""} />
                  <Row label="Approval remark" value={c.approval_remark} />
                  <Row label="CN posted" value={c.cn_number ? `${c.cn_number} · ${dmy(c.cn_date)} · ${rupees(c.cn_value)} - ${by(c.finance_by, c.finance_on)}` : ""} />
                  <Row label="Return material" value={c.return_required ? (c.return_verified_on ? `Verified - ${by(c.return_verified_by, c.return_verified_on)} - ${c.return_remark}` : "To be returned and verified") : ""} />
                  <Row label="Closed" value={c.closed_on ? `${by(c.closed_by, c.closed_on)}${c.closure_remark ? ` - ${c.closure_remark}` : ""}` : ""} />
                </Rows>
              </Panel>
            ) : null}
          </div>

          <aside className="min-w-0 space-y-5 lg:sticky lg:top-4">
            <Panel>
              <div className="text-[12px] font-medium text-tertiary-foreground">Claim value</div>
              <div className="num mt-1 text-[26px] font-semibold leading-none tracking-tight">{rupees(c.claim_value)}</div>
              <dl className="mt-4 space-y-2 border-t border-border pt-3 text-[12px]">
                {c.recommended_value !== null ? <Line label="Recommended">{rupees(c.recommended_value)}</Line> : null}
                {c.approved_value !== null ? <Line label="Approved">{rupees(c.approved_value)}</Line> : null}
                {c.cn_number ? <Line label={`CN ${c.cn_number}`}>{rupees(c.cn_value)}</Line> : null}
                <Line label="Customer">{c.customer_name}</Line>
                {c.department ? <Line label="Department">{c.department}</Line> : null}
                {c.outcome ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-tertiary-foreground">Outcome</dt>
                    <dd><Pill tone={c.outcome === "cn_issued" ? "success" : "neutral"}>{c.outcome === "cn_issued" ? "CN issued" : "No CN"}</Pill></dd>
                  </div>
                ) : null}
              </dl>
            </Panel>

            <Panel title="Progress">
              <StageTrack stage={c.stage} />
            </Panel>

            <Panel title="History" flush>
              <ol className="relative px-4 py-3">
                <span className="absolute bottom-5 left-[19px] top-5 w-px bg-border" />
                {events.map((e) => (
                  <li key={e.id} className="relative flex gap-3 py-2 text-[13px]">
                    <span className="relative z-10 mt-1.5 size-2 shrink-0 rounded-full border-2 border-card bg-tertiary-foreground/50 ring-1 ring-border" />
                    <div className="min-w-0">
                      <div className="font-medium leading-snug">{e.action}</div>
                      <div className="text-[12px] text-tertiary-foreground">{e.by_name} · {stamp(e.at)}</div>
                      {e.remark ? <p className="mt-1 rounded-md bg-muted/60 px-2 py-1.5 text-[12px] leading-snug text-muted-foreground">{e.remark}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}
