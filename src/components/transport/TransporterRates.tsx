"use client";

import { Fragment, useState } from "react";
import { addTransporterRate, saveUsualRoute } from "@/app/transport/actions";
import { ActionForm, Empty, Field, Section, Select, SubmitButton, Text, THead, Th } from "@/components/tanks/ui";
import { formatNumber } from "@/lib/format";
import { COST_BASES, type CostBasis } from "@/lib/transport/sections";
import type { RateRow, TransportSection, TransporterRow } from "@/lib/transport/data";

const COLS = 6;

/** A per-km or per-trip rate as written; diesel reads as the diesel price, since it has no rate of its own. */
function rateText(r: { cost_basis: CostBasis; rate: number | null }, dieselPrice?: number) {
  if (r.cost_basis === "diesel") {
    return dieselPrice === undefined ? "at diesel price" : `${formatNumber(dieselPrice, 2)} / L diesel`;
  }
  return `${formatNumber(r.rate ?? 0, 2)} ${COST_BASES[r.cost_basis].per}`;
}

const linkButton = "text-[12px] font-semibold text-muted-foreground hover:text-foreground";

function NewRateForm({
  section, t, current, today, onDone,
}: {
  section: TransportSection;
  t: TransporterRow;
  current: RateRow | undefined;
  today: string;
  onDone: () => void;
}) {
  const [basis, setBasis] = useState<CostBasis>(current?.cost_basis ?? "per_km");
  return (
    <ActionForm
      action={addTransporterRate}
      onSuccess={onDone}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 px-4 py-4"
    >
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="transporter_id" value={t.id} />
      <p className="w-44 pb-2 text-[13px] font-semibold text-foreground">New rate · {t.name}</p>
      <Field label="Applies from" width="w-40">
        <Text name="effective_from" type="date" defaultValue={today} required />
      </Field>
      <Field label="Paid" width="w-36">
        <Select
          name="cost_basis"
          value={basis}
          onChange={(v) => setBasis(v as CostBasis)}
          options={Object.entries(COST_BASES).map(([value, b]) => ({ value, label: b.label }))}
        />
      </Field>
      {basis === "diesel" ? (
        <p className="w-40 pb-2 text-[12px] text-muted-foreground">Charged at the diesel price - no rate needed.</p>
      ) : (
        <Field label={`Rate ${COST_BASES[basis].rateLabel}`} width="w-32">
          <Text name="rate" placeholder={basis === "per_km" ? "10.40" : "5678"} required />
        </Field>
      )}
      <Field label="Notes" width="w-48" hint="optional">
        <Text name="notes" />
      </Field>
      <SubmitButton>Add rate</SubmitButton>
      <button type="button" onClick={onDone} className={`pb-2 ${linkButton}`}>Cancel</button>
      <p className="w-full text-[11px] text-muted-foreground">
        Days before this date keep their old rate. Days already entered from this date on are re-costed.
      </p>
    </ActionForm>
  );
}

function UsualRouteForm({ t, onDone }: { t: TransporterRow; onDone: () => void }) {
  return (
    <ActionForm
      action={saveUsualRoute}
      onSuccess={onDone}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 px-4 py-4"
    >
      <input type="hidden" name="transporter_id" value={t.id} />
      <p className="w-44 pb-2 text-[13px] font-semibold text-foreground">Usual route · {t.name}</p>
      <Field label="Usual km per day" width="w-32">
        <Text name="distance_km" defaultValue={t.distance_km?.toString()} />
      </Field>
      <Field label="Usual trips per day" width="w-32">
        <Text name="trips_per_day" defaultValue={t.trips_per_day?.toString()} />
      </Field>
      <Field label="Usual diesel L per day" width="w-36">
        <Text name="diesel_litre_per_day" defaultValue={t.diesel_litre_per_day?.toString()} />
      </Field>
      <SubmitButton>Save</SubmitButton>
      <button type="button" onClick={onDone} className={`pb-2 ${linkButton}`}>Cancel</button>
      <p className="w-full text-[11px] text-muted-foreground">
        Only used to pre-fill the day entry until this transporter has a day saved - after that each
        new day starts from the last one. Fill in whichever it is paid on.
      </p>
    </ActionForm>
  );
}

