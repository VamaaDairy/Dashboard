"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTransportDay } from "@/app/transport/actions";
import { ActionForm, Empty, Num, Section, SubmitButton, THead, Th } from "@/components/tanks/ui";
import { formatNumber } from "@/lib/format";
import { COST_BASES, RUN_FIELD, transportCost } from "@/lib/transport/sections";
import type { DayEntryRow, TransportSection } from "@/lib/transport/data";

/** No rate yet for the day: take km, the most common case. */
const basisOf = (r: DayEntryRow) => r.cost_basis ?? "per_km";

/** The saved or pre-filled quantity for whatever this transporter is paid on. */
function quantity(r: DayEntryRow): number | null {
  const field = RUN_FIELD[basisOf(r)];
  return field === "trips" ? r.trips : field === "litres" ? r.diesel_litre : r.distance_km;
}

const toInput = (n: number | null) => (n === null ? "" : String(n));
const toNumber = (s: string) => {
  const v = Number(s.replace(/,/g, "").trim());
  return s.trim() === "" || !Number.isFinite(v) ? null : v;
};

const inputClass =
  "w-24 rounded-lg border border-border bg-input/30 px-2 py-1 text-right text-[13px] focus:border-primary focus:outline-none";

export function TransportDayEntry({
  section, date, rows, basePath,
}: {
  section: TransportSection;
  date: string;
  rows: DayEntryRow[];
  basePath: string;
}) {
  const router = useRouter();
  // What is typed, per transporter - drives the live cost column.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.transporter_id, toInput(quantity(r))])),
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const anySaved = rows.some((r) => r.saved);

  const cost = (r: DayEntryRow) =>
    transportCost(r.cost_basis, toNumber(values[r.transporter_id] ?? ""), r.rate);
  const total = rows.reduce((s, r) => s + (cost(r) ?? 0), 0);

  return (
    <Section
      title="Day entry"
      description="Enter each transporter's km, trips or diesel litres for the day and save. A new day starts from each transporter's last run, so only change what's different. Leave a box empty if that transporter didn't run. The day's total goes into that day's fuel cost automatically."
      actions={
        <label className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && router.push(`${basePath}?date=${e.target.value}`)}
            className="rounded-lg border border-border bg-input/30 px-2 py-1 text-[13px] text-foreground"
          />
        </label>
      }
    >
      <ActionForm
        action={saveTransportDay}
        onSuccess={() => { setSavedAt(new Date().toLocaleTimeString("en-IN")); router.refresh(); }}
      >
        <input type="hidden" name="section" value={section} />
        <input type="hidden" name="date" value={date} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <THead>
              <Th align="left">Transporter</Th>
              <Th align="left">Paid</Th>
              <Th>Km / trips / diesel</Th>
              <Th>Rate ₹ that day</Th>
              <Th>Cost ₹</Th>
            </THead>
            <tbody>
              {rows.map((r) => {
                const basis = COST_BASES[basisOf(r)];
                const field = RUN_FIELD[basisOf(r)];
                return (
                  <tr key={r.transporter_id} className="border-b border-border/70">
                    <td className="px-3 py-1.5 font-semibold text-foreground">
                      <input type="hidden" name="transporter_id" value={r.transporter_id} />
                      {r.name}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {r.cost_basis ? COST_BASES[r.cost_basis].label : (
                        <span className="text-[11px] font-semibold text-amber-700">no rate for this date</span>
                      )}
                    </td>
                    <td className="px-3 py-1 text-right">
                      <input
                        name={`${field}_${r.transporter_id}`}
                        inputMode="decimal"
                        value={values[r.transporter_id] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [r.transporter_id]: e.target.value }))}
                        className={inputClass}
                      />
                      <span className="ml-1.5 inline-block w-8 text-left text-[11px] text-muted-foreground">
                        {basis.unit}
                      </span>
                    </td>
                    <td className="num px-3 py-1.5 text-right">
                      {r.rate === null ? (
                        r.cost_basis === "diesel" ? (
                          <span className="text-[11px] font-semibold text-amber-700">no diesel price</span>
                        ) : "—"
                      ) : (
                        <>
                          {formatNumber(r.rate, 2)}
                          <span className="ml-1 text-[11px] text-muted-foreground">{basis.per}</span>
                        </>
                      )}
                    </td>
                    <Num value={cost(r)} className="font-semibold text-foreground" />
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <Empty colSpan={5}>No active transporters in this section.</Empty>
              ) : null}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="bg-accent font-semibold">
                  <td className="px-3 py-2" colSpan={4}>Total for {date}</td>
                  <Num value={total} className="font-black text-foreground" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border/70 px-4 py-3">
          <SubmitButton>{anySaved ? "Update day" : "Save day"}</SubmitButton>
          <span className="text-[12px] text-muted-foreground">
            {savedAt ? `Saved at ${savedAt}.` : anySaved ? "This day is already saved - change anything and update." : "Not saved yet."}
          </span>
        </div>
      </ActionForm>
    </Section>
  );
}
