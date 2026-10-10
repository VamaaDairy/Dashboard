"use client";

import { useState } from "react";
import Link from "next/link";
import { saveMeterReading } from "@/app/daily/head-actions";
import { Empty, Section, THead, Th } from "@/components/tanks/ui";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { METER_DIVISOR, METER_MULTIPLIER, meterRows, type MeterReading } from "@/lib/daily/meter";
import type { HeadDay } from "@/lib/daily/heads";
import { Status, big, label, str, useSave } from "@/components/daily/HeadDayEntry";

const n = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : formatNumber(Number(v), d));

const FIELDS = [["kwh", "kWh"], ["kvarh", "kVArh"], ["kva", "kVA"], ["kvah", "kVAh"], ["pf", "PF"]] as const;

/** The morning meter readings and the whole working from them to each day's units and cost. */
export function MeterSection({ date, readings, history }: { date: string; readings: MeterReading[]; history: HeadDay[] }) {
  const rows = meterRows(readings);
  const byDay = new Map(history.map((h) => [h.day, h]));
  const mine = readings.find((r) => r.day === date);
  const row = rows.find((r) => r.day === date);
  const day = byDay.get(date);
  const [f, setF] = useState({ kwh: str(mine?.kwh), kvarh: str(mine?.kvarh), kva: str(mine?.kva), kvah: str(mine?.kvah), pf: str(mine?.pf) });
  const [dirty, setDirty] = useState(false);
  const s = useSave();

  return (
    <Section
      title={`Meter readings · ${date}`}
      description={`Take the reading each morning (about 6:45). A day's units = (next morning's kWh − this morning's) ÷ ${METER_DIVISOR} × ${METER_MULTIPLIER}, so a day is worked out once the next day's reading is in.`}
    >
      <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); s.run(() => saveMeterReading(date, f), () => setDirty(false)); }}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {FIELDS.map(([k, l]) => (
            <label key={k}>
              <span className={label}>{l}</span>
              <input inputMode="decimal" value={f[k]} aria-label={l} className={big} onFocus={(e) => e.target.select()}
                onChange={(e) => { setF({ ...f, [k]: e.target.value }); setDirty(true); s.clear(); }} />
            </label>
          ))}
        </div>

        {row && row.units !== null ? (
          <p className="num rounded-lg bg-muted/60 px-4 py-3 text-[13px] text-foreground">
            ({n(row.nextKwh)} − {n(row.kwh)}) = {n(row.kwhDiff)} ÷ {METER_DIVISOR} = {n(row.kwhScaled, 2)} × {METER_MULTIPLIER} = <b>{n(row.units)} kWh (units)</b>
            {day?.rate != null ? <> × ₹{n(day.rate, 2)} = <b>₹{n(day.amount)}</b></> : null}
          </p>
        ) : (
          <p className="rounded-lg bg-muted/60 px-4 py-3 text-[13px] text-muted-foreground">
            This day&apos;s units are worked out when the next day&apos;s reading is entered
            {day?.qty != null ? `; until then it keeps the ${n(day.qty)} units entered by hand` : ""}.
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Status error={s.error} savedAt={s.savedAt} dirty={dirty} saved={!!mine} />
          <Button type="submit" disabled={s.pending || !dirty} className="bg-foreground text-background hover:bg-foreground/85">
            {s.pending ? "Saving…" : "Save reading"}
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto border-t border-border">
        <table className="w-full whitespace-nowrap text-[13px]">
          <THead>
            <Th align="left">Date</Th>
            <Th>kWh reading</Th>
            <Th>kVArh</Th>
            <Th>kVA</Th>
            <Th>kVAh reading</Th>
            <Th>PF</Th>
            <Th>Δ reading</Th>
            <Th>÷ {METER_DIVISOR}</Th>
            <Th>× {METER_MULTIPLIER} = kWh (units)</Th>
            <Th>Δ reading</Th>
            <Th>÷ {METER_DIVISOR}</Th>
            <Th>× {METER_MULTIPLIER} = kVAh</Th>
            <Th>₹ / unit</Th>
            <Th>Cost ₹</Th>
          </THead>
          <tbody>
            {rows.map((r) => {
              const h = byDay.get(r.day);
              return (
                <tr key={r.day} className={`border-b border-border/70 hover:bg-muted/60 ${r.day === date ? "bg-muted/60" : ""}`}>
                  <td className="px-3 py-1.5"><Link href={`/electricity?date=${r.day}`} className="font-semibold text-foreground hover:underline">{r.day}</Link></td>
                  <td className="num px-3 py-1.5 text-right">{n(r.kwh)}</td>
                  <td className="num px-3 py-1.5 text-right">{n(r.kvarh)}</td>
                  <td className="num px-3 py-1.5 text-right">{n(r.kva, 2)}</td>
                  <td className="num px-3 py-1.5 text-right">{n(r.kvah)}</td>
                  <td className="num px-3 py-1.5 text-right">{n(r.pf, 3)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{n(r.kwhDiff)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{n(r.kwhScaled, 1)}</td>
                  <td className="num px-3 py-1.5 text-right font-semibold text-foreground">{n(r.units ?? h?.qty)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{n(r.kvahDiff)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{n(r.kvahScaled, 1)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{n(r.kvahUnits)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{n(h?.rate, 2)}</td>
                  <td className="num px-3 py-1.5 text-right font-semibold text-foreground">{n(h?.amount)}</td>
                </tr>
              );
            })}
            {rows.length === 0 ? <Empty colSpan={14}>No meter readings entered yet.</Empty> : null}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
