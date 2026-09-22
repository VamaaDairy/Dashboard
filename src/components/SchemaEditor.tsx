"use client";

import { useState, useTransition } from "react";
import { addClass, addField, deleteClass, deleteField, updateClass, updateField } from "@/app/actions";

interface Field {
  id: string;
  key: string;
  label: string;
  data_type: string;
  group_label: string | null;
  default_formula: string | null;
  default_value: number | null;
  rollup_group: string | null;
  is_total: boolean;
  is_locked: boolean;
  decimals: number;
  usage: number;
}

interface Klass {
  id: string;
  code: string;
  name: string;
  plural_name: string | null;
  cost_field: string | null;
  object_count: number;
  fields: Field[];
}

export function SchemaEditor({ classes }: { classes: Klass[] }) {
  const [error, setError] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addingClass, setAddingClass] = useState(false);
  const [, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      setError(res.ok ? null : res.error);
    });

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <p className="max-w-2xl text-[12px] text-muted-foreground">
          Tag a column so a total sums it; delete one and the model reshapes itself.
        </p>
        <div className="flex-1" />
        <button
          onClick={() => setAddingClass((v) => !v)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-foreground"
        >
          + Class
        </button>
      </div>

      {addingClass ? (
        <form
          action={(fd) => start(async () => {
            const res = await addClass(fd);
            setError(res.ok ? null : res.error);
            if (res.ok) setAddingClass(false);
          })}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-accent px-3 py-2.5"
        >
          <input name="code" required placeholder="class_code" className="w-48 rounded border border-border bg-card px-2 py-1 font-mono" />
          <input name="name" required placeholder="Name" className="w-56 rounded border border-border bg-card px-2 py-1" />
          <input name="plural_name" placeholder="Plural name" className="w-56 rounded border border-border bg-card px-2 py-1" />
          <button className="rounded-lg border border-border bg-white px-3 py-1.5 text-foreground font-medium hover:bg-accent">Add class</button>
          <button type="button" onClick={() => setAddingClass(false)} className="text-muted-foreground">Cancel</button>
        </form>
      ) : null}

      {error ? <div className="rounded bg-destructive/10 px-3 py-2 text-destructive">{error}</div> : null}

      {classes.map((c) => (
        <section key={c.id} id={c.code} className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
            <h2 className="font-semibold">{c.plural_name ?? c.name}</h2>
            <span className="font-mono text-[11px] text-muted-foreground">{c.code}</span>
            <span className="text-[11px] text-muted-foreground">{c.object_count} rows</span>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              unit cost column
              <select
                defaultValue={c.cost_field ?? ""}
                onChange={(e) => run(() => updateClass(c.id, { cost_field: e.target.value }))}
                className="rounded border border-border bg-input/30 px-1.5 py-0.5 font-mono"
              >
                <option value="">— none —</option>
                {c.fields.map((f) => <option key={f.id} value={f.key}>{f.key}</option>)}
              </select>
            </label>
            <div className="flex-1" />
            <button
              onClick={() => setAddingTo(addingTo === c.id ? null : c.id)}
              className="rounded border border-border px-2 py-0.5 text-[11px] hover:border-primary hover:text-foreground"
            >
              + Column
            </button>
            {c.object_count === 0 ? (
              <button
                onClick={() => run(() => deleteClass(c.id))}
                className="text-[11px] text-muted-foreground hover:text-destructive"
              >
                Delete class
              </button>
            ) : null}
          </div>

          {addingTo === c.id ? (
            <form
              action={(fd) => start(async () => {
                const res = await addField(fd);
                setError(res.ok ? null : res.error);
                if (res.ok) setAddingTo(null);
              })}
              className="flex flex-wrap items-center gap-2 border-b border-border bg-accent px-3 py-2"
            >
              <input type="hidden" name="class_id" value={c.id} />
              <input name="key" required placeholder="column_key" className="w-44 rounded border border-border bg-card px-2 py-1 font-mono" />
              <input name="label" required placeholder="Label" className="w-52 rounded border border-border bg-card px-2 py-1" />
              <input name="default" placeholder="Default value or =formula" className="w-72 rounded border border-border bg-card px-2 py-1" />
              <input name="rollup_tag" placeholder="Sum into (tag)" className="w-40 rounded border border-border bg-card px-2 py-1" />
              <button className="rounded-lg border border-border bg-white px-3 py-1.5 text-foreground font-medium hover:bg-accent">Add column</button>
              <button type="button" onClick={() => setAddingTo(null)} className="text-muted-foreground">Cancel</button>
            </form>
          ) : null}

          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-1.5 text-left font-semibold">Key</th>
                <th className="px-2 py-1.5 text-left font-semibold">Label</th>
                <th className="px-2 py-1.5 text-left font-semibold">Group</th>
                <th className="px-2 py-1.5 text-left font-semibold">Default formula</th>
                <th className="px-2 py-1.5 text-right font-semibold">Dec</th>
                <th className="px-2 py-1.5 text-right font-semibold">Overrides</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {c.fields.map((f) => (
                <tr key={f.id} className="group border-b border-border/70">
                  <td className="px-3 py-1 font-mono text-[11px]">
                    {f.key}
                    {f.is_total ? <span className="ml-1.5 text-[10px] text-foreground">total</span> : null}
                    {f.rollup_group ? (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">Σ {f.rollup_group}</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1">
                    <Inline
                      defaultValue={f.label}
                      onCommit={(v) => run(() => updateField(f.id, { label: v }))}
                      className="w-48"
                    />
                  </td>
                  <td className="px-2 py-1 text-[11px] text-muted-foreground">{f.group_label ?? "—"}</td>
                  <td className="px-2 py-1">
                    <Inline
                      defaultValue={f.default_formula ?? ""}
                      placeholder={f.default_value !== null ? `default ${f.default_value}` : "—"}
                      onCommit={(v) => run(() => updateField(f.id, { default_formula: v }))}
                      className="w-full font-mono text-primary"
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Inline
                      defaultValue={String(f.decimals)}
                      onCommit={(v) => run(() => updateField(f.id, { decimals: Number(v) || 0 }))}
                      className="num w-10 text-right"
                    />
                  </td>
                  <td className="num px-2 py-1 text-right text-[11px] text-muted-foreground">{f.usage}</td>
                  <td className="px-2 py-1">
                    {f.is_locked ? null : (
                      <button
                        onClick={() => run(() => deleteField(f.id))}
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
  );
}

function Inline({
  defaultValue, onCommit, placeholder, className = "",
}: {
  defaultValue: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      defaultValue={defaultValue}
      placeholder={placeholder}
      onBlur={(e) => { if (e.target.value !== defaultValue) onCommit(e.target.value); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-border focus:border-primary focus:outline-none ${className}`}
    />
  );
}
