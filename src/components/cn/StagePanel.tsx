"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignDepartment, closeComplaint, decideCn, misVerify, postCn, reassignDepartment, recommendCn, reviewCapa, submitRca, verifyReturn,
  type CnResult,
} from "@/app/cn/actions";
import { AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, Pick } from "@/components/cn/fields";
import { Field, Panel } from "@/components/cn/ui";
import { DEPARTMENTS, levelNames, rupees } from "@/lib/cn/sop";
import type { Complaint } from "@/lib/cn/data";

const ctl = "border-border-control-hover bg-card";

export interface Can { edit: boolean; approve: boolean; finance: boolean }

/** The one step this complaint is waiting on, with the form for it - or a note about who has to do it. */
export function StagePanel({ c, can, today }: { c: Complaint; can: Can; today: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [f, setF] = useState<Record<string, string>>({});
  const [ck, setCk] = useState<Record<string, boolean>>({});
  const val = (k: string, d = "") => f[k] ?? d;
  const put = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const go = (fn: () => Promise<CnResult>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error); return; }
      setError(null);
      setF({}); setCk({});
      router.refresh();
    });

  const text = (label: string, k: string, o: { type?: string; ph?: string; d?: string; hint?: string } = {}) => (
    <Field label={label} hint={o.hint}>
      <Input className={`h-9 md:h-8 ${ctl}`} type={o.type ?? "text"} value={val(k, o.d)} placeholder={o.ph} onChange={(e) => put(k, e.target.value)} />
    </Field>
  );
  const note = (label: string, k: string, rows = 2) => (
    <Field label={label} className="sm:col-span-2">
      <Textarea className={`${ctl} ${rows > 2 ? "min-h-24" : "min-h-16"}`} value={val(k)} onChange={(e) => put(k, e.target.value)} />
    </Field>
  );
  const depPick = (k: string) => (
    <Field label="Department">
      <Pick value={val(k, c.department ?? "")} onChange={(x) => put(k, x)} options={DEPARTMENTS} />
    </Field>
  );
  const check = (k: string, label: string) => (
    <div className="sm:col-span-2"><Check checked={!!ck[k]} onChange={(x) => setCk((o) => ({ ...o, [k]: x }))}>{label}</Check></div>
  );
  const wait = (who: string) => (
    <Panel>
      <div className="flex items-center gap-3 text-[13px]">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-tertiary-foreground"><Clock className="size-4" strokeWidth={1.5} /></span>
        <div>
          <div className="font-medium text-foreground">Waiting for {who}</div>
          <div className="text-[12px] text-tertiary-foreground">Nothing for you to do on this step.</div>
        </div>
      </div>
    </Panel>
  );
  const panel = (title: string, description: string, fields: React.ReactNode, buttons: React.ReactNode[] = []) => (
    <Panel
      title={title}
      description={description}
      className="border-border-brand"
      footer={
        <>
          {buttons}
          {error ? <span role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-destructive"><AlertCircle className="size-4" />{error}</span> : null}
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">{fields}</div>
    </Panel>
  );

  const B = (label: string, run: () => Promise<CnResult>, variant: "primary" | "outline" | "destructive" = "primary") => (
    <Button key={label} variant={variant} disabled={pending} onClick={() => go(run)}>{label}</Button>
  );

  switch (c.stage) {
    case "registered":
      if (!can.edit) return wait("MIS to verify and log it");
      return panel("MIS verification", "Check the information and the evidence, then log the complaint - or reject it if it is incomplete or invalid.", <>
        {check("info", "Information is complete")}
        {check("evidence", "Photo / video evidence checked")}
        {note("Remark (required to reject)", "remark")}
      </>, [
        B("Verify & log", () => misVerify(c.id, true, !!ck.info, !!ck.evidence, val("remark"))),
        B("Reject complaint", () => misVerify(c.id, false, false, false, val("remark")), "destructive"),
      ]);

    case "logged":
      if (!can.edit) return wait("MIS to assign a department");
      return panel("Assign department", "The department that will investigate, and how many days it has.", <>
        {depPick("dep")}
        {text("Investigation TAT (days)", "tat", { type: "number", d: "3" })}
        {note("Remark", "remark")}
      </>, [B("Assign", () => assignDepartment(c.id, val("dep"), Number(val("tat", "3")), val("remark")))]);

    case "assigned":
      if (!can.edit) return wait(`${c.department} to investigate`);
      return (
        <div className="space-y-5">
          {panel(`Investigation, RCA & CAPA - ${c.department}`, "Findings, the root cause, and what will be done about it and to stop it happening again.", <>
            {note("Investigation findings", "inv", 3)}
            {note("Root cause (RCA)", "rca", 3)}
            {note("Corrective action", "ca")}
            {note("Preventive action", "pa")}
            {text("CAPA owner", "owner")}
            {text("CAPA target date", "target", { type: "date" })}
          </>, [B("Submit RCA & CAPA", () => submitRca(c.id, {
            investigation: val("inv"), root_cause: val("rca"), corrective_action: val("ca"), preventive_action: val("pa"),
            capa_owner: val("owner"), capa_target_date: val("target"),
          }))])}
          <Panel
            title="Wrong department?"
            description="Send it to another department, with the reason. The TAT restarts."
            footer={B("Reassign", () => reassignDepartment(c.id, val("dep2"), Number(val("tat2", "3")), val("why")), "outline")}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {depPick("dep2")}
              {text("New TAT (days)", "tat2", { type: "number", d: "3" })}
              {note("Reason for reassigning", "why")}
            </div>
          </Panel>
        </div>
      );

    case "rca_done":
      if (!can.edit) return wait("the credit note recommendation");
      return panel("Credit note recommendation", `Claim is ${rupees(c.claim_value)}. Recommend a value (not above the claim), or close with no credit note.`, <>
        {text("Recommended CN value (₹)", "value", { d: String(c.claim_value) })}
        <div className="flex items-end">{check("ret", "Material has to be returned and verified before closing")}</div>
        {note("Remark (required if no CN)", "remark")}
      </>, [
        B("Recommend CN", () => recommendCn(c.id, true, val("value", String(c.claim_value)), !!ck.ret, val("remark"))),
        B("No CN - close", () => recommendCn(c.id, false, "", false, val("remark")), "outline"),
      ]);

    case "recommended":
      if (!can.approve) return wait(`${c.approval_level} (or higher) to approve ${rupees(c.recommended_value)}`);
      return panel("Approval", `Recommended ${rupees(c.recommended_value)} - needs ${c.approval_level} or higher. You cannot approve a complaint you registered or recommended.`, <>
        <Field label="Approving as">
          <Pick value={val("auth", c.approval_level ?? "")} onChange={(x) => put("auth", x)} options={levelNames} />
        </Field>
        {text("Approved value (₹)", "value", { d: String(c.recommended_value ?? "") })}
        {note("Remark (required to reject)", "remark")}
      </>, [
        B("Approve", () => decideCn(c.id, true, val("auth", c.approval_level ?? ""), val("value", String(c.recommended_value ?? "")), val("remark"))),
        B("Reject", () => decideCn(c.id, false, "", "", val("remark")), "destructive"),
      ]);

    case "approved":
      if (!can.finance) return wait("Finance to post the credit note");
      return panel("Finance posting", `Post the credit note in the books. The value must be exactly the approved ${rupees(c.approved_value)}.`, <>
        {text("CN number", "no")}
        {text("CN date", "date", { type: "date", d: today })}
        {text("CN value (₹)", "value", { d: String(c.approved_value ?? "") })}
        {note("Remark", "remark")}
      </>, [B("Post credit note", () => postCn(c.id, val("no"), val("date", today), val("value", String(c.approved_value ?? "")), val("remark")))]);

    case "posted": {
      if (!can.edit) return wait("the complaint to be closed");
      const needsReturn = c.return_required && !c.return_verified_on;
      return panel(needsReturn ? "Return material verification" : "Close complaint",
        needsReturn ? "Check the returned material against the claim before the complaint can close." : "Everything is done - close the complaint.",
        note(needsReturn ? "What was received (required)" : "Closure remark", "remark"),
        [needsReturn ? B("Mark return verified", () => verifyReturn(c.id, val("remark"))) : B("Close complaint", () => closeComplaint(c.id, val("remark")))]);
    }

    case "closed":
      if (c.root_cause && c.capa_review_on === null && can.edit) {
        return panel("CAPA effectiveness review", "Has the fix worked? Look for repeat complaints on this product and type before answering.",
          note("Remark (required if not effective)", "remark"),
          [B("Effective", () => reviewCapa(c.id, true, val("remark"))), B("Not effective", () => reviewCapa(c.id, false, val("remark")), "outline")]);
      }
      return null;

    default:
      return null;
  }
}
