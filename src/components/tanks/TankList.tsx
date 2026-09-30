"use client";

import { saveTank } from "@/app/tanks/actions";
import { ActionForm, Field, SubmitButton, Text } from "./ui";
import { formatNumber } from "@/lib/format";
import type { TankRow } from "@/lib/tanks/data";

export function TankForm({ onDone }: { onDone?: () => void }) {
  return (
    <ActionForm
      action={saveTank}
      onSuccess={onDone}
      className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/30 px-4 py-4"
    >
      <Field label="Tank name" width="w-52">
        <Text name="name" placeholder="RMST3" required />
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

/** Name, capacity, notes and active for one tank - its own page. */
export function TankEditForm({ tank, onDone }: { tank: TankRow; onDone?: () => void }) {
  return (
    <ActionForm
      action={saveTank}
      onSuccess={onDone}
      className="flex flex-wrap items-end gap-3 bg-muted/30 px-4 py-4"
    >
      <input type="hidden" name="id" value={tank.id} />
      <Field label="Tank name" width="w-52">
        <Text name="name" defaultValue={tank.name} required />
      </Field>
      <Field label="Capacity (litres)" width="w-36">
        <Text name="capacity_litre" defaultValue={tank.capacity_litre === null ? "" : String(tank.capacity_litre)} />
      </Field>
      <Field label="Notes" width="w-64">
        <Text name="notes" defaultValue={tank.notes} />
      </Field>
      <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold text-muted-foreground">
        <input type="checkbox" name="is_active" defaultChecked={tank.is_active} />
        Active
      </label>
      <SubmitButton>Save</SubmitButton>
      <p className="w-full text-[11px] text-muted-foreground">
        Capacity can&apos;t go below the most this tank has held
        {tank.capacity_litre ? ` (it is ${formatNumber(tank.capacity_litre, 0)} L now)` : ""}.
      </p>
    </ActionForm>
  );
}
