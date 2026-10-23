"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideOrderAction } from "@/app/orders/portalOrder/actions";

/** Confirm / Cancel buttons of a pending primary order. */
export function OrderDecision({ id, orderId }: { id: string; orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: "confirm" | "cancel") => {
    let reason: string | undefined;
    if (action === "cancel") {
      const r = window.prompt(`Why is order ${orderId} being cancelled? The distributor will see this.`);
      if (r === null) return;
      reason = r;
    } else if (!window.confirm(`Confirm order ${orderId}?`)) return;
    start(async () => {
      const r = await decideOrderAction(id, action, reason);
      if (r.ok) {
        setError(null);
        router.refresh();
      } else setError(r.error);
    });
  };

  const btn = "h-7 rounded-md px-2.5 text-xs font-semibold disabled:opacity-50";
  return (
    <div className="flex items-center justify-end gap-1.5">
      {error ? <span className="max-w-48 text-xs text-destructive">{error}</span> : null}
      <button type="button" disabled={pending} onClick={() => run("confirm")} className={`${btn} bg-emerald-600 text-white hover:opacity-90`}>
        Confirm
      </button>
      <button type="button" disabled={pending} onClick={() => run("cancel")} className={`${btn} border border-destructive/40 text-destructive hover:bg-destructive/10`}>
        Cancel
      </button>
    </div>
  );
}
