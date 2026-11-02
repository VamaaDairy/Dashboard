"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustTank } from "@/app/tanks/actions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import type { TankDay } from "@/lib/tanks/data";

/**
 * Correct what a tank holds by hand - litres, fat % and SNF % at the end of
 * the day. Saved as a "Manual edit" in the tank's ledger (the old balance out,
 * the new one in), which can be deleted to undo it.
 */
export function EditTankDialog({ tank, date, onClose }: { tank: TankDay | null; date: string; onClose: () => void }) {
  return (
    <Dialog open={tank !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        {tank ? <EditBody key={tank.tank_id} tank={tank} date={date} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(Math.round(Number(n) * 10000) / 10000));

function EditBody({ tank, date, onDone }: { tank: TankDay; date: string; onDone: () => void }) {
  const router = useRouter();
  const [litres, setLitres] = useState(fmt(tank.close_litre));
  const [fat, setFat] = useState(fmt(tank.close_fat_pct));
  const [snf, setSnf] = useState(fmt(tank.close_snf_pct));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await adjustTank(date, tank.tank_id, litres, fat, snf);
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <DialogHeader>
        <DialogTitle>Edit {tank.name}</DialogTitle>
        <DialogDescription>
          Set what the tank holds at the end of {date}. Now: {formatNumber(tank.close_litre, 1)} L,
          {" "}{formatNumber(tank.close_fat_pct, 2)}% fat, {formatNumber(tank.close_snf_pct, 2)}% SNF. The rate ₹ / L stays as it is.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-3 gap-3 px-5 py-4">
        {[
          { label: "Litres", value: litres, set: setLitres },
          { label: "Fat %", value: fat, set: setFat },
          { label: "SNF %", value: snf, set: setSnf },
        ].map((f, i) => (
          <label key={f.label}>
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{f.label}</span>
            <Input inputMode="decimal" value={f.value} autoFocus={i === 0} onFocus={(e) => e.target.select()}
              onChange={(e) => f.set(e.target.value)} className="text-right font-semibold" aria-label={f.label} />
          </label>
        ))}
        {error ? <p className="col-span-3 text-[12px] font-semibold text-destructive">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending} className="bg-foreground text-background hover:bg-foreground/85">
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
