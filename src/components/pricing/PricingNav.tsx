"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/price-list", label: "SKUs", exact: true },
  { href: "/price-list/lists", label: "Price lists" },
  { href: "/price-list/customers", label: "Customers" },
  { href: "/price-list/overview", label: "Matrix" },
];

/** The Pricing tabs, under the page title. */
export function PricingNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-6 border-b border-foreground/10" aria-label="Pricing">
      {TABS.map((t) => {
        const on = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn("-mb-px border-b-2 py-2.5 text-[13px]", on ? "border-foreground font-semibold text-foreground" : "border-transparent text-foreground/75 hover:text-foreground")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
