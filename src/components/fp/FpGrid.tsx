"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { fpDelete, fpLoad, fpRowAction, fpSave } from "@/app/fp/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FormField, Option } from "@/lib/fp/crud";
import type { Detail } from "@/lib/fp/rowActions";

export interface GridCol { key: string; label: string; sql: string; sortHref: string; sorted: "asc" | "desc" | null }
export interface GridCell { _id: string; _status?: string; [k: string]: unknown }
export interface ActionDef { id: string; label: string; ask: "none" | "reason" | "quantities" | "payment"; tone?: "danger"; whenStatus?: string[] }

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

type Pending = { action: ActionDef; rowId: string } | null;

export function FpGrid({ routeKey, cols, rows, form, refs, editable, canEdit, title, actions, hasDetail, printBase, modes }: {
  routeKey: string; cols: GridCol[]; rows: GridCell[]; form: FormField[]; refs: Record<string, Option[]>;
  editable: boolean; canEdit: boolean; title: string;
  actions: ActionDef[]; hasDetail: boolean; printBase: string | null; modes: Option[];
}) {
  const allow = editable && canEdit;
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [ask, setAsk] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Detail | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const usable = (r: GridCell) => (canEdit ? actions.filter((a) => !a.whenStatus || (r._status !== undefined && a.whenStatus.includes(r._status))) : []);
  const showActionsCol = hasDetail || !!printBase || (canEdit && actions.length > 0);

  function open(id: string | "new") {
    setError(null);
    if (id === "new") {
      setValues(Object.fromEntries(form.map((f) => [f.field, f.sql === "boolean" ? "false" : ""])));
      setEditing("new");
      return;
    }
    start(async () => {
      const res = await fpLoad(routeKey, id);
      if (res.ok) { setValues({ ...Object.fromEntries(form.map((f) => [f.field, ""])), ...res.data }); setEditing(id); } else alert(res.error);
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
    start(async () => { const res = await fpDelete(routeKey, id); if (!res.ok) alert(res.error); });
  }

  async function loadDetail(id: string): Promise<Detail | null> {
    const res = await fetch(`/api/fp/detail?route=${encodeURIComponent(routeKey)}&id=${id}`).then((r) => r.json()).catch(() => null);
    if (!res?.success) { alert(res?.error ?? "Could not load"); return null; }
    return res.detail as Detail;
  }
  function view(id: string) { start(async () => { const d = await loadDetail(id); if (d) setDetail(d); }); }

  function begin(a: ActionDef, rowId: string) {
    setAskError(null); setReason(""); setAmount(""); setMode(modes[0]?.id ?? ""); setQty({}); setItems(null);
    if (a.ask === "none") {
      if (!confirm(`${a.label}?`)) return;
      start(async () => { const res = await fpRowAction(routeKey, a.id, rowId, {}); if (!res.ok) alert(res.error); });
      return;
    }
    setAsk({ action: a, rowId });
    if (a.ask === "quantities") {
      start(async () => {
        const d = await loadDetail(rowId);
        if (!d) { setAsk(null); return; }
        setItems(d);
        setQty(Object.fromEntries((d.tables[0]?.ids ?? []).map((id, i) => [id, String(d.tables[0].rows[i][2] ?? 0)])));
      });
    }
  }
  function confirmAsk() {
    if (!ask) return;
    setAskError(null);
    const input =
      ask.action.ask === "reason" ? { reason }
      : ask.action.ask === "quantities" ? { quantities: Object.fromEntries(Object.entries(qty).map(([k, v]) => [k, Number(v) || 0])) }
      : { amount: Number(amount.replace(/,/g, "")), modeUid: mode || null };
    start(async () => {
      const res = await fpRowAction(routeKey, ask.action.id, ask.rowId, input);
      if (res.ok) setAsk(null); else setAskError(res.error);
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
              {showActionsCol && <th className={TH} />}
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
                  return <td key={c.key} className={`whitespace-nowrap px-3 py-2 ${num ? "text-right tabular-nums" : ""} ${v === null || v === "" ? "text-muted-foreground" : "text-foreground"}`}>{fmtCell(v, c.sql)}</td>;
                })}
                {showActionsCol && (
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {hasDetail && <button onClick={() => view(r._id)} className="mr-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">View</button>}
                    {printBase && <a href={`${printBase}${r._id}`} target="_blank" rel="noreferrer" className="mr-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Print</a>}
                    {usable(r).map((a) => (
                      <button key={a.id} disabled={pending} onClick={() => begin(a, r._id)}
                        className={`mr-1.5 rounded-md border border-border px-2 py-0.5 text-[11px] font-medium hover:bg-muted ${a.tone === "danger" ? "text-destructive" : "text-foreground"}`}>{a.label}</button>
                    ))}
                  </td>
                )}
                {allow && (
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button onClick={() => open(r._id)} className="mr-2 text-muted-foreground hover:text-foreground" aria-label="Edit"><Pencil className="inline h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(r._id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete"><Trash2 className="inline h-3.5 w-3.5" /></button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + 3} className="px-4 py-12 text-center text-muted-foreground">No records match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* edit / add */}
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

      {/* view */}
      <Dialog open={detail !== null} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {detail && (
            <div className="space-y-4">
              <DialogHeader><DialogTitle>{detail.title}</DialogTitle></DialogHeader>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-3">
                {detail.facts.map(([k, v]) => (
                  <div key={k}><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="text-foreground">{v}</dd></div>
                ))}
              </dl>
              {detail.tables.map((t) => (
                <div key={t.title}>
                  <h3 className="mb-1 text-[12px] font-semibold text-foreground">{t.title}</h3>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-[12px]">
                      <thead className="bg-muted/40"><tr>{t.head.map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
                      <tbody>
                        {t.rows.map((row, i) => <tr key={i} className="border-t border-border/70">{row.map((c, j) => <td key={j} className="px-3 py-1.5 whitespace-nowrap">{c ?? "—"}</td>)}</tr>)}
                        {t.rows.length === 0 && <tr><td colSpan={t.head.length} className="px-3 py-4 text-center text-muted-foreground">Nothing recorded.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <DialogFooter><Button type="button" onClick={() => setDetail(null)}>Close</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ask: reason / quantities / payment */}
      <Dialog open={ask !== null} onOpenChange={(o) => { if (!o) setAsk(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {ask && (
            <div className="space-y-4">
              <DialogHeader><DialogTitle>{ask.action.label}</DialogTitle></DialogHeader>
              {ask.action.ask === "reason" && (
                <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Reason
                  <input autoFocus className={FIELD} value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
              )}
              {ask.action.ask === "payment" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Amount paid
                    <input autoFocus inputMode="decimal" className={FIELD} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Payment mode
                    <select className={FIELD} value={mode} onChange={(e) => setMode(e.target.value)}>{modes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
                  </label>
                </div>
              )}
              {ask.action.ask === "quantities" && (
                items ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-[12px]">
                      <thead className="bg-muted/40"><tr><th className={TH}>SKU</th><th className={TH}>Product</th><th className={TH}>Ordered</th><th className={TH}>Seller stock</th><th className={TH}>Accept qty</th></tr></thead>
                      <tbody>
                        {items.tables[0].rows.map((row, i) => {
                          const id = items.tables[0].ids![i];
                          return (
                            <tr key={id} className="border-t border-border/70">
                              <td className="px-3 py-1.5">{row[0]}</td><td className="px-3 py-1.5">{row[1]}</td>
                              <td className="px-3 py-1.5 tabular-nums">{row[2]}</td><td className="px-3 py-1.5 tabular-nums">{row[4]}</td>
                              <td className="px-3 py-1"><input inputMode="decimal" className={`${FIELD} w-24`} value={qty[id] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [id]: e.target.value }))} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-[13px] text-muted-foreground">Loading items…</p>
              )}
              {askError && <p className="text-[12px] text-destructive">{askError}</p>}
              <DialogFooter>
                <Button type="button" onClick={() => setAsk(null)}>Cancel</Button>
                <Button type="button" variant="primary" disabled={pending || (ask.action.ask === "quantities" && !items)} onClick={confirmAsk}>{pending ? "Working…" : ask.action.label}</Button>
              </DialogFooter>
            </div>
          )}
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
