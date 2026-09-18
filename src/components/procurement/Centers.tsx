"use client";

import { useState } from "react";
import { deleteCenter, saveCenter } from "@/app/procurement/actions";
import {
  ActionForm, DeleteButton, Empty, Field, Num, NumInput, Section, Select, SubmitButton, Text, THead, Th,
} from "./ui";
import { COMMISSION_MODE_LABEL, type CommissionMode } from "@/lib/procurement/pricing";
import { formatNumber } from "@/lib/format";
import type { CenterRow, RateChartRow, SachivRow } from "@/lib/procurement/data";

const MODE_OPTIONS = (Object.keys(COMMISSION_MODE_LABEL) as CommissionMode[]).map((value) => ({
  value,
  label: COMMISSION_MODE_LABEL[value],
}));

/** What a commission rate is quoted in, once the mode is picked. */
function rateUnit(mode: CommissionMode): string {
  switch (mode) {
    case "per_kg":
      return "₹ per kg";
    case "per_litre":
      return "₹ per litre";
    case "pct_of_value":
      return "% of payment";
    case "none":
      return "—";
  }
}

export function Centers({
  centers, charts, earnings,
}: {
  centers: CenterRow[];
  charts: RateChartRow[];
  earnings: SachivRow[];
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      <Section
        title="Collection centres"
        description={
          <>
            The village societies that collect for us and the sachiv who runs each one. Commission
            is set per centre because societies negotiate separately — per kilogram, per litre, or
            as a share of what the farmers were paid.
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <THead>
              <Th align="left">Centre</Th>
              <Th align="left">Sachiv</Th>
              <Th align="left">Village / route</Th>
              <Th>km</Th>
              <Th align="left">Rate chart</Th>
              <Th align="left">Commission</Th>
              <Th>Rate</Th>
              <Th />
            </THead>
            <tbody>
              {centers.map((c) => (
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
                    {c.is_active ? null : (
                      <span className="ml-1 text-[10px] text-slate-400">inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">{c.sachiv_name ?? "—"}</td>
                  <td className="px-3 py-1.5 text-[12px] text-slate-500">
                    {[c.village, c.route].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <Num value={c.distance_km} decimals={1} dim />
                  <td className="px-3 py-1.5 text-[12px] text-slate-500">
                    {c.chart_name ?? <span className="text-amber-600">none set</span>}
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-slate-500">
                    {COMMISSION_MODE_LABEL[c.commission_mode]}
                  </td>
                  <td className="num px-3 py-1.5 text-right font-semibold">
                    {c.commission_mode === "none"
                      ? "—"
                      : `${formatNumber(c.commission_rate, 2)}${
                          c.commission_mode === "pct_of_value" ? "%" : ""
                        }`}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <DeleteButton
                      onDelete={() => deleteCenter(c.id)}
                      confirmLabel={`the centre "${c.name}" and all its collections`}
                    />
                  </td>
                </tr>
              ))}
              {centers.length === 0 ? (
                <Empty colSpan={8}>No collection centres yet. Add the first one below.</Empty>
              ) : null}
            </tbody>
          </table>
        </div>

        {centers.map((c) =>
          editing === c.id ? (
            <CenterForm key={c.id} center={c} charts={charts} onDone={() => setEditing(null)} />
          ) : null,
        )}
        {editing === null ? <CenterForm charts={charts} /> : null}
      </Section>

      <Section
        title="What each sachiv has earned"
        description="Commission is worked out on every collection as it is recorded, so this is the running payable — not an estimate."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <THead>
              <Th align="left">Sachiv</Th>
              <Th align="left">Centre</Th>
              <Th align="left">Collecting since</Th>
              <Th>Collections</Th>
              <Th>Weight kg</Th>
              <Th>Litres</Th>
              <Th>Farmer payout ₹</Th>
              <Th>Commission ₹</Th>
              <Th>₹/kg</Th>
              <Th>₹/litre</Th>
              <Th>% of payout</Th>
            </THead>
            <tbody>
              {earnings.map((e) => (
                <tr key={e.center_id} className="border-b border-slate-100 hover:bg-blue-50/40">
                  <td className="px-3 py-1.5 font-semibold">{e.sachiv_name ?? "—"}</td>
                  <td className="px-3 py-1.5">{e.center_name}</td>
                  <td className="px-3 py-1.5 text-[12px] text-slate-500">
                    {e.first_collection} → {e.last_collection}
                  </td>
                  <Num value={e.batch_count} decimals={0} dim />
                  <Num value={e.qty_kg} decimals={1} />
                  <Num value={e.qty_litre} decimals={1} dim />
                  <Num value={e.farmer_amount} />
                  <Num value={e.commission_amount} className="font-black text-[#2F7D6A]" />
                  <Num value={e.commission_per_kg} decimals={3} />
                  <Num value={e.commission_per_litre} decimals={3} />
                  <Num value={e.commission_pct_of_value} decimals={2} />
                </tr>
              ))}
              {earnings.length === 0 ? (
                <Empty colSpan={11}>
                  Nothing earned yet — commission appears here once collections are recorded.
                </Empty>
              ) : null}
              {earnings.length > 0 ? (
                <tr className="bg-[#F2F6FD] font-semibold">
                  <td className="px-3 py-2" colSpan={4}>
                    Total payable
                  </td>
                  <Num value={sum(earnings, "qty_kg")} decimals={1} />
                  <Num value={sum(earnings, "qty_litre")} decimals={1} />
                  <Num value={sum(earnings, "farmer_amount")} />
                  <Num value={sum(earnings, "commission_amount")} className="font-black text-[#2F7D6A]" />
                  <td colSpan={3} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function CenterForm({
  center, charts, onDone,
}: {
  center?: CenterRow;
  charts: RateChartRow[];
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<CommissionMode>(center?.commission_mode ?? "per_kg");

  return (
    <ActionForm
      action={saveCenter}
      onSuccess={onDone}
      resetOnSuccess={!center}
      className="flex flex-wrap items-end gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-4"
    >
      {center ? <input type="hidden" name="id" value={center.id} /> : null}

      <Field label="Centre name" width="w-52">
        <Text name="name" defaultValue={center?.name} placeholder="Rampur society" required />
      </Field>
      <Field label="Sachiv" width="w-44">
        <Text name="sachiv_name" defaultValue={center?.sachiv_name} placeholder="Name" />
      </Field>
      <Field label="Village" width="w-40">
        <Text name="village" defaultValue={center?.village} />
      </Field>
      <Field label="Route" width="w-40">
        <Text name="route" defaultValue={center?.route} placeholder="North villages" />
      </Field>
      <Field label="Distance km" width="w-28">
        <NumInput name="distance_km" defaultValue={center?.distance_km} decimals={1} />
      </Field>
      <Field label="Default rate chart" width="w-52">
        <Select
          name="rate_chart_id"
          defaultValue={center?.rate_chart_id ?? ""}
          options={[
            { value: "", label: "— none —" },
            ...charts.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </Field>
      <Field label="Commission" width="w-56">
        <Select
          name="commission_mode"
          defaultValue={mode}
          options={MODE_OPTIONS}
          onChange={(v) => setMode(v as CommissionMode)}
        />
      </Field>
      {mode === "none" ? null : (
        <Field label={rateUnit(mode)} width="w-32">
          <NumInput
            name="commission_rate"
            defaultValue={center?.commission_rate}
            placeholder={mode === "pct_of_value" ? "4" : "0.50"}
          />
        </Field>
      )}

      <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold text-slate-600">
        <input type="checkbox" name="is_active" defaultChecked={center?.is_active ?? true} />
        Active
      </label>

      <SubmitButton>{center ? "Save centre" : "Add centre"}</SubmitButton>
      {center ? (
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      ) : null}

      {center ? (
        <p className="w-full text-[11px] text-slate-500">
          Saving recalculates the commission on every collection already recorded for this centre.
        </p>
      ) : null}
    </ActionForm>
  );
}

function sum(rows: SachivRow[], key: keyof SachivRow): number {
  return rows.reduce((t, r) => t + (Number(r[key]) || 0), 0);
}
