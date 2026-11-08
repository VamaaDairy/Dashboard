"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/cn/ui";
import { saveDepartmentAccessAction, saveDepartmentAction } from "@/app/employees/actions";
import { AccessEditor } from "@/components/access/AccessEditor";
import type { AccessMap } from "@/lib/access";
import type { Department } from "@/lib/employees";

const WING_OPTIONS = [{ v: "", label: "More than one group" }, { v: "salesforce", label: "Salesforce" }, { v: "plant", label: "Plant" }, { v: "office", label: "Office" }];
const input = "h-8 rounded-lg border border-input bg-background px-2.5 text-[13px] outline-none focus:border-foreground";

/** Departments: name, the group they belong to, on/off, and how many people are in each. */
export function DepartmentEditor({ departments, canEdit, canSetAccess }: { departments: Department[]; canEdit: boolean; canSetAccess: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", wing: "" });
  const [accessFor, setAccessFor] = useState<Department | null>(null);
  const [access, setAccess] = useState<AccessMap>({});
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
            <tr>{["Department", "Group", "People", "Dashboard logins", "Access", "Status", ""].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <Row key={d.id} d={d} canEdit={canEdit} pending={pending} save={save}
                onAccess={() => { setAccessFor(d); setAccess(d.access); }} />
            ))}
            {canEdit ? (
              <tr className="border-t border-border bg-muted/20">
                <td className="px-3 py-2"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="New department" className={input} /></td>
                <td className="px-3 py-2">
                  <select value={draft.wing} onChange={(e) => setDraft({ ...draft, wing: e.target.value })} className={input}>
                    {WING_OPTIONS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
                  </select>
                </td>
                <td colSpan={4} />
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="primary" disabled={pending || draft.name.trim().length < 2} onClick={() => save(draft, () => setDraft({ name: "", wing: "" }))}>Add</Button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {accessFor ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">What {accessFor.name} can open</h2>
            <span className="text-xs text-muted-foreground">
              Applies to its {accessFor.logins} dashboard login{accessFor.logins === 1 ? "" : "s"}; a person can be given more on the Users page.
            </span>
          </div>
          {canSetAccess ? null : <p className="text-sm text-muted-foreground">Only an owner can change this.</p>}
          <AccessEditor value={access} onChange={canSetAccess ? setAccess : () => {}} />
          <div className="flex gap-2">
            {canSetAccess ? (
              <Button variant="primary" disabled={pending} onClick={() => start(async () => {
                setError(null);
                const r = await saveDepartmentAccessAction(accessFor.id, access);
                if (!r.ok) return setError(r.error);
                setAccessFor(null);
                router.refresh();
              })}>{pending ? "Saving..." : "Save access"}</Button>
            ) : null}
            <Button variant="ghost" onClick={() => setAccessFor(null)}>Close</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ d, canEdit, pending, save, onAccess }: {
  d: Department; canEdit: boolean; pending: boolean; onAccess: () => void;
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
      <td className="num px-3 py-2">{d.logins}</td>
      <td className="px-3 py-2">
        <button type="button" onClick={onAccess} className="text-primary hover:underline">
          {Object.keys(d.access).length ? `${Object.keys(d.access).length} page${Object.keys(d.access).length === 1 ? "" : "s"}` : "Nothing yet"}
        </button>
      </td>
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
