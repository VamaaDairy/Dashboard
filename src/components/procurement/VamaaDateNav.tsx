"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// Pure UTC arithmetic - mixing a local-time `Date` (no offset in the string)
// with `toISOString()` (always UTC) rolls the date back a day on any server
// east of UTC, which is exactly where this centre is.
function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/**
 * Plain hard navigations rather than the client router - Next 16's router
 * cache was serving the previous day's RSC payload for a `push` to a fresh
 * `[date]` segment, so this sidesteps it entirely.
 */
export function VamaaDateNav({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-1">
      <a
        href={`/procurement/vamaa/${addDays(date, -1)}`}
        className="rounded-lg border border-border bg-input/30 p-2 text-muted-foreground hover:border-primary/40 hover:text-primary"
        title="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </a>
      <input
        type="date"
        defaultValue={date}
        onChange={(e) => {
          if (e.target.value) window.location.href = `/procurement/vamaa/${e.target.value}`;
        }}
        className="rounded-lg border border-border bg-input/30 px-3 py-2 text-[13px] font-semibold text-foreground focus:border-ring focus:outline-none"
      />
      <a
        href={`/procurement/vamaa/${addDays(date, 1)}`}
        className="rounded-lg border border-border bg-input/30 p-2 text-muted-foreground hover:border-primary/40 hover:text-primary"
        title="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </a>
    </div>
  );
}
