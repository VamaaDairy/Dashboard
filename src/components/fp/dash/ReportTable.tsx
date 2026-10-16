"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Search } from "lucide-react";

export type RCell = string | number | null;
/** A computed report: filter box, click-to-sort headers, paging and a CSV download, all in the browser. */
export function ReportTable({ head, rows, right = [], name = "report", pageSize = 25, tone }: {
  head: string[]; rows: RCell[][]; right?: number[]; name?: string; pageSize?: number;
  /** colour for a cell: "good" | "warn" | "bad" */
  tone?: Record<string, "good" | "warn" | "bad">;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = needle ? rows.filter((row) => row.some((c) => String(c ?? "").toLowerCase().includes(needle))) : rows;
    if (sort) {
      r = [...r].sort((a, b) => {
        const x = a[sort.col], y = b[sort.col];
        if (x === y) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        const nx = Number(String(x).replace(/[₹,%\s,]/g, "")), ny = Number(String(y).replace(/[₹,%\s,]/g, ""));
        const cmp = Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : String(x).localeCompare(String(y));
        return cmp * sort.dir;
      });
    }
    return r;
  }, [rows, q, sort]);
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const cur = Math.min(page, pages);
  const slice = shown.slice((cur - 1) * pageSize, cur * pageSize);

  function download() {
    const cell = (v: RCell) => {
      const s = v === null ? "" : String(v);
      const safe = /^[=+@]/.test(s) ? `'${s}` : s;
      return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const csv = "﻿" + [head, ...shown].map((r) => r.map((c) => cell(c as RCell)).join(",")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Filter rows" className="h-8 w-56 rounded-lg border border-border bg-background pl-8 pr-2 text-[13px] outline-none focus:border-primary" />
        </div>
        <button onClick={download} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[12px] font-medium hover:bg-muted"><Download className="h-3.5 w-3.5" /> Export CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="w-10 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">#</th>
              {head.map((h, i) => (
                <th key={h + i} className={`whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${right.includes(i) ? "text-right" : "text-left"}`}>
                  <button onClick={() => setSort((s) => (s?.col === i ? { col: i, dir: s.dir === 1 ? -1 : 1 } : { col: i, dir: 1 }))} className="inline-flex items-center gap-1 hover:text-foreground">
                    {h}{sort?.col === i ? (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i} className="border-b border-border/70 hover:bg-muted/50">
                <td className="px-3 py-2 text-muted-foreground tabular-nums">{(cur - 1) * pageSize + i + 1}</td>
                {r.map((c, j) => {
                  const t = tone?.[`${j}:${c}`];
                  return <td key={j} className={`whitespace-nowrap px-3 py-2 ${right.includes(j) ? "text-right tabular-nums" : ""} ${t === "good" ? "font-medium text-emerald-700" : t === "bad" ? "font-medium text-destructive" : t === "warn" ? "font-medium text-amber-700" : c === null ? "text-muted-foreground" : "text-foreground"}`}>{c ?? "—"}</td>;
                })}
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={head.length + 1} className="px-4 py-12 text-center text-muted-foreground">No rows.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
        <span>{shown.length === 0 ? "No rows" : `${(cur - 1) * pageSize + 1}–${Math.min(shown.length, cur * pageSize)} of ${shown.length}`}</span>
        <div className="flex items-center gap-1.5">
          <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="rounded-lg border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-40">Previous</button>
          <span className="px-1">Page {cur} of {pages}</span>
          <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="rounded-lg border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
