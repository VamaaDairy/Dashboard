"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { resetCell, setCell } from "@/app/actions";
import { formatNumber } from "@/lib/format";

export interface CellData {
  formula: string | null;
  overridden: boolean;
  input_num: number | null;
  input_text: string | null;
  computed_num: number | null;
  computed_text: string | null;
  error: string | null;
}

/** What the user edits: "=formula" for computed cells, the plain literal otherwise. */
function sourceOf(cell: CellData | undefined, decimals: number): string {
  if (!cell) return "";
  if (cell.formula) return `=${cell.formula}`;
  if (cell.input_text !== null && cell.input_text !== undefined) return cell.input_text;
  if (cell.input_num === null || cell.input_num === undefined) return "";
  return String(Number(cell.input_num.toFixed(Math.max(decimals, 6))));
}

interface Props {
  objectId: string;
  fieldId: string;
  cell: CellData | undefined;
  decimals: number;
  dataType?: string;
  suffix?: string | null;
  isTotal?: boolean;
  rollupGroup?: string | null;
  align?: "left" | "right";
}

export function EditableCell({
  objectId, fieldId, cell, decimals, dataType = "number", suffix, isTotal, rollupGroup,
  align = "right",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const source = sourceOf(cell, decimals);
  const isFormula = Boolean(cell?.formula);

  const commit = (raw: string) => {
    setEditing(false);
    if (raw === source) return;
    start(async () => {
      const res = raw.trim() === "" && isFormula
        ? await resetCell(objectId, fieldId)
        : await setCell(objectId, fieldId, raw);
      setError(res.ok ? null : res.error);
    });
  };

  if (editing) {
    return (
      <td className="p-0">
        <input
          ref={ref}
          defaultValue={source}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit((e.target as HTMLInputElement).value); }
            if (e.key === "Escape") { e.preventDefault(); setEditing(false); setDraft(""); }
          }}
          className={`w-full min-w-[7rem] bg-blue-50 px-2 py-1 outline-2 -outline-offset-2 outline-[#4A6FA5] ${
            draft.startsWith("=") || (draft === "" && isFormula) ? "font-mono text-[#2F7D6A]" : "num"
          }`}
        />
      </td>
    );
  }

  const display =
    cell?.error
      ? "#ERR"
      : dataType === "text"
        ? cell?.computed_text ?? cell?.input_text ?? ""
        : formatNumber(cell?.computed_num ?? null, decimals);

  return (
    <td
      onClick={() => { setEditing(true); setDraft(source); }}
      title={
        cell?.error ??
        (cell?.formula ? `= ${cell.formula}` : undefined) ??
        (rollupGroup ? `Sum of every column tagged "${rollupGroup}"` : undefined) ??
        undefined
      }
      className={`cursor-cell px-2 py-1 ${align === "right" ? "text-right" : "text-left"} ${
        isTotal ? "bg-[#F2F6FD] font-semibold" : ""
      } ${cell?.error || error ? "bg-red-50 text-red-600" : ""} ${
        pending ? "opacity-50" : ""
      } hover:bg-blue-50`}
    >
      <span className={dataType === "text" ? "" : "num"}>
        {display}
        {suffix === "%" && display !== "" ? "" : null}
      </span>
      {!isFormula && rollupGroup ? (
        <span className="ml-1 inline-block align-top text-[9px] leading-none text-slate-500" title={`Sum of every column tagged "${rollupGroup}"`}>
          Σ
        </span>
      ) : null}
      {isFormula ? (
        <span
          className={`ml-1 inline-block align-top text-[9px] leading-none ${
            cell?.overridden ? "text-[#2B4C86]" : "text-[#2F7D6A]/70"
          }`}
          title={cell?.overridden ? "Formula overridden on this row" : "Formula from the column default"}
        >
          {cell?.overridden ? "◆" : "ƒ"}
        </span>
      ) : null}
      {error ? <div className="text-[10px] text-red-600">{error}</div> : null}
    </td>
  );
}
