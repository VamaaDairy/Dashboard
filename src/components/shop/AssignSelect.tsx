"use client";

import { useTransition } from "react";
import { assignRiderAction } from "@/lib/shop/actions";

/** Staff pick which rider takes an order. Hidden for people without edit access (the page decides). */
export function AssignSelect({ orderId, riderId, riders }: { orderId: number; riderId: number | null; riders: Array<{ id: number; name: string }> }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={riderId ?? ""}
      disabled={pending}
      aria-label="Rider"
      onChange={(e) =>
        start(async () => {
          const r = await assignRiderAction(orderId, e.target.value ? Number(e.target.value) : null);
          if (!r.ok && r.error) window.alert(r.error);
        })
      }
      className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-60"
    >
      <option value="">Not assigned</option>
      {riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  );
}
