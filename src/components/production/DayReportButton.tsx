"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DayReport } from "@/components/production/DayReport";
import type { DayReportData } from "@/lib/production/day-report-model";

/**
 * Day report (PDF) on Production > Daily batches: loads the day's production report and opens the print dialog with
 * only the report on A4, to print or "Save as PDF". The file is named Gaia-Daily-Production-<date>.
 */
export function DayReportButton({ date }: { date: string }) {
  const [data, setData] = useState<DayReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!data) return;
    // while the report is on the page: only it prints, and the page title names the PDF
    const title = document.title;
    document.body.classList.add("dpr-printing");
    document.title = `Gaia-Daily-Production-${data.date}`;
    const done = () => {
      setData(null);
      setBusy(false);
    };
    window.addEventListener("afterprint", done, { once: true });
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => window.print()); });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("dpr-printing");
      document.title = title;
    };
  }, [data]);

  async function open() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/production/day-report?date=${date}`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 403 ? "You can't view Production." : "Couldn't load the day report.");
      setData((await res.json()) as DayReportData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the day report.");
      setBusy(false);
    }
  }

  return (
    <>
      {error ? <span className="text-xs font-semibold text-destructive">{error}</span> : null}
      <Button variant="outline" onClick={open} disabled={busy} title={`The production report for ${date}, to print or save as PDF`}>
        <FileDown /> {busy ? "Preparing…" : "Day report (PDF)"}
      </Button>
      {data ? createPortal(<div id="day-report-print"><DayReport data={data} /></div>, document.body) : null}
    </>
  );
}
