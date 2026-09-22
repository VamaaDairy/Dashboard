"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { addMovement, deleteMovement } from "@/app/tanks/actions";
import {
  ActionForm, DeleteButton, Empty, Field, Num, NumInput, Section, Select, SubmitButton, THead, Th,
} from "./ui";
import { formatNumber } from "@/lib/format";
import type { MovementRow, TankRow } from "@/lib/tanks/data";

const DIRECTIONS = [
  { value: "in", label: "Milk in (addition)" },
  { value: "out", label: "Milk out (withdrawal)" },
];

/** Same blend the server computes in src/lib/tanks/engine.ts - shown before committing. */
function preview(tank: TankRow, direction: "in" | "out", qty: number, fat: number, snf: number, cost: number) {
  if (!Number.isFinite(qty) || qty <= 0) return null;

  if (direction === "out") {
    const newQty = tank.qty_litre - qty;
    if (newQty < -0.005) return null;
    return { qty_litre: newQty, fat_pct: tank.fat_pct, snf_pct: tank.snf_pct, cost_per_litre: tank.cost_per_litre };
  }

  const newQty = tank.qty_litre + qty;
  const blend = (existing: number, incoming: number) => (tank.qty_litre * existing + qty * incoming) / newQty;
  return {
    qty_litre: newQty,
    fat_pct: blend(tank.fat_pct, fat || 0),
    snf_pct: blend(tank.snf_pct, snf || 0),
    cost_per_litre: blend(tank.cost_per_litre, cost || 0),
  };
}

export function TankLedger({ tank, movements }: { tank: TankRow; movements: MovementRow[] }) {
  return (
    <>
      <Section
        title="Add a movement"
        description="Milk in blends its fat, SNF and cost into the tank by volume. Milk out leaves at whatever the tank's blend is right now - no fat/SNF/cost to enter for a withdrawal."
      >
        <MovementForm tank={tank} />
      </Section>

      <Section
        title="Ledger"
        description="Every addition and withdrawal, oldest first when read top to bottom in date order, with the tank's balance frozen right after each one."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <THead>
              <Th align="left">Date</Th>
              <Th align="left">Direction</Th>
              <Th>Qty L</Th>
              <Th>Fat %</Th>
              <Th>SNF %</Th>
              <Th>₹/L</Th>
              <Th>Balance L</Th>
              <Th>Balance fat %</Th>
              <Th>Balance SNF %</Th>
              <Th>Balance ₹/L</Th>
              <Th align="left">Notes</Th>
              <Th />
            </THead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-border/70 hover:bg-muted">
                  <td className="px-3 py-1.5 font-semibold text-foreground">{m.movement_date}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        m.direction === "in" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
                      }`}
                    >
                      {m.direction === "in" ? (
                        <ArrowDownToLine className="h-3 w-3" />
                      ) : (
                        <ArrowUpFromLine className="h-3 w-3" />
                      )}
                      {m.direction === "in" ? "In" : "Out"}
                    </span>
                  </td>
                  <Num value={m.qty_litre} decimals={1} className="font-semibold" />
                  <Num value={m.fat_pct} dim={m.direction === "out"} />
                  <Num value={m.snf_pct} dim={m.direction === "out"} />
                  <Num value={m.cost_per_litre} decimals={3} dim={m.direction === "out"} />
                  <Num value={m.balance_litre} decimals={1} className="font-semibold" />
                  <Num value={m.balance_fat_pct} dim />
                  <Num value={m.balance_snf_pct} dim />
                  <Num value={m.balance_cost_per_litre} decimals={3} dim />
                  <td className="px-3 py-1.5 text-[12px] text-muted-foreground">{m.notes ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">
                    <DeleteButton
                      onDelete={() => deleteMovement(m.id, tank.id)}
                      confirmLabel={`this ${m.direction === "in" ? "addition" : "withdrawal"} of ${formatNumber(m.qty_litre, 0)} L`}
                    />
                  </td>
                </tr>
              ))}
              {movements.length === 0 ? (
                <Empty colSpan={12}>Nothing recorded yet. Add the first movement above.</Empty>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function MovementForm({ tank }: { tank: TankRow }) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");
  const [cost, setCost] = useState("");

  const p = useMemo(
    () => preview(tank, direction, Number(qty.replace(/,/g, "")), Number(fat), Number(snf), Number(cost)),
    [tank, direction, qty, fat, snf, cost],
  );

  return (
    <ActionForm
      action={addMovement}
      resetOnSuccess
      onSuccess={() => { setDirection("in"); setQty(""); setFat(""); setSnf(""); setCost(""); }}
      className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/30 px-4 py-4"
    >
      <input type="hidden" name="tank_id" value={tank.id} />

      <Field label="Direction" width="w-48">
        <Select
          name="direction"
          value={direction}
          options={DIRECTIONS}
          onChange={(v) => setDirection(v as "in" | "out")}
        />
      </Field>
      <Field label="Date" width="w-40">
        <input
          type="date"
          name="movement_date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-lg border border-border bg-input/30 px-3 py-2 text-[13px] focus:border-primary focus:outline-none"
        />
      </Field>
      <Field label="Quantity (L)" width="w-32">
        <NumInput name="qty_litre" value={qty} onChange={setQty} placeholder="1000" />
      </Field>

      {direction === "in" ? (
        <>
          <Field label="Fat %" width="w-24">
            <NumInput name="fat_pct" value={fat} onChange={setFat} placeholder="6.0" />
          </Field>
          <Field label="SNF %" width="w-24">
            <NumInput name="snf_pct" value={snf} onChange={setSnf} placeholder="9.0" />
          </Field>
          <Field label="Cost ₹/L" width="w-28">
            <NumInput name="cost_per_litre" value={cost} onChange={setCost} placeholder="35.00" />
          </Field>
        </>
      ) : null}

      <Field label="Notes" width="w-52" hint="optional">
        <input
          name="notes"
          className="w-full rounded-lg border border-border bg-input/30 px-3 py-2 text-[13px] focus:border-primary focus:outline-none"
        />
      </Field>

      <SubmitButton>{direction === "in" ? "Add milk in" : "Record withdrawal"}</SubmitButton>

      <div className="w-full">
        {p ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-primary/25 bg-accent px-3 py-2 text-[12px]">
            <Chip label="New balance" value={`${formatNumber(p.qty_litre, 1)} L`} strong />
            <Chip label="Fat" value={`${formatNumber(p.fat_pct, 2)}%`} />
            <Chip label="SNF" value={`${formatNumber(p.snf_pct, 2)}%`} />
            <Chip label="₹/L" value={formatNumber(p.cost_per_litre, 3)} strong />
            <Chip label="Value" value={`₹${formatNumber(p.qty_litre * p.cost_per_litre, 0)}`} />
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Tank has {formatNumber(tank.qty_litre, 1)} L right now at {formatNumber(tank.fat_pct, 2)}% fat,{" "}
            {formatNumber(tank.snf_pct, 2)}% SNF, ₹{formatNumber(tank.cost_per_litre, 3)}/L.
          </p>
        )}
      </div>
    </ActionForm>
  );
}

function Chip({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`num ${strong ? "font-black text-foreground" : "font-semibold text-foreground"}`}>
        {value}
      </span>
    </span>
  );
}
