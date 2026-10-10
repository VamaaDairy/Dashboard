"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { saveCreditNote } from "@/app/credit-note/actions";
import { Section } from "@/components/tanks/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkuPicker } from "@/components/creditnote/SkuPicker";
import { QtyInput } from "@/components/creditnote/QtyInput";
import { splitQty } from "@/lib/creditnote/qty";
import type { CreditNote, SkuOption } from "@/lib/creditnote/data";

const lbl = "mb-1 block text-[11px] font-medium text-muted-foreground";
const sel = "h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-neutral-900 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const UNITS = ["Pcs", "CRT", "Kg", "Ltr", "Box", "Case"];

function Field({ label, name, type = "text", value, required }: {
  label: string; name: string; type?: string; value?: string | null; required?: boolean;
}) {
  return (
    <label>
      <span className={lbl}>{label}{required ? <span className="text-destructive"> *</span> : null}</span>
      <Input name={name} type={type} defaultValue={value ?? ""} required={required} />
    </label>
  );
}

interface Row {
  key: number; material_name: string; reason: string; mfd: string; ubd: string; quality_remark: string; return_unit: string;
  claim_cases: string; claim_loose: string;
}
const blank = (key: number): Row => ({
  key, material_name: "", reason: "", mfd: "", ubd: "", quality_remark: "", return_unit: "Pcs",
  claim_cases: "", claim_loose: "",
});

/** New credit note, or edit one that is still pending. Any number of items; approval is decided on the note's own page. */
export function CreditNoteForm({ note, today, skus }: { note?: CreditNote; today: string; skus: SkuOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() =>
    note && note.items.length
      ? note.items.map((i, n) => {
          const clm = i.claim_qty === null ? null : splitQty(i.claim_qty, i.pcs_per_case);
          return {
            key: n, material_name: i.material_name, reason: i.reason ?? "", mfd: i.mfd ?? "", ubd: i.ubd ?? "", quality_remark: i.quality_remark ?? "",
            return_unit: i.return_unit,
            claim_cases: clm ? String(clm.cases) : "", claim_loose: clm?.loose ? String(clm.loose) : "",
          };
        })
      : [blank(0)],
  );
  const [nextKey, setNextKey] = useState(rows.length);

  const set = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const add = () => { setRows((r) => [...r, blank(nextKey)]); setNextKey((k) => k + 1); };
  const remove = (key: number) => setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));

  function submit(f: FormData) {
    f.set("items", JSON.stringify(rows.map(({ key: _k, ...rest }) => rest)));
    start(async () => {
      const res = await saveCreditNote(note?.id ?? null, f);
      if (!res.ok) { setError(res.error); return; }
      setError(null);
      router.push(`/credit-note/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-5">
      <Section title="Customer">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Challan No." name="challan_no" value={note?.challan_no} required />
          <Field label="Date" name="challan_date" type="date" value={note?.challan_date ?? today} required />
          <Field label="Name of Customer" name="customer_name" value={note?.customer_name} required />
          <Field label="Contact No." name="contact_no" value={note?.contact_no} />
          <label className="sm:col-span-2">
            <span className={lbl}>Address</span>
            <textarea
              name="address" defaultValue={note?.address ?? ""} rows={2}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
        </div>
      </Section>

      <Section title="Dispatch">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Dispatch Bill/Challan No." name="dispatch_challan_no" value={note?.dispatch_challan_no} />
          <Field label="Dispatch Date" name="dispatch_date" type="date" value={note?.dispatch_date} />
          <Field label="Vehicle No." name="vehicle_no" value={note?.vehicle_no} />
          <Field label="Checked by" name="checked_by" value={note?.checked_by} />
          <Field label="Team (Name)" name="team_name" value={note?.team_name} />
        </div>
      </Section>

      <Section
        title="Items returned"
        description="One block per material. Add as many as the challan has."
        actions={<Button type="button" variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4" /> Add item</Button>}
      >
        <div className="divide-y divide-border">
          {rows.map((r, n) => (
            <div key={r.key} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-tertiary-foreground">Item {n + 1}</span>
                {rows.length > 1 ? (
                  <button type="button" onClick={() => remove(r.key)} title="Remove item"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className={lbl}>Name of the Material <span className="text-destructive">*</span></span>
                  <SkuPicker skus={skus} value={r.material_name} onChange={(v) => set(r.key, { material_name: v })} />
                </label>
                <label>
                  <span className={lbl}>Reason</span>
                  <Input value={r.reason} onChange={(e) => set(r.key, { reason: e.target.value })} />
                </label>
                <label>
                  <span className={lbl}>MFD</span>
                  <Input type="date" value={r.mfd} onChange={(e) => set(r.key, { mfd: e.target.value })} />
                </label>
                <label>
                  <span className={lbl}>U.B.D.</span>
                  <Input type="date" value={r.ubd} onChange={(e) => set(r.key, { ubd: e.target.value })} />
                </label>
                {(() => {
                  const sku = skus.find((k) => k.name === r.material_name);
                  const ppc = sku ? sku.pcs_per_case : 1;
                  const unit = sku ? sku.case_unit : r.return_unit;
                  return (
                    <>
                      {sku ? (
                        <p className="text-[12px] text-muted-foreground sm:col-span-2">
                          Counted in {sku.case_unit}{ppc > 1 ? ` (1 ${sku.case_unit} = ${ppc} pcs) - enter whole ${sku.case_unit} and loose pieces` : ""}.
                        </p>
                      ) : (
                        <label className="sm:col-span-2">
                          <span className={lbl}>Unit</span>
                          <select className={sel} value={r.return_unit} onChange={(e) => set(r.key, { return_unit: e.target.value })}>
                            {UNITS.map((u) => <option key={u} value={u} className="bg-white text-neutral-900">{u}</option>)}
                          </select>
                        </label>
                      )}
                      <div>
                        <span className={lbl}>Claim Qty. <span className="text-destructive">*</span></span>
                        <QtyInput unit={unit} ppc={ppc} cases={r.claim_cases} loose={r.claim_loose}
                          onChange={(c, l) => set(r.key, { claim_cases: c, claim_loose: l })} />
                      </div>
                    </>
                  );
                })()}
                <label className="sm:col-span-2">
                  <span className={lbl}>Quality Remark</span>
                  <Input value={r.quality_remark} onChange={(e) => set(r.key, { quality_remark: e.target.value })} />
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <Button type="button" variant="ghost" size="sm" onClick={add}><Plus className="h-4 w-4" /> Add another item</Button>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : note ? "Save changes" : "Create credit note"}</Button>
        <Link href={note ? `/credit-note/${note.id}` : "/credit-note"} className="text-sm text-muted-foreground hover:underline">Cancel</Link>
        {error ? <span className="text-[13px] font-semibold text-destructive">{error}</span> : null}
      </div>
    </form>
  );
}
