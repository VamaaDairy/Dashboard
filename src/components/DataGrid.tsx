"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { addObject, deleteObject } from "@/app/actions";
import { EditableCell, type CellData } from "./EditableCell";

interface Field {
  id: string;
  key: string;
  label: string;
  data_type: string;
  group_label: string | null;
  decimals: number;
  suffix: string | null;
  is_total: boolean;
  rollup_group: string | null;
  default_formula: string | null;
  description: string | null;
}

interface Row {
  id: string;
  code: string;
  name: string;
  notes: string | null;
  is_active: boolean;
  cells: Record<string, CellData>;
}

export function DataGrid({
  classId, classCode, fields, rows,
}: {
  classId: string;
  classCode: string;
  fields: Field[];
  rows: Row[];
}) {
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(q));
  }, [rows, filter]);

  const groups = useMemo(() => {
    const out: Array<{ label: string; span: number }> = [];
    for (const f of fields) {
      const label = f.group_label ?? "";
      const last = out[out.length - 1];
      if (last && last.label === label) last.span++;
      else out.push({ label, span: 1 });
    }
    return out;
  }, [fields]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter rows"
          className="w-56 rounded border border-slate-200 bg-slate-50 px-2 py-1 outline-none focus:border-[#4A6FA5]"
        />
        <span className="text-[11px] text-slate-500">
          {visible.length} of {rows.length} rows · {fields.length} columns
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:border-[#4A6FA5] hover:text-[#2B4C86]"
        >
          + Row
        </button>
        <Link
          href={`/schema#${classCode}`}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:border-[#4A6FA5] hover:text-[#2B4C86]"
        >
          + Column
        </Link>
      </div>

      {adding ? (
        <form
          action={(fd) => start(async () => {
            const res = await addObject(fd);
            setError(res.ok ? null : res.error);
            if (res.ok) setAdding(false);
          })}
          className="flex items-center gap-2 border-b border-slate-200 bg-blue-50 px-4 py-2"
        >
          <input type="hidden" name="class_id" value={classId} />
          <input
            name="code" required placeholder="code_like_this" autoFocus
            className="w-48 rounded border border-slate-200 bg-white px-2 py-1 font-mono"
          />
          <input
            name="name" required placeholder="Display name"
            className="w-72 rounded border border-slate-200 bg-white px-2 py-1"
          />
          <button
            disabled={pending}
            className="rounded-lg bg-[#4A6FA5] px-3 py-1.5 text-white font-medium hover:bg-[#3E5FA0] disabled:opacity-50"
          >
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-slate-500">
            Cancel
          </button>
          {error ? <span className="text-red-600">{error}</span> : null}
        </form>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="sheet">
          <thead>
            <tr>
              <th className="sticky-col" />
              {groups.map((g, i) => (
                <th
                  key={i}
                  colSpan={g.span}
                  className="bg-white px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  {g.label}
                </th>
              ))}
              <th />
            </tr>
            <tr>
              <th className="sticky-col px-2 py-1.5 text-left font-semibold">Name</th>
              {fields.map((f) => (
                <th
                  key={f.id}
                  title={f.description ?? (f.default_formula ? `= ${f.default_formula}` : undefined) ?? undefined}
                  className={`px-2 py-1.5 text-right font-semibold ${f.is_total ? "bg-[#F2F6FD]" : ""}`}
                >
                  {f.label}
                  {f.suffix ? <span className="ml-1 text-slate-500">{f.suffix}</span> : null}
                </th>
              ))}
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="group hover:bg-blue-50/40">
                <td className="sticky-col px-2 py-1">
                  <Link
                    href={`/c/${classCode}/${row.code}`}
                    className="hover:text-[#2B4C86] hover:underline"
                  >
                    {row.name}
                  </Link>
                  <div className="font-mono text-[10px] text-slate-500">{row.code}</div>
                </td>
                {fields.map((f) => (
                  <EditableCell
                    key={f.id}
                    objectId={row.id}
                    fieldId={f.id}
                    cell={row.cells[f.key]}
                    decimals={f.decimals}
                    dataType={f.data_type}
                    suffix={f.suffix}
                    isTotal={f.is_total}
                    rollupGroup={f.rollup_group}
                    align={f.data_type === "text" ? "left" : "right"}
                  />
                ))}
                <td className="px-2 py-1">
                  <button
                    onClick={() => start(async () => {
                      const res = await deleteObject(row.id);
                      setError(res.ok ? null : res.error);
                    })}
                    className="invisible text-[11px] text-slate-500 group-hover:visible hover:text-red-600"
                    title="Delete row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? (
        <div className="border-t border-slate-200 bg-red-50 px-4 py-2 text-red-600">{error}</div>
      ) : null}
      <div className="border-t border-slate-200 bg-white px-4 py-1.5 text-[11px] text-slate-500">
        Click any cell to edit. Start with <span className="font-mono text-[#2F7D6A]">=</span> for a
        formula — e.g. <span className="font-mono">=qty_per_pc * O.toned_milk.total_cost_per_l</span>.
        Clear a cell to fall back to the column default.
      </div>
    </div>
  );
}
