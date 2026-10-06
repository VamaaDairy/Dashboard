"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMovement, transferMilk } from "@/app/tanks/actions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import { kgOfSolid } from "@/lib/units";
import type { TankDay } from "@/lib/tanks/data";

/**
 * Take milk out of one tank on a date - out of the tanks altogether, or into
 * another tank. Only the litres are entered: the milk leaves at the tank's
 * blend, so fat % and SNF % stay the same while litres, kg fat, kg SNF and
 * value come down in proportion. Moved into another tank, it carries that
 * blend and cost in and is weighted into what that tank holds - both shown
 * before saving.
 */
export function TakeOutDialog({
  tank, date, kgPerLitre, tanks = [], onClose,
}: {
  tank: TankDay | null;          // the tank being emptied; null = closed
  date: string;
  kgPerLitre: number;
  tanks?: TankDay[];             // every tank on the date, for "move into" (none = take out only)
  onClose: () => void;
}) {
  return (
    <Dialog open={tank !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        {/* keyed so each tank opens with a blank form */}
        {tank ? <TakeOutBody key={tank.tank_id} tank={tank} date={date} kgPerLitre={kgPerLitre} tanks={tanks} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TakeOutBody({
  tank, date, kgPerLitre, tanks, onDone,
}: {
  tank: TankDay;
  date: string;
  kgPerLitre: number;
  tanks: TankDay[];
  onDone: () => void;
}) {
  const [into, setInto] = useState("");   // "" = out of the tanks; else the tank it moves to
  const router = useRouter();
  const [litres, setLitres] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const have = tank.close_litre;
  const qty = Number(litres.replace(/,/g, ""));
  const entered = litres.trim() !== "" && Number.isFinite(qty) && qty > 0;
  const tooMuch = entered && qty > have + 0.005;
  const after = entered && !tooMuch ? have - qty : have;
  const cost = tank.close_cost_per_litre ?? 0;
  const kg = (l: number, pct: number | null) => formatNumber(kgOfSolid(l, pct, kgPerLitre), 1);

  // the receiving tank after the move: its milk and this milk, weighted by litres
  const target = tanks.find((t) => t.tank_id === into) ?? null;
  const space = target?.capacity_litre ? Number(target.capacity_litre) - Number(target.close_litre) : null;
  const overfill = Boolean(target) && entered && space !== null && qty > space + 0.005;
  const blend = (a: number | null, b: number | null) => {
    if (!target || !entered) return null;
    const l = Number(target.close_litre) + qty;
    return l > 0 ? (Number(target.close_litre) * Number(a ?? 0) + qty * Number(b ?? 0)) / l : null;
  };

  function submit() {
    if (!entered || tooMuch || overfill) return;
    if (into) {
      start(async () => {
        const res = await transferMilk(date, tank.tank_id, into, String(qty), notes);
        if (!res.ok) { setError(res.error); return; }
        router.refresh();
        onDone();
      });
      return;
    }
    const form = new FormData();
    form.set("tank_id", tank.tank_id);
    form.set("direction", "out");
    form.set("movement_date", date);
    form.set("qty_litre", String(qty));
    form.set("notes", notes);
    start(async () => {
      const res = await addMovement(form);
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
      onDone();
    });
  }

  const rows: { label: string; now: string; after: string }[] = [
    { label: "Litres", now: `${formatNumber(have, 1)} L`, after: `${formatNumber(after, 1)} L` },
    { label: "Kg fat", now: kg(have, tank.close_fat_pct), after: kg(after, tank.close_fat_pct) },
    { label: "Kg SNF", now: kg(have, tank.close_snf_pct), after: kg(after, tank.close_snf_pct) },
    { label: "Value", now: `₹${formatNumber(have * cost, 0)}`, after: `₹${formatNumber(after * cost, 0)}` },
  ];

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <DialogHeader>
        <DialogTitle>{into ? `Move milk from ${tank.name}` : `Take milk out of ${tank.name}`}</DialogTitle>
        <DialogDescription>
          {date} · at {formatNumber(tank.close_fat_pct, 2)}% fat, {formatNumber(tank.close_snf_pct, 2)}% SNF - these stay the same.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-5 py-4">
        {tanks.length ? <div>
          <span className="text-[12px] font-semibold text-muted-foreground">Where does it go?</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setInto("")}
              className={`rounded-lg border px-3 py-2 text-left text-[13px] font-semibold ${into === "" ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
              Out of the tanks
            </button>
            <select value={into} onChange={(e) => setInto(e.target.value)} aria-label="Move into tank"
              className={`rounded-lg border px-3 py-2 text-[13px] font-semibold ${into ? "border-foreground bg-foreground text-background" : "border-border bg-white text-muted-foreground"}`}>
              <option value="">Into another tank…</option>
              {tanks.filter((t) => t.tank_id !== tank.tank_id && t.is_active).map((t) => (
                <option key={t.tank_id} value={t.tank_id}>
                  {t.name} - {formatNumber(Number(t.close_litre), 0)}{t.capacity_litre ? ` / ${formatNumber(Number(t.capacity_litre), 0)}` : ""} L
                </option>
              ))}
            </select>
          </div>
        </div> : null}

        <div>
          <label htmlFor="takeout-litres" className="text-[12px] font-semibold text-muted-foreground">{into ? "Litres to move" : "Litres to take out"}</label>
          <div className="mt-1 flex gap-2">
            <Input
              id="takeout-litres"
              autoFocus
              inputMode="decimal"
              value={litres}
              onChange={(e) => { setLitres(e.target.value); setError(null); }}
              placeholder="0"
              aria-invalid={tooMuch || undefined}
              className="num h-10 text-lg font-semibold"
            />
            <Button type="button" variant="outline" className="h-10 px-3" onClick={() => setLitres(String(have))}>
              All
            </Button>
          </div>
          {tooMuch ? (
            <p className="mt-1 text-[12px] font-semibold text-destructive">Only {formatNumber(have, 1)} L is in {tank.name}.</p>
          ) : null}
          {overfill ? (
            <p className="mt-1 text-[12px] font-semibold text-destructive">{target!.name} only has room for {formatNumber(space ?? 0, 0)} L.</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="takeout-notes" className="text-[12px] font-semibold text-muted-foreground">
            Notes <span className="font-normal">(optional)</span>
          </label>
          <Input
            id="takeout-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. to pasteuriser"
            className="mt-1 h-9"
          />
        </div>

        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground">
              <th className="py-1.5 text-left font-medium" />
              <th className="py-1.5 text-right font-medium">Now</th>
              <th className="py-1.5 text-right font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border/60 last:border-0">
                <td className="py-1.5 text-muted-foreground">{r.label}</td>
                <td className="num py-1.5 text-right text-muted-foreground">{r.now}</td>
                <td className="num py-1.5 text-right font-semibold text-foreground">{r.after}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {target ? (
          <div className="rounded-lg bg-muted/60 p-3 text-[12px]">
            <div className="font-semibold text-foreground">{target.name} after the move - weighted average</div>
            <div className="num mt-1 grid grid-cols-4 gap-2 text-muted-foreground">
              <span>Litres<br /><b className="text-foreground">{formatNumber(Number(target.close_litre) + (entered ? qty : 0), 0)}</b></span>
              <span>Fat %<br /><b className="text-foreground">{blend(target.close_fat_pct, tank.close_fat_pct) === null ? "—" : formatNumber(blend(target.close_fat_pct, tank.close_fat_pct)!, 2)}</b></span>
              <span>SNF %<br /><b className="text-foreground">{blend(target.close_snf_pct, tank.close_snf_pct) === null ? "—" : formatNumber(blend(target.close_snf_pct, tank.close_snf_pct)!, 2)}</b></span>
              <span>₹ / L<br /><b className="text-foreground">{blend(target.close_cost_per_litre, tank.close_cost_per_litre) === null ? "—" : formatNumber(blend(target.close_cost_per_litre, tank.close_cost_per_litre)!, 2)}</b></span>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-[12px] font-semibold text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button
          type="submit"
          disabled={!entered || tooMuch || overfill || pending}
          className="bg-foreground text-background hover:bg-foreground/85"
        >
          {pending ? "Saving…" : into ? (entered && !tooMuch ? `Move ${formatNumber(qty, 1)} L` : "Move") : entered && !tooMuch ? `Take out ${formatNumber(qty, 1)} L` : "Take out"}
        </Button>
      </DialogFooter>
    </form>
  );
}
