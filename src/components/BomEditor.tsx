"use client";

import { useState, useTransition } from "react";
import { addBomLine, deleteBomLine, updateBomLine } from "@/app/actions";
import { formatNumber } from "@/lib/format";

interface Line {
  id: string;
  line_type: string;
  label: string | null;
  component_code: string | null;
  component_name: string | null;
  qty: number | null;
  qty_formula: string | null;
  rate: number | null;
  rate_formula: string | null;
  divisor: number;
  divisor_formula: string | null;
  computed_amount: number | null;
  error: string | null;
  include_in_total: boolean;
  notes: string | null;
}

const LINE_TYPES = ["input", "packaging", "additive", "labour", "overhead", "transport", "credit", "other"];

const src = (literal: number | null, formula: string | null) =>
  formula ? `=${formula}` : literal === null ? "" : String(literal);

export function BomEditor({
  parentId, lines, components,
}: {
  parentId: string;
  lines: Line[];
  components: Array<{ id: string; code: string; name: string; class_name: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      setError(res.ok ? null : res.error);
    });

  const total = lines
    .filter((l) => l.include_in_total)
    .reduce((s, l) => s + (l.computed_amount ?? 0), 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="font-semibold">Bill of material</h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] hover:border-[#4A6FA5] hover:text-[#2B4C86]"
        >
          + Line
        </button>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 bg-[#F8FAFD] text-[10px] uppercase tracking-wider text-[#2B4C86]">
            <th className="px-3 py-1.5 text-left font-semibold">Type</th>
            <th className="px-2 py-1.5 text-left font-semibold">Component / label</th>
            <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
            <th className="px-2 py-1.5 text-right font-semibold">Rate</th>
            <th className="px-2 py-1.5 text-right font-semibold">Per</th>
            <th className="px-2 py-1.5 text-right font-semibold">Amount</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="group border-b border-slate-100">
              <td className="px-3 py-1">
                <select
                  defaultValue={l.line_type}
                  onChange={(e) => run(() => updateBomLine(l.id, "line_type", e.target.value))}
                  className="rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] hover:border-slate-200"
                >
                  {LINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td className="px-2 py-1">
                {l.component_code ? (
                  <span>
                    {l.component_name}
                    <span className="ml-1.5 font-mono text-[10px] text-slate-500">{l.component_code}</span>
                  </span>
                ) : (
                  <LineInput
                    defaultValue={l.label ?? ""}
                    onCommit={(v) => run(() => updateBomLine(l.id, "label", v))}
                    className="w-full"
                  />
                )}
                {l.component_code && l.label ? (
                  <span className="ml-2 text-[11px] text-slate-500">{l.label}</span>
                ) : null}
              </td>
              <td className="px-2 py-1 text-right">
                <LineInput
                  defaultValue={src(l.qty, l.qty_formula)}
                  onCommit={(v) => run(() => updateBomLine(l.id, "qty", v))}
                />
              </td>
              <td className="px-2 py-1 text-right">
                <LineInput
                  defaultValue={src(l.rate, l.rate_formula)}
                  placeholder={l.component_code ? "component cost" : "0"}
                  onCommit={(v) => run(() => updateBomLine(l.id, "rate", v))}
                />
              </td>
              <td className="px-2 py-1 text-right">
                <LineInput
                  defaultValue={src(l.divisor, l.divisor_formula)}
                  onCommit={(v) => run(() => updateBomLine(l.id, "divisor", v))}
                />
              </td>
              <td className={`num px-2 py-1 text-right font-semibold ${l.error ? "text-red-600" : ""}`}>
                {l.error ? "#ERR" : formatNumber(l.computed_amount, 4)}
              </td>
              <td className="px-2 py-1">
                <button
                  onClick={() => run(() => deleteBomLine(l.id))}
                  className="invisible text-[11px] text-slate-500 group-hover:visible hover:text-red-600"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} className="px-3 py-1.5 text-right text-[11px] uppercase tracking-wider text-slate-500">
              Total
            </td>
            <td className="num bg-[#F2F6FD] px-2 py-1.5 text-right font-semibold">
              {formatNumber(total, 4)}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
      </div>

      {adding ? (
        <form
          action={(fd) => start(async () => {
            const res = await addBomLine(fd);
            setError(res.ok ? null : res.error);
            if (res.ok) setAdding(false);
          })}
          className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-blue-50 px-3 py-2"
        >
          <input type="hidden" name="parent_object_id" value={parentId} />
          <select name="line_type" className="rounded border border-slate-200 bg-white px-2 py-1">
            {LINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select name="component_object_id" className="w-64 rounded border border-slate-200 bg-white px-2 py-1">
            <option value="">— no component (free line) —</option>
            {components.map((c) => (
              <option key={c.id} value={c.id}>{c.class_name}: {c.name}</option>
            ))}
          </select>
          <input
            name="label" placeholder="Label (optional)"
            className="w-48 rounded border border-slate-200 bg-white px-2 py-1"
          />
          <input
            name="qty" defaultValue="1" placeholder="Qty or =formula"
            className="w-40 rounded border border-slate-200 bg-white px-2 py-1"
          />
          <button className="rounded-lg bg-[#4A6FA5] px-3 py-1.5 text-white font-medium hover:bg-[#3E5FA0]">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="text-slate-500">Cancel</button>
        </form>
      ) : null}

      {error ? <div className="bg-red-50 px-3 py-1.5 text-red-600">{error}</div> : null}
    </section>
  );
}

function LineInput({
  defaultValue, onCommit, placeholder, className = "w-20 text-right",
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
      className={`num rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-200 focus:border-[#4A6FA5] focus:outline-none ${className} ${
        defaultValue.startsWith("=") ? "text-[#2F7D6A]" : ""
      }`}
    />
  );
}
