"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/cn/fields";
import { DEPARTMENTS } from "@/lib/cn/sop";

/** Search and department filter. They live in the URL, so a filtered list can be shared or bookmarked. */
export function CnFilters() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dept = sp.get("dept") ?? "";
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const push = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(next.size ? `${path}?${next}` : path, { scroll: false }));
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative sm:w-80">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-tertiary-foreground" />
        <Input
          value={q}
          placeholder="Search complaint, customer, invoice, product…"
          className="h-9 border-border-control-hover bg-card pl-8 pr-8 md:h-8"
          onChange={(e) => {
            setQ(e.target.value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => push({ q: e.target.value.trim() }), 250);
          }}
        />
        {q ? (
          <button type="button" aria-label="Clear search" onClick={() => { setQ(""); push({ q: "" }); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-tertiary-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="sm:w-52">
        <Pick value={dept} onChange={(v) => push({ dept: v })} placeholder="All departments" options={[{ value: "", label: "All departments" }, ...DEPARTMENTS]} />
      </div>
    </div>
  );
}
