"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveElectricityDay, saveLabourDay, setElectricityRate } from "@/app/daily/head-actions";
import { Empty, Section, THead, Th } from "@/components/tanks/ui";
import { DateBar } from "@/components/tanks/TankDayBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import type { ElectricityRate, HeadDay } from "@/lib/daily/heads";
import { CalendarHeatmap, GAIA, TrendChart } from "@/components/farmers/charts";
import { Panel, addDays, dayList } from "@/components/dash/Dash";

const FROM_START = "2000-01-01";
const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(Number(n)));
const val = (s: string) => {
  const v = Number(s.replace(/,/g, "").trim());
  return s.trim() === "" || !Number.isFinite(v) ? 0 : v;
};
const fromLabel = (d: string) => (d === FROM_START ? "from the start" : `from ${d}`);
const label = "mb-1 block text-[11px] font-medium text-muted-foreground";
const big = "h-11 w-full rounded-lg border border-border bg-white px-3 text-right text-[18px] font-semibold focus:border-foreground/40 focus:outline-none";

function useSave() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) { setError(res.error); return; }
      setError(null);
      setSavedAt(new Date().toLocaleTimeString("en-IN"));
      after?.();
      router.refresh();
    });
  return { error, savedAt, pending, run, clear: () => setSavedAt(null) };
}

function Stat({ label: l, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-4 py-3">
      <div className="text-[11px] font-medium text-muted-foreground">{l}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="num text-[20px] font-bold text-foreground">{value}</span>
        {unit ? <span className="text-[12px] text-muted-foreground">{unit}</span> : null}
      </div>
      {note ? <div className="mt-0.5 text-[11px] text-muted-foreground">{note}</div> : null}
    </div>
  );
}

function Status({ error, savedAt, dirty, saved }: { error: string | null; savedAt: string | null; dirty: boolean; saved: boolean }) {
  return (
    <span className="text-[12px] text-muted-foreground">
      {error ? <span className="font-semibold text-destructive">{error}</span>
        : savedAt && !dirty ? `Saved at ${savedAt}` : dirty ? "Unsaved changes" : saved ? "Saved" : "Nothing entered for this day yet"}
    </span>
  );
}

/** Electricity for one day: units used x the price per unit in force that day. */
export function ElectricityDay({
  date, today, entry, rates, history,
}: {
  date: string;
  today: string;
  entry: HeadDay | null;
  rates: ElectricityRate[];
  history: HeadDay[];
}) {
  const [units, setUnits] = useState(str(entry?.qty) || "0");
  const [dirty, setDirty] = useState(false);
  const s = useSave();
  const inForce = rates.find((r) => r.effective_from <= date) ?? null;
  const rate = inForce ? Number(inForce.rate) : null;
  const cost = rate === null ? null : val(units) * rate;
  const milk = entry?.milk_processed_l ? Number(entry.milk_processed_l) : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateBar date={date} today={today} basePath="/electricity" />
      </div>

      <Section title={`Electricity · ${date}`} description="Enter the units (kWh) used today. The cost is units × the price per unit in force on that day.">
        <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); s.run(() => saveElectricityDay(date, units), () => setDirty(false)); }}>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
            <label>
              <span className={label}>Units used today</span>
              <input inputMode="decimal" value={units} autoFocus onFocus={(e) => e.target.select()}
                onChange={(e) => { setUnits(e.target.value); setDirty(true); s.clear(); }} className={big} aria-label="Units used" />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Price per unit" value={rate === null ? "—" : `₹${formatNumber(rate, 2)}`} note={inForce ? fromLabel(inForce.effective_from) : "No price set"} />
              <Stat label="Cost today" value={cost === null ? "—" : `₹${formatNumber(cost, 0)}`} />
              <Stat label="Per litre of milk" value={cost !== null && milk ? `₹${formatNumber(cost / milk, 3)}` : "—"} note={milk ? `${formatNumber(milk, 0)} L processed` : "Milk processed not entered"} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Status error={s.error} savedAt={s.savedAt} dirty={dirty} saved={entry?.amount != null} />
            <Button type="submit" disabled={s.pending || !dirty} className="bg-foreground text-background hover:bg-foreground/85">
              {s.pending ? "Saving…" : "Save day"}
            </Button>
          </div>
        </form>
      </Section>

      <HeadCharts history={history} today={today} kind="electricity" />

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Section title="Day by day">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-[13px]">
              <THead>
                <Th align="left">Date</Th>
                <Th>Units</Th>
                <Th>₹ / unit</Th>
                <Th>Cost ₹</Th>
                <Th>Milk L</Th>
                <Th>₹ / L milk</Th>
              </THead>
              <tbody>
                {history.map((d) => (
                  <tr key={d.day} className={`border-b border-border/70 hover:bg-muted/60 ${d.day === date ? "bg-muted/60" : ""}`}>
                    <td className="px-3 py-1.5"><Link href={`/electricity?date=${d.day}`} className="font-semibold text-foreground hover:underline">{d.day}</Link></td>
                    <td className="num px-3 py-1.5 text-right">{d.qty == null ? "—" : formatNumber(Number(d.qty), 0)}</td>
                    <td className="num px-3 py-1.5 text-right">{d.rate == null ? "—" : formatNumber(Number(d.rate), 2)}</td>
                    <td className="num px-3 py-1.5 text-right font-semibold text-foreground">{formatNumber(Number(d.amount), 0)}</td>
                    <td className="num px-3 py-1.5 text-right text-muted-foreground">{d.milk_processed_l ? formatNumber(Number(d.milk_processed_l), 0) : "—"}</td>
                    <td className="num px-3 py-1.5 text-right text-muted-foreground">{d.milk_processed_l ? formatNumber(Number(d.amount) / Number(d.milk_processed_l), 3) : "—"}</td>
                  </tr>
                ))}
                {history.length === 0 ? <Empty colSpan={6}>No electricity entered yet.</Empty> : null}
              </tbody>
            </table>
          </div>
        </Section>

        <RateCard rates={rates} today={today} />
      </div>
    </>
  );
}

