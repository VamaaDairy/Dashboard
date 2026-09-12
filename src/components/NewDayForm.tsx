"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createDay } from "@/app/daily/actions";

export function NewDayForm() {
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
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Date</span>
        <input
          type="date" name="day" defaultValue={today} required
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-[#4A6FA5] focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Milk processed (litres)
        </span>
        <input
          name="milk_processed_l" inputMode="decimal" placeholder="e.g. 12500"
          className="num w-48 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-[#4A6FA5] focus:outline-none"
        />
      </label>
      <button className="rounded-lg bg-[#4A6FA5] px-4 py-2 font-semibold text-white hover:bg-[#3E5FA0]">
        Open day
      </button>
      {error ? <span className="text-red-600">{error}</span> : null}
    </form>
  );
}
