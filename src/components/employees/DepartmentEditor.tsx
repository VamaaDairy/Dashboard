"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/cn/ui";
import { saveDepartmentAction } from "@/app/employees/actions";
import type { Department } from "@/lib/employees";

const WING_OPTIONS = [{ v: "", label: "More than one group" }, { v: "salesforce", label: "Salesforce" }, { v: "plant", label: "Plant" }, { v: "office", label: "Office" }];
const input = "h-8 rounded-lg border border-input bg-background px-2.5 text-[13px] outline-none focus:border-foreground";

/** Departments: name, the group they belong to, on/off, and how many people are in each. */
export function DepartmentEditor({ departments, canEdit }: { departments: Department[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", wing: "" });
  const save = (d: { id?: number; name: string; wing: string; active?: boolean }, done?: () => void) =>
    start(async () => {
      setError(null);
      const r = await saveDepartmentAction(d);
      if (!r.ok) return setError(r.error);
      done?.();
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>{["Department", "Group", "People", "Status", ""].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {departments.map((d) => <Row key={d.id} d={d} canEdit={canEdit} pending={pending} save={save} />)}
            {canEdit ? (
              <tr className="border-t border-border bg-muted/20">
                <td className="px-3 py-2"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="New department" className={input} /></td>
                <td className="px-3 py-2">
                  <select value={draft.wing} onChange={(e) => setDraft({ ...draft, wing: e.target.value })} className={input}>
                    {WING_OPTIONS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
                  </select>
                </td>
                <td colSpan={2} />
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="primary" disabled={pending || draft.name.trim().length < 2} onClick={() => save(draft, () => setDraft({ name: "", wing: "" }))}>Add</Button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ d, canEdit, pending, save }: {
  d: Department; canEdit: boolean; pending: boolean;
  save: (d: { id?: number; name: string; wing: string; active?: boolean }, done?: () => void) => void;
}) {
  const [name, setName] = useState(d.name);
  const [wing, setWing] = useState(d.wing ?? "");
  const changed = name.trim() !== d.name || wing !== (d.wing ?? "");
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">{canEdit ? <input value={name} onChange={(e) => setName(e.target.value)} className={input} /> : d.name}</td>
      <td className="px-3 py-2">
        {canEdit ? (
          <select value={wing} onChange={(e) => setWing(e.target.value)} className={input}>
            {WING_OPTIONS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
          </select>
        ) : WING_OPTIONS.find((w) => w.v === (d.wing ?? ""))?.label}
      </td>
      <td className="num px-3 py-2">{d.people ? <Link href={`/employees/${d.wing ?? "unset"}?dept=${d.id}`} className="text-primary hover:underline">{d.people}</Link> : 0}</td>
      <td className="px-3 py-2">{d.active ? <Pill tone="success">In use</Pill> : <Pill>Off</Pill>}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        {canEdit && changed ? <Button size="sm" variant="primary" disabled={pending} onClick={() => save({ id: d.id, name, wing })}>Save</Button> : null}
        {canEdit ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => save({ id: d.id, name: d.name, wing: d.wing ?? "", active: !d.active })}>
            {d.active ? "Switch off" : "Switch on"}
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
