"use client";

import { useState, useTransition } from "react";
import { fpSaveConfig } from "@/app/fp/actions";
import { Button } from "@/components/ui/button";
import type { CfgField, Flag } from "@/lib/fp/configs";

const FIELD = "h-8 w-full max-w-xs rounded-lg border border-border bg-background px-2 text-[13px] outline-none focus:border-primary";

/** Edits one record's JSON settings: typed fields or on/off switches. */
export function ConfigEditor({ routeKey, recordId, mode, fields, flags, initial, canEdit, custom }: {
  routeKey: string; recordId: string; mode: "object" | "flags"; fields?: CfgField[]; flags?: Flag[]; initial: Record<string, unknown>; canEdit: boolean; custom?: boolean;
}) {
  const [v, setV] = useState<Record<string, unknown>>(initial);
  const [extra, setExtra] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const known = new Set((flags ?? []).map((f) => f.key));
  const own = Object.keys(v).filter((k) => !known.has(k));
  const all: Flag[] = [...(flags ?? []), ...own.map((k) => ({ key: k, label: k }))];

  function save() {
    setMsg(null);
    start(async () => {
      const res = await fpSaveConfig(routeKey, recordId, v);
      setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="space-y-5 p-4">
      {mode === "object" ? (
        <div className="space-y-4">
          {fields!.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-foreground">{f.label}</span>
              {f.type === "select" ? (
                <select disabled={!canEdit} className={FIELD} value={String(v[f.key] ?? "")} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                  <option value="">—</option>{f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea disabled={!canEdit} rows={4} className="max-w-xl rounded-lg border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:border-primary" value={String(v[f.key] ?? "")} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
              ) : f.type === "check" ? (
                <input type="checkbox" disabled={!canEdit} className="h-4 w-4" checked={v[f.key] === true} onChange={(e) => setV({ ...v, [f.key]: e.target.checked })} />
              ) : (
                <input disabled={!canEdit} className={FIELD} inputMode={f.type === "number" ? "decimal" : undefined} value={String(v[f.key] ?? "")} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
              )}
              {f.hint && <span className="text-[12px] text-muted-foreground">{f.hint}</span>}
            </label>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 text-[12px]">
            <button type="button" disabled={!canEdit} className="text-muted-foreground hover:text-foreground" onClick={() => setV(Object.fromEntries(all.map((f) => [f.key, true])))}>Select all</button>
            <button type="button" disabled={!canEdit} className="text-muted-foreground hover:text-foreground" onClick={() => setV(Object.fromEntries(all.map((f) => [f.key, false])))}>Clear all</button>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {all.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-[13px] text-foreground">
                <input type="checkbox" disabled={!canEdit} className="h-4 w-4" checked={v[f.key] === true} onChange={(e) => setV({ ...v, [f.key]: e.target.checked })} />
                {f.label}
              </label>
            ))}
          </div>
          {custom && canEdit && (
            <div className="flex items-center gap-2">
              <input className={FIELD} placeholder="Add another key" value={extra} onChange={(e) => setExtra(e.target.value)} />
              <Button type="button" size="sm" onClick={() => { const k = extra.trim(); if (k) { setV({ ...v, [k]: true }); setExtra(""); } }}>Add</Button>
            </div>
          )}
        </>
      )}
      {canEdit && (
        <div className="flex items-center gap-3">
          <Button variant="primary" disabled={pending} onClick={save}>{pending ? "Saving…" : "Update"}</Button>
          {msg && <span className={`text-[13px] ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
