"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { Result } from "@/app/procurement/actions";

/** A headline number. `hint` carries the same figure restated in the other unit. */
export function Stat({
  label, value, decimals = 2, prefix, suffix, hint, tone = "plain",
}: {
  label: string;
  value: number | null | undefined;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
  tone?: "plain" | "accent" | "muted";
}) {
  const tones = {
    plain: "border-slate-200 bg-white",
    accent: "border-[#4A6FA5]/30 bg-[#F2F6FD]",
    muted: "border-slate-200 bg-slate-50/70",
  } as const;

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="num mt-1 text-xl font-black text-slate-800">
        {prefix}
        {formatNumber(value ?? null, decimals) || "—"}
        {suffix ? <span className="ml-1 text-xs font-semibold text-slate-500">{suffix}</span> : null}
      </div>
      {hint ? <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function Section({
  title, description, actions, children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-black tracking-tight text-[#2B4C86]">{title}</h2>
          {description ? (
            <p className="mt-0.5 max-w-3xl text-[12px] text-slate-500">{description}</p>
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
      className={`px-3 py-2 font-bold ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </th>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-[#F8FAFD] text-[10px] uppercase tracking-wider text-[#2B4C86]">
        {children}
      </tr>
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
    <td className={`num px-3 py-1.5 text-right ${dim ? "text-slate-400" : ""} ${className}`}>
      {formatNumber(value ?? null, decimals) || "—"}
    </td>
  );
}

export function Empty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-[13px] text-slate-500">
        {children}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

const inputClass =
  "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] focus:border-[#4A6FA5] focus:outline-none";

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
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      {hint ? <span className="text-[10px] text-slate-400">{hint}</span> : null}
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
  name, defaultValue, placeholder, decimals = 2,
}: {
  name: string;
  defaultValue?: number | null;
  placeholder?: string;
  decimals?: number;
}) {
  return (
    <input
      name={name}
      inputMode="decimal"
      placeholder={placeholder}
      defaultValue={
        defaultValue === null || defaultValue === undefined
          ? ""
          : String(Number(Number(defaultValue).toFixed(decimals)))
      }
      className={`num w-full ${inputClass}`}
    />
  );
}

export function Select({
  name, defaultValue, options, onChange,
}: {
  name: string;
  defaultValue?: string | null;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
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
        <p className="mt-2 w-full text-[12px] font-semibold text-red-600">{error}</p>
      ) : null}
    </form>
  );
}

export function SubmitButton({ children = "Save" }: { children?: React.ReactNode }) {
  return (
    <button className="rounded-lg bg-[#4A6FA5] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#3E5FA0]">
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
      className={`rounded p-1 ${error ? "text-red-600" : "text-slate-300 hover:text-red-600"} disabled:opacity-40`}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
