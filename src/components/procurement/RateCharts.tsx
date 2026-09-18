"use client";

import { useState } from "react";
import { deleteRateChart, saveRateChart } from "@/app/procurement/actions";
import {
  ActionForm, DeleteButton, Empty, Field, Num, NumInput, Section, Select, SubmitButton, Text, THead, Th,
} from "./ui";
import { RATE_BASIS_LABEL, chartRatePerKg, type RateBasis } from "@/lib/procurement/pricing";
import { perKgToPerLitre } from "@/lib/units";
import { formatNumber } from "@/lib/format";
import type { RateChartRow } from "@/lib/procurement/data";

const BASIS_OPTIONS = (Object.keys(RATE_BASIS_LABEL) as RateBasis[]).map((value) => ({
  value,
  label: RATE_BASIS_LABEL[value],
}));

const MILK_TYPES = [
  { value: "mixed", label: "Mixed" },
  { value: "cow", label: "Cow" },
  { value: "buffalo", label: "Buffalo" },
];

/** The test the sample column prices against - a typical mixed-milk sample. */
const SAMPLE_FAT = 6.5;
const SAMPLE_SNF = 9.0;

export function RateCharts({ charts, kgPerLitre }: { charts: RateChartRow[]; kgPerLitre: number }) {
  const [basis, setBasis] = useState<RateBasis>("solids");
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <Section
      title="Rate charts"
      description={
        <>
          How milk is valued. The usual basis here is rupees per kilogram of total solids: the
          container is weighed, the milk is tested, and the farmer is paid for the fat and SNF that
          weight carries — not for its volume.
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <THead>
            <Th align="left">Chart</Th>
            <Th align="left">Milk</Th>
            <Th align="left">Basis</Th>
            <Th>₹/kg fat</Th>
            <Th>₹/kg SNF</Th>
            <Th>₹/kg solids</Th>
            <Th>Flat ₹</Th>
            <Th>
              Pays ₹/kg
              <div className="font-normal normal-case tracking-normal text-slate-400">
                at {SAMPLE_FAT} fat / {SAMPLE_SNF} SNF
              </div>
            </Th>
            <Th>₹/litre</Th>
            <Th align="left">Used by</Th>
            <Th />
          </THead>
          <tbody>
            {charts.map((c) => {
              const perKg = chartRatePerKg(c, SAMPLE_FAT, SAMPLE_SNF, kgPerLitre);
              return (
                <tr
                  key={c.id}
                  className={`border-b border-slate-100 hover:bg-blue-50/40 ${
                    c.is_active ? "" : "text-slate-400"
                  }`}
                >
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() => setEditing(editing === c.id ? null : c.id)}
                      className="font-semibold text-[#2B4C86] hover:underline"
                    >
                      {c.name}
                    </button>
                    <div className="text-[10px] text-slate-400">
                      from {c.effective_from}
                      {c.is_active ? "" : " · inactive"}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 capitalize">{c.milk_type}</td>
                  <td className="px-3 py-1.5 text-[12px] text-slate-500">
                    {RATE_BASIS_LABEL[c.basis]}
                  </td>
                  <Num value={c.rate_fat} dim={!usesField(c.basis, "rate_fat")} />
                  <Num value={c.rate_snf} dim={!usesField(c.basis, "rate_snf")} />
                  <Num value={c.rate_solid} dim={!usesField(c.basis, "rate_solid")} />
                  <Num value={c.flat_rate} dim={!usesField(c.basis, "flat_rate")} />
                  <Num value={perKg} className="font-semibold text-[#3E5FA0]" />
                  <Num value={perKgToPerLitre(perKg, kgPerLitre)} />
                  <td className="px-3 py-1.5 text-[12px] text-slate-500">
                    {c.center_count} centre{c.center_count === 1 ? "" : "s"} · {c.batch_count} collection
                    {c.batch_count === 1 ? "" : "s"}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <DeleteButton
                      onDelete={() => deleteRateChart(c.id)}
                      confirmLabel={`the rate chart "${c.name}"`}
                    />
                  </td>
                </tr>
              );
            })}
            {charts.length === 0 ? (
              <Empty colSpan={11}>
                No rate charts yet. Add the one your societies are paid on below.
              </Empty>
            ) : null}
          </tbody>
        </table>
      </div>

      {charts.map((c) =>
        editing === c.id ? (
          <ChartForm
            key={c.id}
            chart={c}
            kgPerLitre={kgPerLitre}
            onDone={() => setEditing(null)}
          />
        ) : null,
      )}

      {editing === null ? (
        <ChartForm basis={basis} onBasisChange={setBasis} kgPerLitre={kgPerLitre} />
      ) : null}
    </Section>
  );
}