/** The electricity price history, and a form to set a new price from a date. */
function RateCard({ rates, today }: { rates: ElectricityRate[]; today: string }) {
  const [from, setFrom] = useState(today);
  const [rate, setRate] = useState("");
  const s = useSave();
  return (
    <Section title="Price per unit" description="A new price applies from its date on. Earlier days keep the price they had.">
      <form className="flex flex-wrap items-end gap-3 border-b border-border p-4"
        onSubmit={(e) => { e.preventDefault(); s.run(() => setElectricityRate(from, rate), () => setRate("")); }}>
        <label>
          <span className={label}>New price ₹ / unit</span>
          <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 14" className="h-9 w-28 text-right" />
        </label>
        <label>
          <span className={label}>From</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        </label>
        <Button type="submit" disabled={s.pending || !rate.trim()} variant="outline" className="h-9">{s.pending ? "Saving…" : "Change price"}</Button>
        {s.error ? <p className="w-full text-[12px] font-semibold text-destructive">{s.error}</p> : null}
      </form>
      <table className="w-full text-[13px]">
        <tbody>
          {rates.map((r, i) => (
            <tr key={r.id} className="border-b border-border/70">
              <td className="px-4 py-1.5 text-muted-foreground">{r.effective_from === FROM_START ? "From the start" : `From ${r.effective_from}`}</td>
              <td className="num px-4 py-1.5 text-right font-semibold text-foreground">₹{formatNumber(Number(r.rate), 2)}</td>
              <td className="px-4 py-1.5 text-right text-[11px] text-muted-foreground">{i === 0 ? "current" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

/** Labour for one day: how many labourers worked and the total paid. */
export function LabourDay({
  date, today, entry, history,
}: {
  date: string;
  today: string;
  entry: HeadDay | null;
  history: HeadDay[];
}) {
  const [workers, setWorkers] = useState(str(entry?.qty) || "0");
  const [total, setTotal] = useState(str(entry?.amount) || "0");
  const [dirty, setDirty] = useState(false);
  const s = useSave();
  const w = val(workers);
  const t = val(total);
  const milk = entry?.milk_processed_l ? Number(entry.milk_processed_l) : null;
  const change = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { f(e.target.value); setDirty(true); s.clear(); };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateBar date={date} today={today} basePath="/labour" />
      </div>

      <Section title={`Labour · ${date}`} description="Enter how many labourers worked today and the total amount paid to them.">
        <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); s.run(() => saveLabourDay(date, workers, total), () => setDirty(false)); }}>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,14rem)_1fr]">
            <label>
              <span className={label}>Labourers today</span>
              <input inputMode="numeric" value={workers} autoFocus onFocus={(e) => e.target.select()} onChange={change(setWorkers)} className={big} aria-label="Labourers" />
            </label>
            <label>
              <span className={label}>Total amount ₹</span>
              <input inputMode="decimal" value={total} onFocus={(e) => e.target.select()} onChange={change(setTotal)} className={big} aria-label="Total amount" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Per labourer" value={w > 0 && t > 0 ? `₹${formatNumber(t / w, 0)}` : "—"} />
              <Stat label="Per litre of milk" value={t > 0 && milk ? `₹${formatNumber(t / milk, 3)}` : "—"} note={milk ? `${formatNumber(milk, 0)} L processed` : "Milk processed not entered"} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Status error={s.error} savedAt={s.savedAt} dirty={dirty} saved={entry?.amount != null} />
            <Button type="submit" disabled={s.pending || !dirty} className="bg-foreground text-background hover:bg-foreground/85">
              {s.pending ? "Saving…" : "Save day"}
            </Button>
          </div>
        </form>
      </Section>

      <HeadCharts history={history} today={today} kind="labour" />

      <div className="max-w-3xl">
        <Section title="Day by day">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-[13px]">
              <THead>
                <Th align="left">Date</Th>
                <Th>Labourers</Th>
                <Th>Total ₹</Th>
                <Th>₹ / labourer</Th>
                <Th>Milk L</Th>
                <Th>₹ / L milk</Th>
              </THead>
              <tbody>
                {history.map((d) => (
                  <tr key={d.day} className={`border-b border-border/70 hover:bg-muted/60 ${d.day === date ? "bg-muted/60" : ""}`}>
                    <td className="px-3 py-1.5"><Link href={`/labour?date=${d.day}`} className="font-semibold text-foreground hover:underline">{d.day}</Link></td>
                    <td className="num px-3 py-1.5 text-right">{d.qty == null ? "—" : formatNumber(Number(d.qty), 0)}</td>
                    <td className="num px-3 py-1.5 text-right font-semibold text-foreground">{formatNumber(Number(d.amount), 0)}</td>
                    <td className="num px-3 py-1.5 text-right">{d.qty ? formatNumber(Number(d.amount) / Number(d.qty), 0) : "—"}</td>
                    <td className="num px-3 py-1.5 text-right text-muted-foreground">{d.milk_processed_l ? formatNumber(Number(d.milk_processed_l), 0) : "—"}</td>
                    <td className="num px-3 py-1.5 text-right text-muted-foreground">{d.milk_processed_l ? formatNumber(Number(d.amount) / Number(d.milk_processed_l), 3) : "—"}</td>
                  </tr>
                ))}
                {history.length === 0 ? <Empty colSpan={6}>No labour entered yet.</Empty> : null}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}

/** Last 30 days of a head as a calendar and a per-litre trend. */
function HeadCharts({ history, today, kind }: { history: HeadDay[]; today: string; kind: "electricity" | "labour" }) {
  const from = addDays(today, -29);
  const dates = dayList(from, today);
  const by = new Map(history.map((d) => [d.day, d]));
  const isE = kind === "electricity";
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title={isE ? "Units used, last 30 days" : "Labourers, last 30 days"} description="Darker = more. Hover a day for its cost.">
        <CalendarHeatmap from={from} to={today} unit={isE ? "units" : "labourers"} emptyLabel="not entered"
          days={history.filter((d) => d.day >= from && d.qty).map((d) => ({
            day: d.day, value: Number(d.qty),
            tip: [
              { label: isE ? "units" : "labourers", value: formatNumber(Number(d.qty), 0) },
              { label: "cost", value: `₹${formatNumber(Number(d.amount), 0)}` },
            ],
          }))} />
      </Panel>
      <Panel title="Cost per litre of milk processed" description="The day's cost ÷ litres of milk that went into bulk batches.">
        <TrendChart color={GAIA.blue} unit="₹ / L" decimals={2} emptyLabel="not entered"
          points={dates.map((d) => {
            const x = by.get(d);
            return { day: d, value: x && x.milk_processed_l ? Number(x.amount) / Number(x.milk_processed_l) : null };
          })}
          extraTip={(d) => [{ label: "cost", value: by.get(d) ? `₹${formatNumber(Number(by.get(d)!.amount), 0)}` : "—" }]} />
      </Panel>
    </div>
  );
}
