"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PROCUREMENT_MODULES } from "./modules";

export function ModuleNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {PROCUREMENT_MODULES.map((m) => {
        const active =
          m.href === "/procurement" ? pathname === m.href : pathname.startsWith(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            title={m.blurb}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors ${
              active
                ? "border-[#4A6FA5] bg-[#4A6FA5] text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-[#4A6FA5]/40 hover:text-[#2B4C86]"
            }`}
          >
            <m.icon className="h-4 w-4" />
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
