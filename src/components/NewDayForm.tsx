"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createDay } from "@/app/daily/actions";

/**
 * `bare` drops the card chrome so the form can sit inside another card - the
 * Today page embeds it rather than sending you to /daily to start the day.
 */
export function NewDayForm({ bare = false, cta = "Open day" }: { bare?: boolean; cta?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={(fd) => start(async () => {
        const res = await createDay(fd);
        if (res.ok) {
          setError(null);
          if (res.day) router.push(`/daily/${res.day}`);
        } else {
          setError(res.error);
        }
      })}
      className={
        bare
          ? "flex flex-wrap items-end gap-3"
          : "flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-xs"
      }
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</span>
        <input
          type="date" name="day" defaultValue={today} required
          className="rounded-lg border border-border bg-input/30 px-3 py-2 focus:border-primary focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Milk processed (litres)
        </span>
        <input
          name="milk_processed_l" inputMode="decimal" placeholder="e.g. 12500"
          className="num w-48 rounded-lg border border-border bg-input/30 px-3 py-2 focus:border-primary focus:outline-none"
        />
      </label>
      <button className="rounded-lg border border-border bg-white px-4 py-2 font-semibold text-foreground hover:bg-accent">
        {cta}
      </button>
      {error ? <span className="text-destructive">{error}</span> : null}
    </form>
  );
}
