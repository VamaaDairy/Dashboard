"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteEntity, saveEntity } from "@/app/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ENTITIES, type Col } from "@/lib/orders/entities";
import type { Option, Row } from "@/lib/orders/crud";
import { inr, StatusChip, TD, TH } from "./common";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function initial(c: Col): string {
  if (c.initial === "today") return today();
  if (c.initial === "thismonth") return today().slice(0, 7);
  return c.initial ?? "";
}

const FIELD = "h-8 w-full rounded-lg border border-border bg-background px-2 text-[13px] outline-none focus:border-primary";

function show(c: Col, row: Row) {
  const v = row[c.key];
  if (c.type === "ref") return (row[`${c.key}__label`] as string | null) ?? "—";
  if (v === null || v === undefined || v === "") return "—";
  if (c.type === "bool") return v ? "Yes" : "No";
  if (c.type === "money") return inr(Number(v));
  if (c.chip) return <StatusChip value={String(v)} />;
  if (c.type === "select") return String(v).replace(/_/g, " ");
  return String(v);
}

export function EntityTable({ entity, rows, refs, canEdit }: {
  entity: string; rows: Row[]; refs: Record<string, Option[]>; canEdit: boolean;
}) {
  const def = ENTITIES[entity];
  const listCols = def.cols.filter((c) => !c.hideInList);
  const formCols = def.cols.filter((c) => !c.hideInForm);
  const rowEdit = canEdit && def.editable !== false;
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open(row: Row | "new") {
    const v: Record<string, string> = {};
    for (const c of formCols) {
      const cur = row === "new" ? undefined : row[c.key];
      v[c.key] = row === "new" ? initial(c) : c.type === "bool" ? String(!!cur) : cur === null || cur === undefined ? "" : String(cur);
    }
    setValues(v);
    setError(null);
    setEditing(row);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveEntity(entity, editing === "new" || !editing ? null : editing.id, values);
      if (res.ok) setEditing(null); else setError(res.error);
    });
  }

  function remove(row: Row) {
    if (!confirm(`Delete this ${def.singular}?`)) return;
    start(async () => {
      const res = await deleteEntity(entity, row.id);
      if (!res.ok) alert(res.error);
    });
  }

  return (
    <>
      {canEdit && def.editable !== false && (
        <div className="flex justify-end border-b border-border px-4 py-2">
          <Button variant="primary" size="sm" onClick={() => open("new")}><Plus /> Add {def.singular}</Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {listCols.map((c) => <th key={c.key} className={`${TH} ${c.type === "money" || c.type === "number" ? "text-right" : ""}`}>{c.label}</th>)}
              {rowEdit && <th className={TH} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/70 hover:bg-muted/50">
                {listCols.map((c, i) => (
                  <td key={c.key} className={`${TD} ${i === 0 ? "font-medium text-foreground" : "text-muted-foreground"} ${c.type === "money" || c.type === "number" ? "text-right tabular-nums" : ""}`}>
                    {show(c, r)}
                  </td>
                ))}
                {rowEdit && (
                  <td className={`${TD} whitespace-nowrap text-right`}>
                    <button onClick={() => open(r)} className="mr-2 text-muted-foreground hover:text-foreground" aria-label="Edit"><Pencil className="inline h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(r)} className="text-muted-foreground hover:text-destructive" aria-label="Delete"><Trash2 className="inline h-3.5 w-3.5" /></button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={listCols.length + 1} className="px-4 py-10 text-center text-muted-foreground">No {def.title.toLowerCase()} yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing === "new" ? `Add ${def.singular}` : `Edit ${def.singular}`}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {formCols.map((c) => (
                <label key={c.key} className={`flex flex-col gap-1 text-[12px] font-medium text-muted-foreground ${c.type === "textarea" ? "sm:col-span-2" : ""}`}>
                  <span>{c.label}{c.required && <span className="text-destructive"> *</span>}</span>
                  <FormField col={c} value={values[c.key] ?? ""} refs={refs} onChange={(v) => setValues((s) => ({ ...s, [c.key]: v }))} />
                </label>
              ))}
            </div>
            {error && <p className="text-[12px] text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FormField({ col, value, refs, onChange }: { col: Col; value: string; refs: Record<string, Option[]>; onChange: (v: string) => void }) {
  if (col.type === "bool")
    return <input type="checkbox" checked={value === "true"} onChange={(e) => onChange(String(e.target.checked))} className="h-4 w-4" />;
  if (col.type === "textarea")
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="rounded-lg border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:border-primary" />;
  if (col.type === "select")
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        {!col.required && !col.initial && <option value="" />}
        {col.options!.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
      </select>
    );
  if (col.type === "ref")
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        <option value="">{col.required ? "Pick one…" : "—"}</option>
        {(refs[col.ref!] ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  const type = col.type === "date" ? "date" : col.type === "time" ? "time" : "text";
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      inputMode={col.type === "number" || col.type === "money" ? "decimal" : undefined} className={FIELD} />
  );
}
