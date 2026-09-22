"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { Result } from "@/app/tanks/actions";

export function Section({
  title, description, actions, children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-[12px] text-tertiary-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Th({
  children, align = "right", className = "",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={`h-10 px-3 font-mono text-[10px] font-medium uppercase tracking-wide text-tertiary-foreground ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </th>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border bg-secondary">{children}</tr>
    </thead>
  );
}

export function Num({
  value, decimals = 2, className = "", dim,
}: {
  value: number | null | undefined;
  decimals?: number;
  className?: string;
  dim?: boolean;
}) {
  return (
    <td className={`num px-3 py-1.5 text-right ${dim ? "text-tertiary-foreground" : ""} ${className}`}>
      {formatNumber(value ?? null, decimals) || "—"}
    </td>
  );
}

export function Empty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-[13px] text-tertiary-foreground">
        {children}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

const inputClass =
  "rounded-lg border border-border bg-input/30 px-3 py-2 text-[13px] focus:border-primary focus:outline-none";

export function Field({
  label, children, hint, width = "w-44",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  width?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${width}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Text({
  name, defaultValue, placeholder, required, type = "text",
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <input
      type={type}
      name={name}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      required={required}
      className={`w-full ${inputClass}`}
    />
  );
}

export function NumInput({
  name, defaultValue, placeholder, value, onChange, decimals = 2,
}: {
  name: string;
  defaultValue?: number | null;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  decimals?: number;
}) {
  const controlled = value !== undefined;
  return (
    <input
      name={name}
      inputMode="decimal"
      placeholder={placeholder}
      {...(controlled
        ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) }
        : {
            defaultValue:
              defaultValue === null || defaultValue === undefined
                ? ""
                : String(Number(Number(defaultValue).toFixed(decimals))),
          })}
      className={`num w-full ${inputClass}`}
    />
  );
}

export function Select({
  name, defaultValue, value, options, onChange,
}: {
  name: string;
  defaultValue?: string | null;
  value?: string;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
}) {
  const controlled = value !== undefined;
  return (
    <select
      name={name}
      {...(controlled ? { value } : { defaultValue: defaultValue ?? "" })}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full ${inputClass}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * A form that calls a server action and surfaces whatever it says went wrong.
 * `resetOnSuccess` keeps the "add another" forms ready for the next entry.
 */
export function ActionForm({
  action, children, className = "", resetOnSuccess, onSuccess,
}: {
  action: (form: FormData) => Promise<Result>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={(fd) =>
        start(async () => {
          const res = await action(fd);
          setError(res.ok ? null : res.error);
          if (!res.ok) return; // a rejected entry keeps what was typed
          if (resetOnSuccess) ref.current?.reset();
          onSuccess?.();
        })
      }
      className={`${className} ${pending ? "opacity-60" : ""}`}
    >
      {children}
      {error ? (
        <p className="mt-2 w-full text-[12px] font-semibold text-destructive">{error}</p>
      ) : null}
    </form>
  );
}

export function SubmitButton({ children = "Save" }: { children?: React.ReactNode }) {
  return (
    <button className="rounded-lg border border-border bg-white px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-accent">
      {children}
    </button>
  );
}

export function DeleteButton({
  onDelete, confirmLabel,
}: {
  onDelete: () => Promise<Result>;
  confirmLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      title={error ?? `Delete ${confirmLabel}`}
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete ${confirmLabel}?`)) return;
        start(async () => {
          const res = await onDelete();
          setError(res.ok ? null : res.error);
        });
      }}
      className={`rounded p-1 ${error ? "text-destructive" : "text-muted-foreground/50 hover:text-destructive"} disabled:opacity-40`}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
