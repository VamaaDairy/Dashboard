"use client";

import { useState, useTransition } from "react";
import { createSubscriptionOrdersAction } from "@/lib/shop/actions";

export function CreateOrdersButton({ day, label }: { day: string; label: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createSubscriptionOrdersAction(day);
            setMsg(r.ok ? (r.created ? `Created ${r.created} order(s), ${r.items} item(s).` : "Nothing new to create - already done.") : r.error ?? "Could not create the orders.");
          })
        }
        className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Creating..." : label}
      </button>
      {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
