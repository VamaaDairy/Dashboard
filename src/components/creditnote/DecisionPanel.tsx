"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideCreditNote, reopenCreditNote } from "@/app/credit-note/actions";
import { Section } from "@/components/tanks/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QtyInput } from "@/components/creditnote/QtyInput";
import { joinQty, qtyText, splitQty } from "@/lib/creditnote/qty";
import type { CreditNote } from "@/lib/creditnote/data";

type Pair = { cases: string; loose: string };
const toPair = (total: number | null, ppc: number): Pair => {
  if (total === null) return { cases: "", loose: "" };
  const q = splitQty(total, ppc);
  return { cases: String(q.cases), loose: q.loose ? String(q.loose) : "" };
};

/** Approve (with an approved quantity per item, starting from the claim) or reject a pending note; reopen a decided one. */
export function DecisionPanel({ note }: { note: CreditNote }) {
  const router = useRouter();
  const [approved, setApproved] = useState<Record<string, Pair>>(() =>
    Object.fromEntries(note.items.map((i) => [i.id, toPair(i.claim_qty, i.pcs_per_case)])),
  );
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) { setError(res.error); return; }
      setError(null);
      router.refresh();
    });

  if (note.status !== "pending") {
    return (
      <Section title="Decision">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Button variant="outline" disabled={pending} onClick={() => run(() => reopenCreditNote(note.id))}>
            Reopen for correction
          </Button>
          {error ? <span className="text-[13px] font-semibold text-destructive">{error}</span> : null}
        </div>
      </Section>
    );
  }

  // pieces, which is what the server stores; NaN (bad input) is passed through so it is reported
  const totalsById = () =>
    Object.fromEntries(note.items.map((i) => {
      const a = approved[i.id];
      const t = a ? joinQty(a.cases, a.loose, i.pcs_per_case) : null;
      return [i.id, t === null ? "" : String(t)];
    }));

  return (
    <Section title="Decision" description="Set the approved quantity for each item, then approve. Approving records your name and today's date.">
      <div className="space-y-4 p-4">
        <div className="space-y-3">
          {note.items.map((i) => (
            <div key={i.id} className="grid items-center gap-3 sm:grid-cols-[1fr_16rem]">
              <div className="text-[13px]">
                <span className="font-medium">{i.material_name}</span>
                <span className="ml-2 text-muted-foreground">
                  claimed {qtyText(i.claim_qty, i.return_unit, i.pcs_per_case) || "—"}
                </span>
              </div>
              <QtyInput unit={i.return_unit} ppc={i.pcs_per_case} cases={approved[i.id]?.cases ?? ""} loose={approved[i.id]?.loose ?? ""}
                onChange={(cases, loose) => setApproved((a) => ({ ...a, [i.id]: { cases, loose } }))} />
            </div>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Remark (required to reject)</span>
          <Input value={remark} onChange={(e) => setRemark(e.target.value)} />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={pending} onClick={() => run(() => decideCreditNote(note.id, "approved", totalsById(), remark))}>Approve</Button>
          <Button variant="outline" disabled={pending} onClick={() => run(() => decideCreditNote(note.id, "rejected", {}, remark))}>Reject</Button>
          {error ? <span className="text-[13px] font-semibold text-destructive">{error}</span> : null}
        </div>
      </div>
    </Section>
  );
}
