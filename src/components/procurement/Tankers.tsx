"use client";

import { useState } from "react";
import { assignBatchToTrip, deleteTrip, saveTrip } from "@/app/procurement/actions";
import {
  ActionForm, DeleteButton, Empty, Field, Num, NumInput, Section, Select, SubmitButton, Text, THead, Th,
} from "./ui";
import { formatNumber } from "@/lib/format";
import type { BatchRow, TripRow } from "@/lib/procurement/data";

const COST_MODES = [
  { value: "per_trip", label: "Fixed hire per trip" },
  { value: "per_km", label: "Per kilometre" },
  { value: "per_kg", label: "Per kg carried" },
  { value: "per_litre", label: "Per litre carried" },
];

export function Tankers({
  trips, batches, kgPerLitre,
}: {
  trips: TripRow[];
  batches: BatchRow[];
  kgPerLitre: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      <Section
        title="Tanker trips"
        description={
          <>
            What it cost to bring the milk in. Hire is quoted per trip, per kilometre or on the
            quantity carried, and the cost is shared out over the collections loaded on that tanker
            in proportion to their weight. Enter the dock weight to account for transit shortage —
            the milk that arrives has to carry the cost of the milk that did not.
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <THead>
              <Th align="left">Date</Th>
              <Th align="left">Tanker</Th>
              <Th align="left">Route</Th>
              <Th>km</Th>
              <Th align="left">Charged</Th>
              <Th>Rate</Th>
              <Th>Other ₹</Th>
              <Th>Trip cost ₹</Th>
              <Th>Loaded kg</Th>
              <Th>Landed kg</Th>
              <Th>Short kg</Th>
              <Th>₹/kg</Th>
              <Th>₹/litre</Th>
              <Th />
            </THead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.trip_id} className="border-b border-slate-100 hover:bg-blue-50/40">
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() => setEditing(editing === t.trip_id ? null : t.trip_id)}
                      className="font-semibold text-[#2B4C86] hover:underline"
                    >
                      {t.trip_date}
                    </button>
                  </td>
                  <td className="px-3 py-1.5">
                    {t.tanker_code}
                    {t.vehicle_no ? (
                      <div className="text-[10px] text-slate-400">{t.vehicle_no}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-slate-500">{t.route ?? "—"}</td>
                  <Num value={t.distance_km} decimals={1} dim />
                  <td className="px-3 py-1.5 text-[12px] text-slate-500">
                    {COST_MODES.find((m) => m.value === t.cost_mode)?.label}
                    {t.cost_override !== null ? (
                      <span className="ml-1 text-[10px] font-bold text-[#2B4C86]">billed</span>
                    ) : null}
                  </td>
                  <Num value={t.rate} />
                  <Num value={t.other_cost} dim />
                  <Num value={t.trip_cost} className="font-semibold" />
                  <Num value={t.dispatched_kg} decimals={1} />
                  <Num value={t.landed_kg} decimals={1} />
                  <td
                    className={`num px-3 py-1.5 text-right ${
                      Number(t.shortage_kg) > 0 ? "font-semibold text-amber-600" : "text-slate-300"
                    }`}
                  >
                    {formatNumber(t.shortage_kg, 1)}
                  </td>
                  <Num value={t.cost_per_kg} decimals={3} className="font-semibold text-[#3E5FA0]" />
                  <Num value={t.cost_per_litre} decimals={3} />
                  <td className="px-2 py-1.5 text-right">
                    <DeleteButton
                      onDelete={() => deleteTrip(t.trip_id)}
                      confirmLabel={`the ${t.trip_date} trip on ${t.tanker_code}`}
                    />
                  </td>
                </tr>
              ))}
              {trips.length === 0 ? (
                <Empty colSpan={14}>No tanker trips yet. Add the first run below.</Empty>
              ) : null}
            </tbody>
          </table>
        </div>

        {trips.map((t) =>
          editing === t.trip_id ? (
            <TripForm key={t.trip_id} trip={t} onDone={() => setEditing(null)} />
          ) : null,
        )}
        {editing === null ? <TripForm kgPerLitre={kgPerLitre} /> : null}
      </Section>

      <Loading batches={batches} trips={trips} />
    </>
  );
}

