"use client";

import { useState } from "react";
import Link from "next/link";
import { saveTank, deleteTank } from "@/app/tanks/actions";
import {
  ActionForm, DeleteButton, Empty, Field, Num, Section, SubmitButton, Text, THead, Th,
} from "./ui";
import { formatNumber } from "@/lib/format";
import type { TankRow } from "@/lib/tanks/data";

export function TankList({ tanks }: { tanks: TankRow[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <Section
      title="Tanks"
      description="Every tank's current blend - the weighted average of everything poured into it, less what has been drawn out. Click a tank to see its ledger and add a movement."
      actions={
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-accent"
        >
          {adding ? "Cancel" : "Add tank"}
        </button>
      }
    >
      {adding ? <TankForm onDone={() => setAdding(false)} /> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <THead>
            <Th align="left">Tank</Th>
            <Th>Capacity L</Th>
            <Th>Qty L</Th>
            <Th>Fat %</Th>
            <Th>SNF %</Th>
            <Th>₹/L</Th>
            <Th>Value ₹</Th>
            <Th />
          </THead>
          <tbody>
            {tanks.map((t) => (
              <tr
                key={t.id}
                className={`border-b border-border/70 hover:bg-muted ${t.is_active ? "" : "text-muted-foreground"}`}
              >
                <td className="px-3 py-1.5">
                  <Link href={`/tanks/${t.code}`} className="font-semibold text-foreground hover:underline">
                    {t.name}
                  </Link>
                  {t.is_active ? null : <span className="ml-1 text-[10px] text-muted-foreground">inactive</span>}
                  {t.capacity_litre && t.qty_litre > t.capacity_litre ? (
                    <span className="ml-1 text-[10px] font-bold text-amber-700">over capacity</span>
                  ) : null}
                </td>
                <Num value={t.capacity_litre} decimals={0} dim />
                <Num value={t.qty_litre} decimals={1} className="font-semibold" />
                <Num value={t.fat_pct} />
                <Num value={t.snf_pct} />
                <Num value={t.cost_per_litre} decimals={3} />
                <Num value={t.qty_litre * t.cost_per_litre} decimals={0} className="font-black text-foreground" />
                <td className="px-2 py-1.5 text-right">
                  <DeleteButton onDelete={() => deleteTank(t.id)} confirmLabel={`the tank "${t.name}"`} />
                </td>
              </tr>
            ))}
            {tanks.length === 0 ? <Empty colSpan={8}>No tanks yet. Add the first one above.</Empty> : null}
          </tbody>
          {tanks.length > 0 ? (
            <tfoot>
              <tr className="bg-accent font-semibold">
                <td className="px-3 py-2">Total</td>
                <td />
                <Num value={tanks.reduce((s, t) => s + t.qty_litre, 0)} decimals={1} />
                <td colSpan={2} />
                <td />
                <Num
                  value={tanks.reduce((s, t) => s + t.qty_litre * t.cost_per_litre, 0)}
                  decimals={0}
                  className="font-black text-foreground"
                />
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <p className="border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
        Value ₹ is quantity × the tank&apos;s current weighted-average cost per litre - the
        milk&apos;s book value sitting in the tank right now, not a payment.
      </p>
    </Section>
  );
}

function TankForm({ onDone }: { onDone?: () => void }) {
  return (
    <ActionForm
      action={saveTank}
      onSuccess={onDone}
      className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/30 px-4 py-4"
    >
      <Field label="Tank name" width="w-52">
        <Text name="name" placeholder="Silo 1" required />
      </Field>
      <Field label="Capacity (litres)" width="w-36" hint="optional">
        <Text name="capacity_litre" placeholder="10000" />
      </Field>
      <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold text-muted-foreground">
        <input type="checkbox" name="is_active" defaultChecked />
        Active
      </label>
      <SubmitButton>Add tank</SubmitButton>
    </ActionForm>
  );
}

// re-export so the ledger page can reuse the same edit form for capacity/notes
export function TankEditForm({ tank, onDone }: { tank: TankRow; onDone?: () => void }) {
  return (
    <ActionForm
      action={saveTank}
      onSuccess={onDone}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 px-4 py-4"
    >
      <input type="hidden" name="id" value={tank.id} />
      <Field label="Tank name" width="w-52">
        <Text name="name" defaultValue={tank.name} required />
      </Field>
      <Field label="Capacity (litres)" width="w-36">
        <Text name="capacity_litre" defaultValue={formatNumber(tank.capacity_litre, 0)} />
      </Field>
      <Field label="Notes" width="w-64">
        <Text name="notes" defaultValue={tank.notes} />
      </Field>
      <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold text-muted-foreground">
        <input type="checkbox" name="is_active" defaultChecked={tank.is_active} />
        Active
      </label>
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}
