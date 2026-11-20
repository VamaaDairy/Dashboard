"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const BASE = "/app-orders/dispatch";
/** dated: the tab follows a delivery day, so it keeps the one you are looking at */
const TABS = [
  { href: BASE, label: "Plan", exact: true, dated: true },
  { href: `${BASE}/live`, label: "Live", dated: true },
  { href: `${BASE}/trips`, label: "Trips" },
  { href: `${BASE}/routes`, label: "Routes" },
  { href: `${BASE}/reports`, label: "Reports" },
];
/** a trip's own page sits under Trips */
const TRIP = new RegExp(`^${BASE}/\\d+$`);

/** The Dispatch tabs, under the section's name. */
export function DispatchNav() {
  const path = usePathname();
  const date = useSearchParams().get("date");
  return (
    <nav className="flex items-center gap-6 overflow-x-auto border-b border-foreground/10" aria-label="Dispatch">
      <Link href={BASE} className="py-2.5 text-[15px] font-semibold text-foreground">Dispatch</Link>
      {TABS.map((t) => {
        const on = t.exact ? path === t.href : path.startsWith(t.href) || (t.label === "Trips" && TRIP.test(path));
        const href = t.dated && date ? `${t.href}?date=${date}` : t.href;
        return (
          <Link key={t.href} href={href} aria-current={on ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 py-2.5 text-[13px]", on ? "border-foreground font-semibold text-foreground" : "border-transparent text-foreground/75 hover:text-foreground")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
