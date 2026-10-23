"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
  /** photos already held (photos field) */
  photos?: Array<{ id: string; url: string }>;
}

const input =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

/** Phone photos are several MB: shrink to 1280 px JPEG in the browser before they are sent. */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // a PNG with transparency would turn black as a JPEG
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

function Photos({ name, held }: { name: string; held: Array<{ id: string; url: string }> }) {
  const [previews, setPreviews] = useState<string[]>([]);
  return (
    <div className="space-y-2">
      {held.length ? (
        <div className="flex flex-wrap gap-3">
          {held.map((p) => (
            <label key={p.id} className="space-y-1 text-center text-xs text-muted-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element -- stored product photo */}
              <img src={p.url} alt="" className="h-24 w-24 rounded-lg border border-border object-cover" />
              <span className="flex items-center justify-center gap-1">
                <input type="checkbox" name={`${name}_remove`} value={p.id} /> Remove
              </span>
            </label>
          ))}
        </div>
      ) : null}
      <input
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        multiple
        className={input + " pt-1.5"}
        onChange={async (e) => {
          const el = e.currentTarget;
          const files = await Promise.all(Array.from(el.files ?? []).map(shrink));
          const dt = new DataTransfer();
          files.forEach((f) => dt.items.add(f));
          el.files = dt.files;
          setPreviews(files.map((f) => URL.createObjectURL(f)));
        }}
      />
      {previews.length ? (
        <div className="flex flex-wrap gap-3">
          {previews.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element -- local preview
            <img key={u} src={u} alt="" className="h-24 w-24 rounded-lg border border-dashed border-border object-cover" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MasterForm({ slug, id, fields, refs, suggestions, values, photos = [] }: Props) {
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

              {f.type === "photos" ? (
                <Photos name={f.name} held={photos} />
              ) : f.type === "textarea" ? (
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
