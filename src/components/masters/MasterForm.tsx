"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveEntity } from "@/lib/masters/entity/actions";
import type { Field } from "@/lib/masters/types";

interface Props {
  slug: string;
  /** null when adding */
  id: string | null;
  fields: Field[];
  refs: Record<string, Array<{ value: string; label: string }>>;
  suggestions: Record<string, string[]>;
  values: Record<string, string | null>;
}

const input =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

export function MasterForm({ slug, id, fields, refs, suggestions, values }: Props) {
  const [state, action, pending] = useActionState(saveEntity.bind(null, slug, id), null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      {state && !state.ok ? (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
        {fields.map((f) => {
          const locked = !!id && !!f.lockOnEdit;
          const value = values[f.name] ?? "";
          const err = errors[f.name];
          const common = { id: `f_${f.name}`, name: f.name, disabled: locked, "aria-invalid": !!err || undefined } as const;
          return (
            <div key={f.name} className={f.wide ? "md:col-span-2" : ""}>
              {f.type === "bool" ? (
                <label className="flex h-9 items-center gap-2 text-sm font-medium">
                  <input type="checkbox" {...common} defaultChecked={value === "1"} className="h-4 w-4" />
                  {f.label}
                </label>
              ) : (
                <label htmlFor={common.id} className="mb-1 block text-xs font-semibold text-muted-foreground">
                  {f.label}
                  {f.required ? <span className="text-destructive"> *</span> : null}
                </label>
              )}

              {f.type === "textarea" ? (
                <textarea {...common} defaultValue={value} rows={3} className={`${input} h-auto py-2`} />
              ) : f.type === "select" ? (
                <select {...common} defaultValue={value} className={input}>
                  <option value="">-</option>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "ref" ? (
                <select {...common} defaultValue={value} className={input}>
                  <option value="">-</option>
                  {(refs[f.name] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "suggest" ? (
                <>
                  <input {...common} list={`l_${f.name}`} defaultValue={value} placeholder={f.placeholder} autoComplete="off" className={input} />
                  <datalist id={`l_${f.name}`}>{(suggestions[f.name] ?? []).map((o) => <option key={o} value={o} />)}</datalist>
                </>
              ) : f.type === "bool" ? null : (
                <input
                  {...common}
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  step={f.type === "number" ? "any" : undefined}
                  defaultValue={value}
                  placeholder={f.placeholder}
                  autoComplete="off"
                  className={input}
                />
              )}

              {err ? <p className="mt-1 text-xs font-medium text-destructive">{err}</p> : f.help ? <p className="mt-1 text-xs text-muted-foreground">{f.help}</p> : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button type="submit" disabled={pending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
          {pending ? "Saving…" : id ? "Save changes" : "Add"}
        </button>
        <Link href={`/orders/${slug}`} className="text-sm text-muted-foreground hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
