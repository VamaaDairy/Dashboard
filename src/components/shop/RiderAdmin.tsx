"use client";

import { useTransition } from "react";
import { setRiderAction } from "@/lib/shop/actions";

export function RiderActions({ id, active, pay }: { id: number; active: boolean; pay: number }) {
  const [pending, start] = useTransition();
  const run = (patch: { active?: boolean; pin?: string; pay?: number }) =>
    start(async () => {
      const r = await setRiderAction(id, patch);
      if (!r.ok && r.error) window.alert(r.error);
    });
  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        onClick={() => {
          const pin = window.prompt("New PIN (4-8 digits). The rider is signed out of their phone.");
          if (pin) run({ pin });
        }}
        className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted disabled:opacity-60"
      >
        Reset PIN
      </button>
      <button
        disabled={pending}
        onClick={() => {
          const v = window.prompt("Pay per delivery in rupees. Counts for deliveries from now on.", String(pay));
          if (v !== null && v.trim() !== "") run({ pay: Number(v.replace(/[^\d.]/g, "")) });
        }}
        className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted disabled:opacity-60"
      >
        Set pay
      </button>
      <button disabled={pending} onClick={() => run({ active: !active })} className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted disabled:opacity-60">
        {active ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}