function usesField(basis: RateBasis, field: string): boolean {
  switch (basis) {
    case "solids":
      return field === "rate_solid";
    case "fat_snf":
      return field === "rate_fat" || field === "rate_snf";
    case "fat_only":
      return field === "rate_fat";
    default:
      return field === "flat_rate";
  }
}

function ChartForm({
  chart, basis: basisProp, onBasisChange, kgPerLitre, onDone,
}: {
  chart?: RateChartRow;
  basis?: RateBasis;
  onBasisChange?: (b: RateBasis) => void;
  kgPerLitre: number;
  onDone?: () => void;
}) {
  const [basis, setBasis] = useState<RateBasis>(basisProp ?? chart?.basis ?? "solids");
  const setBoth = (b: RateBasis) => {
    setBasis(b);
    onBasisChange?.(b);
  };

  return (
    <ActionForm
      action={saveRateChart}
      onSuccess={onDone}
      resetOnSuccess={!chart}
      className="flex flex-wrap items-end gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-4"
    >
      {chart ? <input type="hidden" name="id" value={chart.id} /> : null}

      <Field label="Chart name" width="w-56">
        <Text name="name" defaultValue={chart?.name} placeholder="Buffalo — kg solids" required />
      </Field>
      <Field label="Milk" width="w-32">
        <Select name="milk_type" defaultValue={chart?.milk_type ?? "mixed"} options={MILK_TYPES} />
      </Field>
      <Field label="Paid on" width="w-60">
        <Select
          name="basis"
          defaultValue={basis}
          options={BASIS_OPTIONS}
          onChange={(v) => setBoth(v as RateBasis)}
        />
      </Field>

      {basis === "solids" ? (
        <Field label="₹ per kg solids" width="w-36" hint="fat + SNF together">
          <NumInput name="rate_solid" defaultValue={chart?.rate_solid} placeholder="297" />
        </Field>
      ) : null}
      {basis === "fat_snf" || basis === "fat_only" ? (
        <Field label="₹ per kg fat" width="w-36">
          <NumInput name="rate_fat" defaultValue={chart?.rate_fat} placeholder="480" />
        </Field>
      ) : null}
      {basis === "fat_snf" ? (
        <Field label="₹ per kg SNF" width="w-36">
          <NumInput name="rate_snf" defaultValue={chart?.rate_snf} placeholder="180" />
        </Field>
      ) : null}
      {basis === "per_kg" || basis === "per_litre" ? (
        <Field label={`₹ per ${basis === "per_kg" ? "kg" : "litre"}`} width="w-36">
          <NumInput name="flat_rate" defaultValue={chart?.flat_rate} placeholder="42" />
        </Field>
      ) : null}

      <Field label="Effective from" width="w-40">
        <Text
          type="date"
          name="effective_from"
          defaultValue={chart?.effective_from ?? new Date().toISOString().slice(0, 10)}
        />
      </Field>

      <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold text-slate-600">
        <input type="checkbox" name="is_active" defaultChecked={chart?.is_active ?? true} />
        Active
      </label>

      <SubmitButton>{chart ? "Save chart" : "Add rate chart"}</SubmitButton>
      {chart ? (
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      ) : null}

      {chart ? (
        <p className="w-full text-[11px] text-slate-500">
          Saving re-prices the {chart.batch_count} collection
          {chart.batch_count === 1 ? "" : "s"} already paid on this chart.
        </p>
      ) : (
        <p className="w-full text-[11px] text-slate-500">
          A chart paying on solids at ₹297/kg pays{" "}
          <span className="num font-semibold text-slate-700">
            ₹{formatNumber(297 * (SAMPLE_FAT + SAMPLE_SNF) / 100, 2)}
          </span>{" "}
          per kg of {SAMPLE_FAT}/{SAMPLE_SNF} milk — that is{" "}
          <span className="num font-semibold text-slate-700">
            ₹{formatNumber(perKgToPerLitre(297 * (SAMPLE_FAT + SAMPLE_SNF) / 100, kgPerLitre), 2)}
          </span>{" "}
          per litre at {formatNumber(kgPerLitre, 2)} kg/L.
        </p>
      )}
    </ActionForm>
  );
}