function TripForm({
  trip, onDone, kgPerLitre,
}: {
  trip?: TripRow;
  onDone?: () => void;
  kgPerLitre?: number;
}) {
  return (
    <ActionForm
      action={saveTrip}
      onSuccess={onDone}
      resetOnSuccess={!trip}
      className="flex flex-wrap items-end gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-4"
    >
      {trip ? <input type="hidden" name="id" value={trip.trip_id} /> : null}

      <Field label="Date" width="w-40">
        <Text
          type="date"
          name="trip_date"
          defaultValue={trip?.trip_date ?? new Date().toISOString().slice(0, 10)}
        />
      </Field>
      <Field label="Tanker" width="w-36">
        <Text name="tanker_code" defaultValue={trip?.tanker_code} placeholder="TNK-1" required />
      </Field>
      <Field label="Vehicle no." width="w-36">
        <Text name="vehicle_no" defaultValue={trip?.vehicle_no} placeholder="GJ 01 AB 1234" />
      </Field>
      <Field label="Route" width="w-40">
        <Text name="route" defaultValue={trip?.route} placeholder="North villages" />
      </Field>
      <Field label="Distance km" width="w-28">
        <NumInput name="distance_km" defaultValue={trip?.distance_km} placeholder="62" decimals={1} />
      </Field>
      <Field label="Charged" width="w-52">
        <Select name="cost_mode" defaultValue={trip?.cost_mode ?? "per_trip"} options={COST_MODES} />
      </Field>
      <Field label="Rate ₹" width="w-32">
        <NumInput name="rate" defaultValue={trip?.rate} placeholder="3500" />
      </Field>
      <Field label="Other ₹" width="w-28" hint="tolls, cleaning">
        <NumInput name="other_cost" defaultValue={trip?.other_cost} placeholder="0" />
      </Field>
      <Field label="Actual bill ₹" width="w-32" hint="overrides the rate">
        <NumInput name="cost_override" defaultValue={trip?.cost_override} placeholder="—" />
      </Field>
      <Field label="Dock weight kg" width="w-36" hint="blank = no shortage">
        <NumInput
          name="received_qty_kg"
          defaultValue={trip?.landed_kg && trip.shortage_kg ? trip.landed_kg : null}
          placeholder="—"
          decimals={1}
        />
      </Field>

      <SubmitButton>{trip ? "Save trip" : "Add trip"}</SubmitButton>
      {trip ? (
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      ) : (
        <p className="w-full text-[11px] text-slate-500">
          A per-litre hire is converted to weight at {formatNumber(kgPerLitre ?? 1.03, 2)} kg per
          litre before it is shared out, so every mode ends up as rupees per kilogram landed.
        </p>
      )}
    </ActionForm>
  );
}

/** Which collections rode on which tanker. */
function Loading({ batches, trips }: { batches: BatchRow[]; trips: TripRow[] }) {
  return (
    <Section
      title="Loading"
      description="Put each collection on the tanker that carried it. Anything left unloaded carries no transport cost yet."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <THead>
            <Th align="left">Date</Th>
            <Th align="left">Centre</Th>
            <Th>Weight kg</Th>
            <Th align="left">Tanker</Th>
            <Th>Transport ₹</Th>
            <Th>₹/kg</Th>
          </THead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.batch_id} className="border-b border-slate-100 hover:bg-blue-50/40">
                <td className="px-3 py-1.5 font-semibold text-[#2B4C86]">
                  {b.collected_on}
                  <span className="ml-1 text-[10px] font-normal capitalize text-slate-400">
                    {b.shift}
                  </span>
                </td>
                <td className="px-3 py-1.5">{b.center_name}</td>
                <Num value={b.qty_kg} decimals={1} />
                <td className="px-3 py-1.5">
                  <TripPicker batch={b} trips={trips} />
                </td>
                <Num value={b.transport_amount} className="font-semibold" />
                <Num
                  value={b.qty_kg > 0 ? b.transport_amount / b.qty_kg : null}
                  decimals={3}
                  dim
                />
              </tr>
            ))}
            {batches.length === 0 ? (
              <Empty colSpan={6}>Record collections first — then load them onto a tanker.</Empty>
            ) : null}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function TripPicker({ batch, trips }: { batch: BatchRow; trips: TripRow[] }) {
  const [pending, setPending] = useState(false);

  return (
    <select
      disabled={pending}
      defaultValue={batch.trip_id ?? ""}
      onChange={async (e) => {
        setPending(true);
        await assignBatchToTrip(batch.batch_id, e.target.value);
        setPending(false);
      }}
      className={`rounded-lg border px-2 py-1 text-[12px] focus:border-[#4A6FA5] focus:outline-none ${
        batch.trip_id
          ? "border-slate-200 bg-white"
          : "border-amber-300 bg-amber-50 text-amber-700"
      } ${pending ? "opacity-50" : ""}`}
    >
      <option value="">— not loaded —</option>
      {trips.map((t) => (
        <option key={t.trip_id} value={t.trip_id}>
          {t.trip_date} · {t.tanker_code}
        </option>
      ))}
    </select>
  );
}
