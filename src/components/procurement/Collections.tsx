"use client";

import { useMemo, useState } from "react";
import { deleteBatch, saveBatch } from "@/app/procurement/actions";
import {
  ActionForm, DeleteButton, Empty, Field, Num, Section, Select, SubmitButton, Text, THead, Th,
} from "./ui";
import { priceBatch } from "@/lib/procurement/pricing";
import { kgToLitres } from "@/lib/units";
import { formatNumber } from "@/lib/format";
import type { BatchRow, CenterRow, RateChartRow, TripRow } from "@/lib/procurement/data";

const SHIFTS = [
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
];

export function Collections({
  batches, centers, charts, trips, kgPerLitre,
}: {
  batches: BatchRow[];
  centers: CenterRow[];
  charts: RateChartRow[];
  trips: TripRow[];
  kgPerLitre: number;
}) {
  const active = centers.filter((c) => c.is_active);

  return (
    <Section
      title="Collections"
      description={
        <>
          One row per centre per shift. Enter the weight taken in the container and the test — the
          litres, the kilograms of fat and SNF, the farmer payment and the sachiv commission all
          follow from those three numbers.
        </>
      }
    >
      {active.length === 0 || charts.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-slate-500">
          Add {charts.length === 0 ? "a rate chart" : ""}
          {charts.length === 0 && active.length === 0 ? " and " : ""}
          {active.length === 0 ? "a collection centre" : ""} before recording collections.
        </p>
      ) : (
        <CollectionForm centers={active} charts={charts} trips={trips} kgPerLitre={kgPerLitre} />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <THead>
            <Th align="left">Date</Th>
            <Th align="left">Shift</Th>
            <Th align="left">Centre</Th>
            <Th>Weight kg</Th>
            <Th>Litres</Th>
            <Th>Fat %</Th>
            <Th>SNF %</Th>
            <Th>kg solids</Th>
            <Th>Farmer ₹</Th>
            <Th>₹/kg</Th>
            <Th>Commission ₹</Th>
            <Th align="left">Tanker</Th>
            <Th />
          </THead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.batch_id} className="border-b border-slate-100 hover:bg-blue-50/40">
                <td className="px-3 py-1.5 font-semibold text-[#2B4C86]">{b.collected_on}</td>
                <td className="px-3 py-1.5 capitalize text-slate-500">{b.shift}</td>
                <td className="px-3 py-1.5">
                  {b.center_name}
                  {b.sachiv_name ? (
                    <div className="text-[10px] text-slate-400">{b.sachiv_name}</div>
                  ) : null}
                </td>
                <Num value={b.qty_kg} decimals={1} className="font-semibold" />
                <Num value={b.qty_litre} decimals={1} dim />
                <Num value={b.fat_pct} />
                <Num value={b.snf_pct} />
                <Num value={b.kg_solids} decimals={2} />
                <Num value={b.farmer_amount} className="font-semibold" />
                <Num value={b.farmer_rate_per_kg} />
                <Num value={b.commission_amount} className="text-[#2F7D6A]" />
                <td className="px-3 py-1.5 text-[12px] text-slate-500">
                  {b.tanker_code ?? <span className="text-amber-600">not loaded</span>}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <DeleteButton
                    onDelete={() => deleteBatch(b.batch_id)}
                    confirmLabel={`${b.center_name} — ${b.collected_on} ${b.shift}`}
                  />
                </td>
              </tr>
            ))}
            {batches.length === 0 ? (
              <Empty colSpan={13}>No collections recorded yet.</Empty>
            ) : null}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function CollectionForm({
  centers, charts, trips, kgPerLitre,
}: {
  centers: CenterRow[];
  charts: RateChartRow[];
  trips: TripRow[];
  kgPerLitre: number;
}) {
  const [centerId, setCenterId] = useState(centers[0]?.id ?? "");
  const [chartId, setChartId] = useState("");
  const [qtyKg, setQtyKg] = useState("");
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");

  const center = centers.find((c) => c.id === centerId) ?? centers[0];
  const chart =
    charts.find((c) => c.id === (chartId || center?.rate_chart_id)) ?? charts[0];

  /** Exactly the arithmetic the server will redo on save — shown before committing. */
  const preview = useMemo(() => {
    const qty = Number(qtyKg.replace(/,/g, ""));
    if (!Number.isFinite(qty) || qty <= 0 || !chart || !center) return null;
    return priceBatch(
      { qty_kg: qty, fat_pct: toNum(fat), snf_pct: toNum(snf) },
      chart,
      center,
      kgPerLitre,
    );
  }, [qtyKg, fat, snf, chart, center, kgPerLitre]);

  return (
    <ActionForm
      action={saveBatch}
      resetOnSuccess
      // the weight and test are controlled, so form.reset() alone would not clear them
      onSuccess={() => {
        setQtyKg("");
        setFat("");
        setSnf("");
      }}
      className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50/50 px-4 py-4"
    >
      <Field label="Date" width="w-40">
        <Text type="date" name="collected_on" defaultValue={new Date().toISOString().slice(0, 10)} />
      </Field>
      <Field label="Shift" width="w-32">
        <Select name="shift" defaultValue="morning" options={SHIFTS} />
      </Field>
      <Field label="Centre" width="w-52">
        <Select
          name="center_id"
          defaultValue={centerId}
          onChange={setCenterId}
          options={centers.map((c) => ({ value: c.id, label: c.name }))}
        />
      </Field>
      <Field
        label="Rate chart"
        width="w-52"
        hint={center?.chart_name ? `centre default: ${center.chart_name}` : "centre has no default"}
      >
        <Select
          name="rate_chart_id"
          defaultValue={chartId}
          onChange={setChartId}
          options={[
            { value: "", label: center?.chart_name ?? "— pick a chart —" },
            ...charts.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </Field>
      <Field label="Weight taken (kg)" width="w-36" hint="what the container weighed">
        <input
          name="qty_kg"
          inputMode="decimal"
          placeholder="1250"
          value={qtyKg}
          onChange={(e) => setQtyKg(e.target.value)}
          className="num w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] focus:border-[#4A6FA5] focus:outline-none"
        />
      </Field>
      <Field label="Fat %" width="w-24">
        <input
          name="fat_pct"
          inputMode="decimal"
          placeholder="6.5"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
          className="num w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] focus:border-[#4A6FA5] focus:outline-none"
        />
      </Field>
      <Field label="SNF %" width="w-24">
        <input
          name="snf_pct"
          inputMode="decimal"
          placeholder="9.0"
          value={snf}
          onChange={(e) => setSnf(e.target.value)}
          className="num w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] focus:border-[#4A6FA5] focus:outline-none"
        />
      </Field>
      <Field label="Tanker" width="w-44" hint="can be loaded later">
        <Select
          name="trip_id"
          defaultValue=""
          options={[
            { value: "", label: "— not loaded —" },
            ...trips.map((t) => ({
              value: t.trip_id,
              label: `${t.trip_date} · ${t.tanker_code}`,
            })),
          ]}
        />
      </Field>

      <SubmitButton>Record collection</SubmitButton>

      <div className="w-full">
        {preview ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-[#4A6FA5]/25 bg-[#F2F6FD] px-3 py-2 text-[12px]">
            <Chip label="Litres" value={formatNumber(preview.qty_litre, 1)} />
            <Chip label="kg fat" value={formatNumber(preview.kg_fat, 2)} />
            <Chip label="kg SNF" value={formatNumber(preview.kg_snf, 2)} />
            <Chip label="kg solids" value={formatNumber(preview.kg_solids, 2)} />
            <Chip label="Farmer" value={`₹${formatNumber(preview.farmer_amount, 2)}`} strong />
            <Chip label="₹/kg milk" value={formatNumber(preview.farmer_rate_per_kg, 2)} />
            <Chip
              label="₹/litre"
              value={formatNumber(
                preview.qty_litre > 0 ? preview.farmer_amount / preview.qty_litre : 0,
                2,
              )}
            />
            <Chip
              label="Commission"
              value={`₹${formatNumber(preview.commission_amount, 2)}`}
              strong
            />
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">
            {formatNumber(kgPerLitre, 2)} kg = 1 litre, so a container weighing 1,000 kg holds{" "}
            {formatNumber(kgToLitres(1000, kgPerLitre), 1)} litres. We pay on the weight and its
            solids; the litre figure is only for reporting.
          </p>
        )}
      </div>
    </ActionForm>
  );
}

function Chip({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`num ${strong ? "font-black text-[#2B4C86]" : "font-semibold text-slate-700"}`}>
        {value}
      </span>
    </span>
  );
}

function toNum(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (t === "") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}
