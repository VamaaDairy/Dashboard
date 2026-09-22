"use client";

import { useState, useTransition } from "react";
import { addParameter, deleteParameter, setParameter } from "@/app/actions";
import { formatNumber } from "@/lib/format";

interface Param {
  id: string;
  key: string;
  label: string;
  group_name: string;
  value_num: number | null;
  formula: string | null;
  computed_num: number | null;
  error: string | null;
  suffix: string | null;
  description: string | null;
  decimals: number;
  is_locked: boolean;
}

export function ParameterTable({ parameters }: { parameters: Param[] }) {
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();

  const groups = new Map<string, Param[]>();
  for (const p of parameters) {
    const list = groups.get(p.group_name) ?? [];
    list.push(p);
    groups.set(p.group_name, list);
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1" />
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-foreground"
        >
          + Parameter
        </button>
      </div>

      {adding ? (
        <form
          action={(fd) => start(async () => {
            const res = await addParameter(fd);
            setError(res.ok ? null : res.error);
            if (res.ok) setAdding(false);
          })}
          className="mb-4 flex flex-wrap items-center gap-2 rounded border border-border bg-accent px-3 py-2"
        >
          <input name="key" required placeholder="key_name" className="w-48 rounded border border-border bg-card px-2 py-1 font-mono" />
          <input name="label" required placeholder="Label" className="w-64 rounded border border-border bg-card px-2 py-1" />
          <input name="group_name" placeholder="Group" className="w-40 rounded border border-border bg-card px-2 py-1" />
          <input name="value" placeholder="Value or =formula" className="w-48 rounded border border-border bg-card px-2 py-1" />
          <button className="rounded border border-border bg-white px-3 py-1 text-foreground hover:bg-accent">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="text-muted-foreground">Cancel</button>
        </form>
      ) : null}

      {error ? <div className="mb-3 rounded bg-destructive/10 px-3 py-2 text-destructive">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {[...groups].map(([group, list]) => (
          <section key={group} className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
            <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </div>
            <table className="w-full">
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="group border-b border-border/70">
                    <td className="px-3 py-1.5" title={p.description ?? undefined}>
                      {p.label}
                      <div className="font-mono text-[10px] text-muted-foreground">P.{p.key}</div>
                    </td>
                    <td className="w-44 px-2 py-1.5 text-right">
                      <ParamInput
                        param={p}
                        onError={setError}
                      />
                    </td>
                    <td className="w-24 px-2 py-1.5 text-right text-[11px] text-muted-foreground">
                      {p.formula ? (
                        <span className="num" title={`= ${p.formula}`}>
                          = {formatNumber(p.computed_num, p.decimals)}
                        </span>
                      ) : p.suffix === "%" && p.value_num !== null ? (
                        <span className="num font-semibold text-foreground">
                          {formatNumber(Number(p.value_num) * 100, 2)}%
                        </span>
                      ) : (
                        p.suffix ?? ""
                      )}
                    </td>
                    <td className="w-6 px-1 py-1.5">
                      {p.is_locked ? null : (
                        <button
                          onClick={() => start(async () => {
                            const res = await deleteParameter(p.id);
                            setError(res.ok ? null : res.error);
                          })}
                          className="invisible text-[11px] text-muted-foreground group-hover:visible hover:text-destructive"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}

function ParamInput({ param, onError }: { param: Param; onError: (e: string | null) => void }) {
  const source = param.formula ? `=${param.formula}` : param.value_num === null ? "" : String(param.value_num);
  const [, start] = useTransition();
  return (
    <input
      defaultValue={source}
      onBlur={(e) => {
        if (e.target.value === source) return;
        const raw = e.target.value;
        start(async () => {
          const res = await setParameter(param.id, raw);
          onError(res.ok ? null : res.error);
        });
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`num w-full rounded border border-border/70 bg-input/30 px-2 py-1 text-right focus:border-primary focus:outline-none ${
        param.formula ? "text-primary" : ""
      } ${param.error ? "border-red-400 text-destructive" : ""}`}
    />
  );
}
