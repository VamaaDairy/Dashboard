"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFarmerTransporter } from "@/app/farmers/actions";

/**
 * Which milk-to-plant transporter brings this farmer's milk in. Picking one
 * gives the farmer an equal share of that transporter's daily cost with the other farmers it carried that day.
 */
export function TransporterPicker({
  center, code, current, transporters, className = "",
}: {
  center: string;
  code: string;
  current: string | undefined;
  transporters: { id: string; name: string }[];
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <select
        value={value}
        disabled={pending}
        aria-label={`Transporter for farmer ${code}`}
        onChange={(e) => {
          const next = e.target.value;
          const before = value;
          setValue(next);
          start(async () => {
            const res = await setFarmerTransporter(center, code, next);
            if (!res.ok) { setValue(before); setError(res.error); return; }
            setError(null);
            router.refresh();
          });
        }}
        className={`w-full rounded-md border px-2 py-1 text-[12px] font-semibold ${
          value ? "border-foreground/30 bg-muted text-foreground" : "border-border bg-white text-muted-foreground"
        } ${pending ? "opacity-50" : ""}`}
      >
        <option value="">Choose transporter</option>
        {transporters.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {error ? <p className="mt-1 max-w-56 whitespace-normal text-[11px] font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}
