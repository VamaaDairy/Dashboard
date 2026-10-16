"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Upload } from "lucide-react";
import { uploadCsvAction } from "@/app/orders/actions";
import { Button } from "@/components/ui/button";
import type { ImportResult } from "@/lib/orders/upload";

export function UploadPanel({ options }: { options: Array<{ key: string; label: string; hint?: string }> }) {
  const [entity, setEntity] = useState(options[0].key);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const current = options.find((o) => o.key === entity)!;

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setResult(null); setError(null);
    if (!f) return;
    if (f.size > 2_000_000) { setError("File is too large (2 MB max)."); return; }
    setFileName(f.name);
    const r = new FileReader();
    r.onload = () => setText(String(r.result ?? ""));
    r.readAsText(f);
  }

  function submit() {
    setError(null); setResult(null);
    start(async () => {
      const res = await uploadCsvAction(entity, text);
      if (res.ok) {
        setResult(res.data);
        setText(""); setFileName("");
        if (input.current) input.current.value = "";
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Upload
          <select value={entity} onChange={(e) => { setEntity(e.target.value); setResult(null); setError(null); }}
            className="h-8 min-w-56 rounded-lg border border-border bg-background px-2 text-[13px]">
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        <a href={`/api/orders/template?entity=${entity}`} download
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[12px] font-medium hover:bg-muted">
          <Download className="h-3.5 w-3.5" /> Template (CSV)
        </a>
      </div>
      {current.hint && <p className="text-[12px] text-muted-foreground">{current.hint}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".csv,text/csv" onChange={pick} className="text-[13px]" />
        <Button variant="primary" size="sm" disabled={!text || pending} onClick={submit}><Upload /> {pending ? "Importing…" : "Import"}</Button>
        {fileName && <span className="text-[12px] text-muted-foreground">{fileName}</span>}
      </div>
      <p className="text-[12px] text-muted-foreground">Rows that fail are skipped and listed below; the rest are saved. Save an Excel sheet as CSV first.</p>
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      {result && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-[13px]">
          <p className="font-medium text-foreground">{result.created} saved{result.errors.length ? `, ${result.errors.length} skipped` : ""}.</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto text-[12px] text-destructive">
              {result.errors.slice(0, 200).map((er) => <li key={er.line}>Line {er.line}: {er.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
