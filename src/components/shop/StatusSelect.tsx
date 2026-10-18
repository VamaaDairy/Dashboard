"use client";

import { useTransition } from "react";
import { setStatusAction } from "@/lib/shop/actions";
import { STATUS_LABEL } from "@/lib/shop/pricing";

/** Staff change where an order is. Hidden for people without edit access (the page decides). */
export function StatusSelect({ id, status }: { id: number; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={status}
      disabled={pending}
      aria-label="Order status"
      onChange={(e) =>
        start(async () => {
          const r = await setStatusAction(id, e.target.value);
          if (!r.ok && r.error) window.alert(r.error);
        })
      }
      className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-60"
    >
      {Object.entries(STATUS_LABEL).map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}
