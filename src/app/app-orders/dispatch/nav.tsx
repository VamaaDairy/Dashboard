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

/** The Dispatch tabs, underlined like the profile pages' tabs. */
export function DispatchNav() {
  const path = usePathname();
  const date = useSearchParams().get("date");
  return (
    <nav className="mt-2 flex gap-6 overflow-x-auto border-b border-border" aria-label="Dispatch">
      {TABS.map((t) => {
        const on = t.exact ? path === t.href : path.startsWith(t.href) || (t.label === "Trips" && TRIP.test(path));
        const href = t.dated && date ? `${t.href}?date=${date}` : t.href;
        return (
          <Link key={t.href} href={href} aria-current={on ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 pb-2.5 text-[13px] transition-colors",
              on ? "border-foreground font-medium text-foreground" : "border-transparent text-tertiary-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