/** "112 km · 1 trip(s) · 125 L" - whichever of the usual quantities are set. */
function usualText(t: TransporterRow) {
  return [
    t.distance_km !== null ? `${formatNumber(t.distance_km, 0)} km` : null,
    t.trips_per_day !== null ? `${formatNumber(t.trips_per_day, 0)} trip(s)` : null,
    t.diesel_litre_per_day !== null ? `${formatNumber(t.diesel_litre_per_day, 0)} L diesel` : null,
  ].filter(Boolean).join(" · ");
}

export function TransporterRates({
  section, transporters, rates, today, dieselPrice,
}: {
  section: TransportSection;
  transporters: TransporterRow[];
  rates: RateRow[];
  today: string;
  dieselPrice: number | undefined;   // in force today
}) {
  const [open, setOpen] = useState<{ id: string; form: "rate" | "usual" | "history" } | null>(null);
  const toggle = (id: string, form: "rate" | "usual" | "history") =>
    setOpen((o) => (o?.id === id && o.form === form ? null : { id, form }));

  return (
    <Section
      title="Rates"
      description="The rate each transporter is paid. When a rate changes, click New rate and give the date it starts from - earlier days keep the rate they were run at."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <THead>
            <Th align="left">Transporter</Th>
            <Th align="left">Paid</Th>
            <Th>Rate now ₹</Th>
            <Th align="left">Since</Th>
            <Th>Usual route</Th>
            <Th />
          </THead>
          <tbody>
            {transporters.map((t) => {
              // rates arrive newest first
              const history = rates.filter((r) => r.transporter_id === t.id);
              const current = history.find((r) => r.effective_from <= today);
              const upcoming = history.filter((r) => r.effective_from > today).at(-1);
              const isOpen = (form: string) => open?.id === t.id && open.form === form;

              return (
                <Fragment key={t.id}>
                  <tr className={`border-b border-border/70 hover:bg-muted ${t.is_active ? "" : "text-muted-foreground"}`}>
                    <td className="px-3 py-1.5 font-semibold text-foreground">
                      {t.name}
                      {t.is_active ? null : <span className="ml-1 text-[10px] font-normal text-muted-foreground">inactive</span>}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {current ? COST_BASES[current.cost_basis].label : "—"}
                    </td>
                    <td className="num px-3 py-1.5 text-right font-semibold text-foreground">
                      {current ? rateText(current, dieselPrice) : <span className="font-normal text-amber-700">no rate yet</span>}
                      {upcoming ? (
                        <div className="text-[10px] font-normal text-muted-foreground">
                          {rateText(upcoming)} from {upcoming.effective_from}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{current?.effective_from ?? ""}</td>
                    <td className="num px-3 py-1.5 text-right text-muted-foreground">{usualText(t)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">
                      <span className="inline-flex gap-3">
                        <button onClick={() => toggle(t.id, "rate")} className={linkButton}>New rate</button>
                        <button onClick={() => toggle(t.id, "usual")} className={linkButton}>Usual route</button>
                        <button onClick={() => toggle(t.id, "history")} className={linkButton}>
                          History ({history.length})
                        </button>
                      </span>
                    </td>
                  </tr>
                  {isOpen("rate") ? (
                    <tr className="border-b border-border/70">
                      <td colSpan={COLS} className="p-2">
                        <NewRateForm section={section} t={t} current={current} today={today} onDone={() => setOpen(null)} />
                      </td>
                    </tr>
                  ) : null}
                  {isOpen("usual") ? (
                    <tr className="border-b border-border/70">
                      <td colSpan={COLS} className="p-2">
                        <UsualRouteForm t={t} onDone={() => setOpen(null)} />
                      </td>
                    </tr>
                  ) : null}
                  {isOpen("history") ? (
                    <tr className="border-b border-border/70 bg-muted/30">
                      <td colSpan={COLS} className="px-6 py-2">
                        {history.length === 0 ? (
                          <p className="text-[12px] text-muted-foreground">No rates yet.</p>
                        ) : (
                          <table className="text-[12px]">
                            <tbody>
                              {history.map((r) => (
                                <tr key={r.id}>
                                  <td className="py-0.5 pr-6 text-muted-foreground">from {r.effective_from}</td>
                                  <td className="py-0.5 pr-6">{COST_BASES[r.cost_basis].label}</td>
                                  <td className="num py-0.5 pr-6 text-right font-semibold">{rateText(r)}</td>
                                  <td className="py-0.5 text-muted-foreground">{r.notes}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {transporters.length === 0 ? <Empty colSpan={COLS}>No transporters in this section yet.</Empty> : null}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
