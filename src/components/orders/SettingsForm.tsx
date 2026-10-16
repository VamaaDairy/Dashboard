"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "@/app/orders/actions";
import { Button } from "@/components/ui/button";
import type { SettingDef } from "@/lib/orders/settings";

const FIELD = "h-8 w-full max-w-xs rounded-lg border border-border bg-background px-2 text-[13px] outline-none focus:border-primary";

export function SettingsForm({ defs, values, canEdit }: { defs: SettingDef[]; values: Record<string, string>; canEdit: boolean }) {
  const [v, setV] = useState(values);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const groups = [...new Set(defs.map((d) => d.group))];

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveSettingsAction(v);
      setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="space-y-6 p-4">
      {groups.map((g) => (
        <section key={g} className="space-y-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{g}</h3>
          {defs.filter((d) => d.group === g).map((d) => (
            <label key={d.key} className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-foreground">{d.label}</span>
              {d.type === "bool" ? (
                <input type="checkbox" disabled={!canEdit} checked={v[d.key] === "true"} className="h-4 w-4"
                  onChange={(e) => setV({ ...v, [d.key]: String(e.target.checked) })} />
              ) : d.type === "select" ? (
                <select disabled={!canEdit} className={FIELD} value={v[d.key]} onChange={(e) => setV({ ...v, [d.key]: e.target.value })}>
                  {d.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input disabled={!canEdit} className={FIELD} type={d.type === "time" ? "time" : "text"} inputMode={d.type === "number" ? "decimal" : undefined}
                  value={v[d.key]} onChange={(e) => setV({ ...v, [d.key]: e.target.value })} />
              )}
              {d.hint && <span className="text-[12px] text-muted-foreground">{d.hint}</span>}
            </label>
          ))}
        </section>
      ))}
      {canEdit && (
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
          {msg && <span className={`text-[13px] ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
