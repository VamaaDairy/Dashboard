"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { fpDelete, fpLoad, fpSave } from "@/app/fp/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FormField, Option } from "@/lib/fp/crud";

export interface GridCol { key: string; label: string; sql: string; sortHref: string; sorted: "asc" | "desc" | null }
export interface GridCell { _id: string; [k: string]: unknown }

const TH = "whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const FIELD = "h-8 w-full rounded-lg border border-border bg-background px-2 text-[13px] outline-none focus:border-primary";

export function fmtCell(v: unknown, sql: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (sql === "timestamptz" && typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-IN") : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (typeof v === "object") { const s = JSON.stringify(v); return s.length > 60 ? s.slice(0, 57) + "…" : s; }
  return String(v);
}

export function FpGrid({ routeKey, cols, rows, form, refs, editable, canEdit, title }: {
  routeKey: string; cols: GridCol[]; rows: GridCell[]; form: FormField[]; refs: Record<string, Option[]>;
  editable: boolean; canEdit: boolean; title: string;
}) {
  const allow = editable && canEdit;
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open(id: string | "new") {
    setError(null);
    if (id === "new") {
      setValues(Object.fromEntries(form.map((f) => [f.field, f.sql === "boolean" ? "false" : ""])));
      setEditing("new");
      return;
    }
    start(async () => {
      const res = await fpLoad(routeKey, id);
      if (res.ok) {
        setValues({ ...Object.fromEntries(form.map((f) => [f.field, ""])), ...res.data });
        setEditing(id);
      } else alert(res.error);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await fpSave(routeKey, editing === "new" ? null : editing, values);
      if (res.ok) setEditing(null); else setError(res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this record?")) return;
    start(async () => {
      const res = await fpDelete(routeKey, id);
      if (!res.ok) alert(res.error);
    });
  }

  return (
    <>
      {allow && (
        <div className="flex justify-end border-b border-border px-4 py-2">
          <Button variant="primary" size="sm" onClick={() => open("new")}><Plus /> Add</Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className={`${TH} w-10`}>#</th>
              {cols.map((c) => (
                <th key={c.key} className={TH}>
                  <Link href={c.sortHref} className="inline-flex items-center gap-1 hover:text-foreground">
                    {c.label}{c.sorted === "asc" ? <ArrowUp className="h-3 w-3" /> : c.sorted === "desc" ? <ArrowDown className="h-3 w-3" /> : null}
                  </Link>
                </th>
              ))}
              {allow && <th className={TH} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r._id} className="border-b border-border/70 hover:bg-muted/50">
                <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                {cols.map((c) => {
                  const v = r[c.key];
                  const num = typeof v === "number";
                  return <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${num ? "text-right tabular-nums" : ""} ${v === null || v === "" ? "text-muted-foreground" : "text-foreground"}`}>{fmtCell(v, c.sql)}</td>;
                })}
                {allow && (
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button onClick={() => open(r._id)} className="mr-2 text-muted-foreground hover:text-foreground" aria-label="Edit"><Pencil className="inline h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(r._id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete"><Trash2 className="inline h-3.5 w-3.5" /></button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + 2} className="px-4 py-12 text-center text-muted-foreground">No records match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing === "new" ? "Add" : "Edit"} {title.toLowerCase()}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {form.map((f) => (
                <label key={f.field} className={`flex flex-col gap-1 text-[12px] font-medium text-muted-foreground ${f.sql === "jsonb" ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                  <span>{f.label}{f.required && <span className="text-destructive"> *</span>}</span>
                  <Input f={f} value={values[f.field] ?? ""} refs={refs} onChange={(v) => setValues((s) => ({ ...s, [f.field]: v }))} />
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

function Input({ f, value, refs, onChange }: { f: FormField; value: string; refs: Record<string, Option[]>; onChange: (v: string) => void }) {
  if (f.sql === "boolean") return <input type="checkbox" checked={value === "true"} onChange={(e) => onChange(String(e.target.checked))} className="h-4 w-4" />;
  if (f.ref) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        <option value="">{f.required ? "Pick one…" : "—"}</option>
        {(refs[f.ref] ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }
  if (f.sql === "jsonb") return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder="JSON" className="rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-[12px] outline-none focus:border-primary" />;
  const type = f.sql === "timestamptz" ? "datetime-local" : "text";
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} inputMode={f.sql === "integer" || f.sql === "bigint" || f.sql === "double precision" ? "decimal" : undefined} className={FIELD} />;
}
