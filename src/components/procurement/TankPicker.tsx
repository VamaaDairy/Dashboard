"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignCollectionToTank, assignCollectionToTanks } from "@/app/procurement/actions";

const SPLIT = "__split";

/**
 * The Tank cell on a Milk in collection row. Picking a tank puts the
 * collection's litres, fat and SNF into it; picking "—" takes it back out;
 * "Split into 2 tanks" divides the litres between two different tanks.
 */
export function TankPicker({
  date, collectionRef, current, quantity, tanks,
}: {
  date: string;
  collectionRef: string;
  current: { tankId: string; litres: number }[];
  quantity: number;
  tanks: { id: string; name: string }[];
}) {
  const router = useRouter();
  const isSplit = current.length === 2;
  const [value, setValue] = useState(current.length === 1 ? current[0].tankId : "");
  const [splitting, setSplitting] = useState(false);
  const [tankA, setTankA] = useState(current[0]?.tankId ?? "");
  const [tankB, setTankB] = useState(current[1]?.tankId ?? "");
  const [litresA, setLitresA] = useState(current[0] && isSplit ? String(current[0].litres) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nameOf = (id: string) => tanks.find((t) => t.id === id)?.name ?? id;
  const a = Number(litresA);
  const rest = Math.round((quantity - (Number.isFinite(a) ? a : 0)) * 100) / 100;
  const canSave = tankA && tankB && tankA !== tankB && a > 0 && rest > 0;

  function run(fn: () => ReturnType<typeof assignCollectionToTank>, onFail?: () => void, onOk?: () => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) { onFail?.(); setError(res.error); return; }
      setError(null);
      onOk?.();
      router.refresh();
    });
  }

  if (splitting || isSplit) {
    return (
      <div className="min-w-44 space-y-1">
        {!splitting ? (
          <>
            {current.map((p) => (
              <div key={p.tankId} className="text-[12px] font-semibold">
                {nameOf(p.tankId)} <span className="num text-muted-foreground">· {p.litres} L</span>
              </div>
            ))}
            <div className="flex gap-2 text-[11px] font-semibold">
              <button type="button" className="text-primary underline" disabled={pending} onClick={() => setSplitting(true)}>Edit split</button>
              <button
                type="button" className="text-destructive underline" disabled={pending}
                onClick={() => run(() => assignCollectionToTank(date, collectionRef, ""), undefined, () => { setValue(""); setTankA(""); setTankB(""); setLitresA(""); })}
              >Remove</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <select value={tankA} onChange={(e) => setTankA(e.target.value)} className="w-28 rounded-md border border-border bg-input/30 px-1 py-1 text-[12px] font-semibold">
                <option value=""> Tank 1 </option>
                {tanks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input
                type="number" min="0" step="0.01" max={quantity} value={litresA} onChange={(e) => setLitresA(e.target.value)}
                placeholder="litres" className="num w-16 rounded-md border border-border bg-input/30 px-1 py-1 text-right text-[12px]"
              />
            </div>
            <div className="flex items-center gap-1">
              <select value={tankB} onChange={(e) => setTankB(e.target.value)} className="w-28 rounded-md border border-border bg-input/30 px-1 py-1 text-[12px] font-semibold">
                <option value=""> Tank 2 </option>
                {tanks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span className="num w-16 px-1 text-right text-[12px] text-muted-foreground">{a > 0 ? Math.max(rest, 0) : "—"}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">of {quantity} L</p>
            <div className="flex gap-2 text-[11px] font-semibold">
              <button
                type="button" disabled={pending || !canSave} className="rounded bg-primary px-2 py-0.5 text-primary-foreground disabled:opacity-40"
                onClick={() => run(
                  () => assignCollectionToTanks(date, collectionRef, [{ tankId: tankA, litres: a }, { tankId: tankB, litres: rest }]),
                  undefined, () => setSplitting(false),
                )}
              >Save split</button>
              <button
                type="button" disabled={pending} className="text-muted-foreground underline"
                onClick={() => { setSplitting(false); setError(null); }}
              >Cancel</button>
            </div>
          </>
        )}
        {error ? <p className="max-w-56 whitespace-normal text-[11px] font-semibold text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="min-w-36">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          if (next === SPLIT) { setSplitting(true); setTankA(value); setError(null); return; }
          const before = value;
          setValue(next);
          run(() => assignCollectionToTank(date, collectionRef, next), () => setValue(before));
        }}
        className={`w-full rounded-md border px-2 py-1 text-[12px] font-semibold ${
          value ? "border-foreground/30 bg-muted text-foreground" : "border-border bg-input/30 text-muted-foreground"
        } ${pending ? "opacity-50" : ""}`}
      >
        <option value=""> Choose a tank </option>
        {tanks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        <option value={SPLIT}>Split into 2 tanks…</option>
      </select>
      {error ? <p className="mt-1 max-w-56 whitespace-normal text-[11px] font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}
