"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignCollectionToTank } from "@/app/procurement/actions";

/**
 * The Tank cell on a Milk in collection row. Picking a tank puts the
 * collection's litres, fat and SNF into it; picking "—" takes it back out.
 */
export function TankPicker({
  date, collectionRef, current, tanks,
}: {
  date: string;
  collectionRef: string;
  current: string | undefined;
  tanks: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="min-w-36">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const before = value;
          setValue(next);
          start(async () => {
            const res = await assignCollectionToTank(date, collectionRef, next);
            if (!res.ok) { setValue(before); setError(res.error); return; }
            setError(null);
            router.refresh();
          });
        }}
        className={`w-full rounded-md border px-2 py-1 text-[12px] font-semibold ${
          value ? "border-foreground/30 bg-muted text-foreground" : "border-border bg-input/30 text-muted-foreground"
        } ${pending ? "opacity-50" : ""}`}
      >
        <option value=""> Choose a tank </option>
        {tanks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {error ? <p className="mt-1 max-w-56 whitespace-normal text-[11px] font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}
